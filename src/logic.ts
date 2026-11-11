import type { Step } from './data/exercises';
import { HABITS, LADDERS, PILLARS, ladder, type Block, type LadderId, type PillarId, type ProgramStep } from './data/program';
import { addDays, daysBetween, isStrengthDay, weekStart, weekday } from './dates';
import type { LadderState, Session, Settings } from './types';

export const STALL_DAYS = 21;

/** Sets per exercise for a given day. Weeks 1–2 and deload weeks: 2. Otherwise 3. */
export function plannedSets(settings: Settings, day: string): number {
  if (settings.deloadUntil && day <= settings.deloadUntil) return 2;
  return daysBetween(settings.startDate, day) < 14 ? 2 : 3;
}

/** The step a track is on now, or null once the track's finish line is passed. */
export function currentStep(state: LadderState): ProgramStep | null {
  return ladder(state.id).steps[state.stepIndex] ?? null;
}

export type LadderStatus =
  | { kind: 'working'; sessionsAtTop: number }
  | { kind: 'ready'; next: ProgramStep }
  | { kind: 'finish' }
  | { kind: 'needs-bands'; next: ProgramStep }
  | { kind: 'gated'; next: ProgramStep; block: Block }
  | { kind: 'locked'; block: Block }
  | { kind: 'complete' }
  | { kind: 'stalled'; days: number };

/** A logged entry hits the progression bar: all planned sets done, each at the target. */
export function entryAtTop(step: Step, sets: number[], planned: number): boolean {
  return sets.length >= planned && sets.slice(0, planned).every((v) => v >= step.max);
}

/** Has the current step been passed? `sets`: target on every set, 2 sessions running. `single`: one set at target, once. */
export function stepPassed(step: ProgramStep, entries: { sets: number[]; planned: number }[]): boolean {
  if (step.test === 'single') return entries.some((e) => e.sets.some((v) => v >= step.max));
  const lastTwo = entries.slice(0, 2);
  return lastTwo.length === 2 && lastTwo.every((e) => entryAtTop(step, e.sets, e.planned));
}

/** Entries for the track's current step since it started, newest first. Minimum sessions don't count. */
function stepEntries(state: LadderState, step: ProgramStep, sessions: Session[]) {
  return sessions
    .filter((s) => s.day >= state.since && s.kind !== 'minimum')
    .sort((a, b) => b.at.localeCompare(a.at))
    .flatMap((s) => s.entries.filter((e) => e.stepId === step.id && (e.ladderId == null || e.ladderId === state.id)));
}

/**
 * Where a track stands. `allowed` is the highest block any step may be in (see programState):
 * a pillar can run at most one block ahead of the slowest pillar.
 */
export function ladderStatus(state: LadderState, sessions: Session[], settings: Settings, today: string, allowed: Block = 4): LadderStatus {
  const l = ladder(state.id);
  const step = currentStep(state);
  if (!step) return { kind: 'complete' };
  if (step.block > allowed) return { kind: 'locked', block: step.block };
  const entries = stepEntries(state, step, sessions);

  if (stepPassed(step, entries)) {
    const next = l.steps[state.stepIndex + 1];
    if (!next) return { kind: 'finish' };
    if (next.block > allowed) return { kind: 'gated', next, block: next.block };
    if (next.needsBands && !settings.hasBands) return { kind: 'needs-bands', next };
    return { kind: 'ready', next };
  }

  const days = daysBetween(state.since, today);
  if (days >= STALL_DAYS && entries.length >= 3) return { kind: 'stalled', days };

  const sessionsAtTop = entries.length && entryAtTop(step, entries[0].sets, entries[0].planned) ? 1 : 0;
  return { kind: 'working', sessionsAtTop };
}

// ---------- habits ----------

function weekCounts(sessions: Session[], pred: (s: Session) => boolean): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of sessions.filter(pred)) m.set(weekStart(s.day), (m.get(weekStart(s.day)) ?? 0) + 1);
  return m;
}

/** Longest run of consecutive Mon–Sun weeks with 3+ strength sessions, ever. */
export function longestStreak(sessions: Session[]): number {
  const weeks = [...weekCounts(sessions, countsAsStrength).entries()].filter(([, n]) => n >= 3).map(([w]) => w).sort();
  let best = 0;
  let run = 0;
  let prev = '';
  for (const w of weeks) {
    run = prev && addDays(prev, 7) === w ? run + 1 : 1;
    best = Math.max(best, run);
    prev = w;
  }
  return best;
}

