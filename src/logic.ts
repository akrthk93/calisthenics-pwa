import { LADDERS, ladder, type LadderId, type Step } from './data/exercises';
import { addDays, daysBetween, isStrengthDay, weekStart } from './dates';
import type { LadderState, Session, Settings } from './types';

export const STALL_DAYS = 21;

/** Sets per exercise for a given day. Weeks 1–2 and deload weeks: 2. Otherwise 3. */
export function plannedSets(settings: Settings, day: string): number {
  if (settings.deloadUntil && day <= settings.deloadUntil) return 2;
  return daysBetween(settings.startDate, day) < 14 ? 2 : 3;
}

/** Ladder steps in order, as the person can do them now. */
export function currentStep(state: LadderState): Step {
  const l = ladder(state.id);
  return l.steps[Math.min(state.stepIndex, l.steps.length - 1)];
}

export type LadderStatus =
  | { kind: 'working'; sessionsAtTop: number }
  | { kind: 'ready'; next: Step }
  | { kind: 'needs-bands'; next: Step }
  | { kind: 'maxed' }
  | { kind: 'stalled'; days: number };

/** A logged entry hits the progression bar: all planned sets done, each at the top of the range. */
export function entryAtTop(step: Step, sets: number[], planned: number): boolean {
  return sets.length >= planned && sets.slice(0, planned).every((v) => v >= step.max);
}

/**
 * Progress rule: top of the range for every set, clean form, 2 sessions in a row
 * at the current step. Stall: 3+ weeks at a step with no progress.
 */
export function ladderStatus(state: LadderState, sessions: Session[], settings: Settings, today: string): LadderStatus {
  const l = ladder(state.id);
  const step = currentStep(state);
  const entries = sessions
    .filter((s) => s.day >= state.since)
    .sort((a, b) => b.at.localeCompare(a.at))
    .flatMap((s) => s.entries.filter((e) => e.stepId === step.id && s.kind !== 'minimum'));

  const lastTwo = entries.slice(0, 2);
  const ready = lastTwo.length === 2 && lastTwo.every((e) => entryAtTop(step, e.sets, e.planned));

  if (ready) {
    const next = l.steps[state.stepIndex + 1];
    if (!next) return { kind: 'maxed' };
    if (next.needsBands && !settings.hasBands) return { kind: 'needs-bands', next };
    return { kind: 'ready', next };
  }

  const days = daysBetween(state.since, today);
  if (days >= STALL_DAYS && entries.length >= 3) return { kind: 'stalled', days };

  const sessionsAtTop = entries.length && entryAtTop(step, entries[0].sets, entries[0].planned) ? 1 : 0;
  return { kind: 'working', sessionsAtTop };
}

export const countsAsStrength = (s: Session) => s.kind === 'strength' || s.kind === 'minimum';

/** Consecutive weeks (Mon–Sun) with 3+ strength sessions. The current week counts once it reaches 3. */
export function weekStreak(sessions: Session[], today: string): number {
  const perWeek = new Map<string, number>();
  for (const s of sessions.filter(countsAsStrength)) {
    const w = weekStart(s.day);
    perWeek.set(w, (perWeek.get(w) ?? 0) + 1);
  }
  let streak = 0;
  const thisWeek = weekStart(today);
  if ((perWeek.get(thisWeek) ?? 0) >= 3) streak++;
  let w = addDays(thisWeek, -7);
  while ((perWeek.get(w) ?? 0) >= 3) {
    streak++;
    w = addDays(w, -7);
  }
  return streak;
}

/** The scheduled strength day slot a session counts toward: the most recent Mon/Wed/Fri on or before it. */
export function slotFor(day: string): string {
  let d = day;
  for (let i = 0; i < 7 && !isStrengthDay(d); i++) d = addDays(d, -1);
  return d;
}

/**
 * "Never miss twice": was the most recent scheduled slot before today missed?
 * A session any day between that slot and the next counts for it.
 */
export function missedLastSlot(sessions: Session[], today: string, startDate: string): boolean {
  // The most recent slot whose window has closed.
  const target = slotFor(addDays(slotFor(today), -1));
  if (target < startDate) return false;
  return !sessions.some((s) => countsAsStrength(s) && slotFor(s.day) === target);
}

export function initialLadders(today: string): LadderState[] {
  return LADDERS.map((l) => ({ id: l.id as LadderId, stepIndex: 0, since: today }));
}

/** Sum of reps (or seconds) across sets — used for the progress sparkline. */
export function volume(sets: number[]): number {
  return sets.reduce((a, b) => a + b, 0);
}

/** 7-entry rolling average of weight, newest first. */
export function weeklyAvgWeight(points: { day: string; weightKg?: number }[], today: string): number | null {
  const from = addDays(today, -6);
  const w = points.filter((p) => p.weightKg != null && p.day >= from && p.day <= today).map((p) => p.weightKg!);
  return w.length ? Math.round((w.reduce((a, b) => a + b, 0) / w.length) * 10) / 10 : null;
}