/** Which habit steps are earned, by key. Checked from the log, so they can't be ticked by hand. */
export function habitsEarned(sessions: Session[], metrics: { day: string; weightKg?: number; waistCm?: number }[]): Record<string, boolean> {
  const strength = weekCounts(sessions, countsAsStrength);
  const walks = weekCounts(sessions, (s) => s.kind === 'walk');
  const weighIns = new Map<string, number>();
  for (const m of metrics) if (m.weightKg != null) weighIns.set(weekStart(m.day), (weighIns.get(weekStart(m.day)) ?? 0) + 1);
  const streak = longestStreak(sessions);
  const total = sessions.filter(countsAsStrength).length;
  return {
    'habit-01': [...strength.values()].some((n) => n >= 3),
    'habit-02': sessions.some((s) => s.kind === 'walk'),
    'habit-03': [...weighIns.values()].some((n) => n >= 3),
    'habit-04': metrics.some((m) => m.waistCm != null),
    'habit-05': streak >= 2,
    'habit-06': [...strength.entries()].some(([w, n]) => n >= 3 && (walks.get(w) ?? 0) >= 2),
    'habit-07': streak >= 4,
    'habit-08': total >= 25,
    'habit-09': streak >= 8,
    'habit-10': streak >= 12,
  };
}

// ---------- overall progress ----------

export interface ProgramState {
  /** Steps cleared, out of TOTAL_STEPS. */
  score: number;
  /** The slowest pillar's block (5 once everything is done). */
  block: number;
  /** Highest block a step may be in right now. */
  allowed: Block;
  habits: Record<string, boolean>;
  pillars: Record<PillarId, { done: number; total: number; block: number }>;
}

export function programState(tracks: LadderState[], sessions: Session[], metrics: { day: string; weightKg?: number; waistCm?: number }[]): ProgramState {
  const habits = habitsEarned(sessions, metrics);
  const pillars = {} as ProgramState['pillars'];
  let score = 0;
  for (const p of PILLARS) {
    if (p.id === 'habits') {
      const done = HABITS.filter((h) => habits[h.key]).length;
      const next = HABITS.find((h) => !habits[h.key]);
      pillars.habits = { done, total: HABITS.length, block: next ? next.block : 5 };
      score += done;
      continue;
    }
    let done = 0;
    let total = 0;
    let block = 5;
    for (const id of p.tracks) {
      const st = tracks.find((t) => t.id === id);
      const steps = ladder(id).steps;
      const idx = Math.min(st?.stepIndex ?? 0, steps.length);
      done += idx;
      total += steps.length;
      block = Math.min(block, steps[idx]?.block ?? 5);
    }
    pillars[p.id] = { done, total, block };
    score += done;
  }
  const slowest = Math.min(...Object.values(pillars).map((p) => p.block));
  return { score, block: slowest, allowed: Math.min(4, slowest + 1) as Block, habits, pillars };
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
  return LADDERS.map((l) => ({ id: l.id, stepIndex: 0, since: today }));
}

// Exercise order of each track before the 100-step program (v1.x), to carry progress over.
const OLD_LADDERS: Partial<Record<LadderId, string[]>> = {
  push: ['push-wall', 'push-counter', 'push-table', 'push-low', 'push-floor', 'push-pause', 'push-diamond'],
  row: ['row-door', 'row-seated', 'row-standing-light', 'row-standing-medium', 'row-squeeze'],
  vpull: ['vp-hang', 'vp-scap', 'vp-inverted', 'vp-negative', 'vp-band', 'vp-full'],
  squat: ['sq-box', 'sq-body', 'sq-tempo', 'sq-split', 'sq-rfess'],
  hinge: ['hg-bridge', 'hg-pause', 'hg-single', 'hg-band-gm'],
  core: ['core-deadbug', 'core-kneeplank', 'core-plank', 'core-hollow'],
};

/** Maps old ladder positions onto the first program step that uses the same exercise. */
export function migrateLadders(old: { id: string; stepIndex: number; since: string }[], today: string): LadderState[] {
  return initialLadders(today).map((fresh) => {
    const o = old.find((x) => x.id === fresh.id);
    const ids = OLD_LADDERS[fresh.id];
    if (!o || !ids) return fresh;
    let ex = ids[Math.min(o.stepIndex, ids.length - 1)];
    if (ex === 'push-pause' || ex === 'push-diamond') ex = 'push-floor';
    const steps = ladder(fresh.id).steps;
    const idx = steps.findIndex((s) => s.id === ex);
    return { id: fresh.id, stepIndex: Math.max(0, idx), since: o.since };
  });
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

export interface DueItem {
  key: 'weight' | 'waist';
  label: string;
}

/**
 * Body check-ins due today:
 * - weight: on Mon/Wed/Fri (3×/week, training mornings) until logged that day
 * - waist: when the last waist entry is 28+ days old, or there is none
 */
export function dueCheckins(metrics: { day: string; weightKg?: number; waistCm?: number }[], today: string): DueItem[] {
  const due: DueItem[] = [];
  if (isStrengthDay(today) && !metrics.some((m) => m.day === today && m.weightKg != null)) {
    due.push({ key: 'weight', label: 'Weigh-in' });
  }
  const lastWaist = metrics.filter((m) => m.waistCm != null && m.day <= today).sort((a, b) => b.day.localeCompare(a.day))[0];
  if (!lastWaist || daysBetween(lastWaist.day, today) >= 28) due.push({ key: 'waist', label: 'Waist measurement' });
  return due;
}

export interface ReminderItem {
  id: string;
  /** Epoch ms. */
  at: number;
  title: string;
  body: string;
  tag: string;
  /** Icon badge to set; -1 leaves it unchanged. */
  badge: number;
}

export const REMINDER_TIME = { h: 5, m: 30 };

/**
 * Morning reminders for the next `days` days: Mon/Wed/Fri at 5:30 local time.
 * Weigh-in every time; waist when it falls due (28 days after the last one).
 * A day is left out once both the session and the weigh-in are logged.
 */
export function reminderItems(
  today: string,
  sessions: Session[],
  metrics: { day: string; weightKg?: number; waistCm?: number }[],
  days = 28,
): ReminderItem[] {
  const lastWaist = metrics.filter((m) => m.waistCm != null).map((m) => m.day).sort().pop();
  let waistDue = lastWaist ? addDays(lastWaist, 28) : today;
  const items: ReminderItem[] = [];
  for (let i = 0; i < days; i++) {
    const d = addDays(today, i);
    if (!isStrengthDay(d)) continue;
    const trained = sessions.some((s) => s.day === d && countsAsStrength(s));
    const weighed = metrics.some((m) => m.day === d && m.weightKg != null);
    const waist = d >= waistDue && !metrics.some((m) => m.day === d && m.waistCm != null);
    if (trained && weighed && !waist) continue;

    const parts = [!trained && 'Strength session', !weighed && 'weigh-in', waist && 'waist'].filter(Boolean) as string[];
    const title = parts.length === 1 ? cap(parts[0]) : `${cap(parts.slice(0, -1).join(', '))} + ${parts[parts.length - 1]}`;
    const body = trained
      ? 'Log it in the app.'
      : waist
        ? 'Weigh in, measure your waist at the navel, then train at 6:35.'
        : 'Weigh in first, then train at 6:35. About 20 minutes.';
    const [y, mo, da] = d.split('-').map(Number);
    items.push({
      id: `morning-${d}`,
      at: new Date(y, mo - 1, da, REMINDER_TIME.h, REMINDER_TIME.m).getTime(),
      title,
      body,
      tag: 'morning',
      badge: (weighed ? 0 : 1) + (waist ? 1 : 0),
    });
    // Once a waist reminder is scheduled, the next one is a month later.
    if (waist) waistDue = addDays(d, 28);
  }
  return items;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * 8pm "streak at risk" alerts: on the last day you can still reach 3 strength
 * sessions this week (so skipping today makes it impossible), when there's a
 * streak to lose. Future weeks assume the weeks before them get completed; the
 * app re-syncs after every logged session, so this only matters if it isn't opened.
 */
export function streakItems(today: string, sessions: Session[], days = 28): ReminderItem[] {
  const strength = sessions.filter(countsAsStrength);
  const perWeek = new Map<string, number>();
  for (const s of strength) perWeek.set(weekStart(s.day), (perWeek.get(weekStart(s.day)) ?? 0) + 1);
  const thisWeek = weekStart(today);
  const completedBefore = (w: string) => {
    let n = 0;
    for (let x = addDays(w, -7); (perWeek.get(x) ?? 0) >= 3; x = addDays(x, -7)) n++;
    return n;
  };
  const base = completedBefore(thisWeek);

  const items: ReminderItem[] = [];
  for (let i = 0; i < days; i++) {
    const d = addDays(today, i);
    const w = weekStart(d);
    if (strength.some((s) => s.day === d)) continue;
    const done = strength.filter((s) => weekStart(s.day) === w && s.day <= d).length;
    const needed = 3 - done;
    const daysAfter = 6 - weekday(d);
    if (needed <= 0 || needed !== daysAfter + 1) continue;
    const atStake = w === thisWeek ? base : base + Math.round(daysBetween(thisWeek, w) / 7);
    if (atStake < 1) continue;
    const [y, mo, da] = d.split('-').map(Number);
    items.push({
      id: `streak-${d}`,
      at: new Date(y, mo - 1, da, 20, 0).getTime(),
      title: `${atStake}-week streak at risk`,
      body: needed === 1 ? 'Train today to make 3 this week. The 5-minute session counts.' : `You need ${needed} more this week, so today’s the day. The 5-minute session counts.`,
      tag: 'streak',
      badge: -1,
    });
  }
  return items;
}
