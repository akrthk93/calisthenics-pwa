import { describe, expect, it } from 'vitest';
import { habitsEarned, initialLadders, longestStreak, migrateLadders, programState, ladderStatus, missedLastSlot, plannedSets, slotFor, weekStreak } from '../src/logic';
import type { LadderState, Session, Settings } from '../src/types';
import { HABITS, LADDERS, TOTAL_STEPS, ladder } from '../src/data/program';
import { addDays } from '../src/dates';

const settings = (p: Partial<Settings> = {}): Settings => ({
  startDate: '2026-10-26', // Monday
  hasBands: false,
  restSec: 60,
  barRestSec: 90,
  sound: true,
  deloadUntil: null,
  videos: {},
  ...p,
});

let n = 0;
const sess = (day: string, kind: Session['kind'] = 'strength', entries: Session['entries'] = []): Session => ({
  id: String(n++),
  at: `${day}T06:50:00.000Z`,
  day,
  kind,
  durationSec: 1200,
  entries,
});

const push = (sets: number[], planned = 3) => ({ ladderId: 'push' as const, stepId: 'push-wall', planned, sets });
const pushState: LadderState = { id: 'push', stepIndex: 0, since: '2026-10-26' };

describe('plannedSets', () => {
  it('uses 2 sets in weeks 1–2 then 3', () => {
    expect(plannedSets(settings(), '2026-10-26')).toBe(2);
    expect(plannedSets(settings(), '2026-11-08')).toBe(2);
    expect(plannedSets(settings(), '2026-11-09')).toBe(3);
  });
  it('drops to 2 during a deload week', () => {
    expect(plannedSets(settings({ deloadUntil: '2026-12-06' }), '2026-12-01')).toBe(2);
    expect(plannedSets(settings({ deloadUntil: '2026-12-06' }), '2026-12-07')).toBe(3);
  });
});

describe('ladderStatus (step 1: wall pushup 3×10)', () => {
  const at = (sets: number[]) => push(sets);
  it('passes after two sessions in a row with every set at target', () => {
    const s = [sess('2026-11-11', 'strength', [at([10, 10, 10])]), sess('2026-11-13', 'strength', [at([10, 11, 12])])];
    const st = ladderStatus(pushState, s, settings(), '2026-11-13');
    expect(st.kind).toBe('ready');
    expect(st.kind === 'ready' && st.next.label).toBe('3×15');
  });
  it('is not passed if only the latest session hit it', () => {
    const s = [sess('2026-11-11', 'strength', [at([10, 9, 8])]), sess('2026-11-13', 'strength', [at([10, 10, 10])])];
    expect(ladderStatus(pushState, s, settings(), '2026-11-13')).toEqual({ kind: 'working', sessionsAtTop: 1 });
  });
  it('requires all planned sets', () => {
    const s = [sess('2026-11-11', 'strength', [at([10, 10])]), sess('2026-11-13', 'strength', [at([10, 10])])];
    expect(ladderStatus(pushState, s, settings(), '2026-11-13').kind).toBe('working');
  });
  it('ignores minimum sessions', () => {
    const s = [sess('2026-11-11', 'strength', [at([10, 10, 10])]), sess('2026-11-13', 'minimum', [push([12], 1)])];
    expect(ladderStatus(pushState, s, settings(), '2026-11-13').kind).toBe('working');
  });
  it('blocks band steps without bands', () => {
    const row: LadderState = { id: 'row', stepIndex: 1, since: '2026-10-26' }; // doorframe row 3×15 -> seated band row
    const e = { ladderId: 'row' as const, stepId: 'row-door', planned: 2, sets: [15, 15] };
    const s = [sess('2026-10-28', 'strength', [e]), sess('2026-10-30', 'strength', [e])];
    expect(ladderStatus(row, s, settings(), '2026-10-30').kind).toBe('needs-bands');
    expect(ladderStatus(row, s, settings({ hasBands: true }), '2026-10-30').kind).toBe('ready');
  });
  it('flags a stall after 3 weeks without progress', () => {
    const s = ['2026-10-26', '2026-10-28', '2026-10-30', '2026-11-16'].map((d) => sess(d, 'strength', [at([8, 8, 7])]));
    expect(ladderStatus(pushState, s, settings(), '2026-11-16').kind).toBe('stalled');
  });
  it('only counts sessions since the current step started', () => {
    const s = [sess('2026-11-11', 'strength', [at([10, 10, 10])]), sess('2026-11-13', 'strength', [at([10, 10, 10])])];
    expect(ladderStatus({ ...pushState, since: '2026-11-14' }, s, settings(), '2026-11-14').kind).toBe('working');
  });
  it('single-set tests pass the first time any set hits the target', () => {
    const last = ladder('push').steps.length - 1; // 20 pushups in a row
    const st: LadderState = { id: 'push', stepIndex: last, since: '2026-11-01' };
    const e = (sets: number[]) => ({ ladderId: 'push' as const, stepId: 'push-floor', planned: 3, sets });
    expect(ladderStatus(st, [sess('2026-11-02', 'strength', [e([18, 12, 10])])], settings(), '2026-11-02').kind).toBe('working');
    expect(ladderStatus(st, [sess('2026-11-04', 'strength', [e([20, 12, 10])])], settings(), '2026-11-04').kind).toBe('finish');
    expect(ladderStatus({ ...st, stepIndex: last + 1 }, [], settings(), '2026-11-04').kind).toBe('complete');
  });
  it('holds back a passed step whose next step is in a locked block', () => {
    const st: LadderState = { id: 'push', stepIndex: 3, since: '2026-11-01' }; // counter 3×12, next is Block 2
    const e = { ladderId: 'push' as const, stepId: 'push-counter', planned: 3, sets: [12, 12, 12] };
    const s = [sess('2026-11-02', 'strength', [e]), sess('2026-11-04', 'strength', [e])];
    expect(ladderStatus(st, s, settings(), '2026-11-04', 1).kind).toBe('gated');
    expect(ladderStatus(st, s, settings(), '2026-11-04', 2).kind).toBe('ready');
  });
  it('a track whose current step is beyond the open blocks is locked', () => {
    expect(ladderStatus({ id: 'hang', stepIndex: 0, since: '2026-11-01' }, [], settings(), '2026-11-01', 2)).toEqual({ kind: 'locked', block: 3 });
  });
});

describe('the 100-step program', () => {
  const all = [...LADDERS.flatMap((l) => l.steps), ...HABITS];
  it('has exactly 100 steps, numbered 1–100 in block order', () => {
    expect(TOTAL_STEPS).toBe(100);
    expect(all.map((x) => x.n).sort((a, b) => a - b)).toEqual(Array.from({ length: 100 }, (_, i) => i + 1));
    const byN = [...all].sort((a, b) => a.n - b.n);
    expect(byN.every((x, i) => i === 0 || x.block >= byN[i - 1].block)).toBe(true);
  });
  it('blocks never go backwards within a track, and every track starts in Block 1–3', () => {
    for (const l of LADDERS) {
      expect(l.steps.every((x, i) => i === 0 || x.block >= l.steps[i - 1].block)).toBe(true);
      expect(l.steps[0].block).toBeLessThanOrEqual(3);
    }
  });
  it('ends at the agreed finish lines', () => {
    const finish = LADDERS.flatMap((l) => l.steps.filter((x) => x.finish).map((x) => `${x.track}: ${x.name}`));
    expect(finish).toEqual([
      'push: 20 pushups in a row',
      'dip: 10 dips in a row',
      'vpull: 5 pull-ups in a row',
      'squat: A pistol squat on each leg',
      'hang: 10 hanging knee raises in a row',
      'hang: Tuck L-sit for 10s',
    ]);
  });
});

describe('programState and gating', () => {
  it('starts at 0/100 in Block 1 with Block 2 open', () => {
    const p = programState(initialLadders('2026-11-11'), [], []);
    expect([p.score, p.block, p.allowed]).toEqual([0, 1, 2]);
  });
  it('counts cleared steps and earned habits', () => {
    const tracks = initialLadders('2026-11-11').map((t) => (t.id === 'push' ? { ...t, stepIndex: 4 } : t));
    const p = programState(tracks, [sess('2026-11-11', 'walk')], [{ day: '2026-11-11', waistCm: 90 }]);
    expect(p.score).toBe(4 + 2); // 4 push steps + first walk + first waist check
    expect(p.pillars.push).toEqual({ done: 4, total: 24, block: 2 });
  });
  it('the slowest pillar sets the block, habits included', () => {
    const tracks = LADDERS.map((l) => ({ id: l.id, stepIndex: l.steps.findIndex((x) => x.block >= 2), since: '2026-11-11' }));
    expect(programState(tracks, [], []).block).toBe(1); // habits not done yet
  });
});

describe('habitsEarned', () => {
  it('reads streaks, walks and check-ins from the log', () => {
    const weeks = ['2026-10-26', '2026-11-02'].flatMap((m) => [0, 2, 4].map((d) => sess(addDays(m, d))));
    const h = habitsEarned([...weeks, sess('2026-11-03', 'walk'), sess('2026-11-05', 'walk')], [
      { day: '2026-11-02', weightKg: 72 }, { day: '2026-11-04', weightKg: 72 }, { day: '2026-11-06', weightKg: 71.8 },
    ]);
    expect(Object.entries(h).filter(([, v]) => v).map(([k]) => k)).toEqual(['habit-01', 'habit-02', 'habit-03', 'habit-05', 'habit-06']);
    expect(longestStreak(weeks)).toBe(2);
  });
});

describe('migrateLadders', () => {
  it('carries old ladder positions over by exercise', () => {
    const old = [
      { id: 'push', stepIndex: 2, since: '2026-11-01' }, // table incline
      { id: 'vpull', stepIndex: 4, since: '2026-11-02' }, // band-assisted
      { id: 'core', stepIndex: 0, since: '2026-10-28' },
    ];
    const t = migrateLadders(old, '2026-11-11');
    const step = (id: string) => { const s = t.find((x) => x.id === id)!; return [ladder(s.id).steps[s.stepIndex]?.name, s.since]; };
    expect(step('push')).toEqual(['Table incline pushup', '2026-11-01']);
    expect(step('vpull')).toEqual(['Band-assisted pull-up (30 kg band)', '2026-11-02']);
    expect(step('core')).toEqual(['Dead bug', '2026-10-28']);
    expect(step('dip')).toEqual(['Parallel bar support hold', '2026-11-11']);
  });
});

describe('weekStreak', () => {
  it('counts consecutive weeks with 3+ strength sessions, incl. minimum', () => {
    const s = [
      sess('2026-10-26'), sess('2026-10-28'), sess('2026-10-30', 'minimum'), // week 1: 3
      sess('2026-11-02'), sess('2026-11-04'), sess('2026-11-06'), // week 2: 3
      sess('2026-11-09'), sess('2026-11-09', 'walk'), // week 3 in progress: 1
    ];
    expect(weekStreak(s, '2026-11-10')).toBe(2);
  });
  it('breaks on a short week', () => {
    const s = [sess('2026-10-26'), sess('2026-10-28'), sess('2026-10-30'), sess('2026-11-02')];
    expect(weekStreak(s, '2026-11-10')).toBe(0);
  });
});

describe('missedLastSlot', () => {
  it('maps days to their Mon/Wed/Fri slot', () => {
    expect(slotFor('2026-10-27')).toBe('2026-10-26'); // Tue → Mon
    expect(slotFor('2026-11-01')).toBe('2026-10-30'); // Sun → Fri
  });
  it('warns when the last closed slot was missed', () => {
    // Wed: Monday's slot closed with nothing logged.
    expect(missedLastSlot([], '2026-11-04', '2026-10-26')).toBe(true);
    // A Tuesday session counts for Monday.
    expect(missedLastSlot([sess('2026-11-03')], '2026-11-04', '2026-10-26')).toBe(false);
  });
  it('does not warn before the plan started', () => {
    expect(missedLastSlot([], '2026-10-27', '2026-10-27')).toBe(false);
  });
});

import { dueCheckins } from '../src/logic';

describe('dueCheckins', () => {
  const keys = (m: Parameters<typeof dueCheckins>[0], d: string) => dueCheckins(m, d).map((x) => x.key);
  it('weight is due on Mon/Wed/Fri until logged that day', () => {
    const waist = { day: '2026-11-01', waistCm: 90 };
    expect(keys([waist], '2026-11-02')).toEqual(['weight']); // Mon
    expect(keys([waist], '2026-11-03')).toEqual([]); // Tue
    expect(keys([waist, { day: '2026-11-02', weightKg: 72 }], '2026-11-02')).toEqual([]);
  });
  it('waist is due with no entry, or after 28 days', () => {
    expect(keys([], '2026-11-03')).toEqual(['waist']);
    expect(keys([{ day: '2026-10-06', waistCm: 90 }], '2026-11-03')).toEqual(['waist']);
    expect(keys([{ day: '2026-10-07', waistCm: 90 }], '2026-11-03')).toEqual([]);
  });
});

import { reminderItems } from '../src/logic';

describe('reminderItems', () => {
  const sess = (day: string) => ({ id: day, at: `${day}T06:50:00.000Z`, day, kind: 'strength' as const, durationSec: 1, entries: [] });
  it('schedules Mon/Wed/Fri at 5:30 local for 4 weeks', () => {
    const items = reminderItems('2026-11-06', [], [{ day: '2026-11-01', waistCm: 90 }]); // Fri
    expect(items.length).toBe(12);
    expect(items[0].id).toBe('morning-2026-11-06');
    const d = new Date(items[0].at);
    expect([d.getDay(), d.getHours(), d.getMinutes()]).toEqual([5, 5, 30]);
    expect(items[0].title).toBe('Strength session + weigh-in');
    expect(items[0].badge).toBe(1);
  });
  it('adds waist when due, then a month later', () => {
    const items = reminderItems('2026-11-06', [], [{ day: '2026-10-10', waistCm: 90 }]);
    const waist = items.filter((i) => i.title.includes('waist')).map((i) => i.id);
    // Last waist 10 Oct -> due 7 Nov (Sat) -> first training day Mon 9 Nov. Next due 7 Dec, past the 4-week window.
    expect(waist).toEqual(['morning-2026-11-09']);
    const long = reminderItems('2026-11-06', [], [{ day: '2026-10-10', waistCm: 90 }], 40).filter((i) => i.title.includes('waist')).map((i) => i.id);
    expect(long).toEqual(['morning-2026-11-09', 'morning-2026-12-07']);
    expect(items.find((i) => i.id === 'morning-2026-11-09')!.title).toBe('Strength session, weigh-in + waist');
    expect(items.find((i) => i.id === 'morning-2026-11-09')!.badge).toBe(2);
  });
  it('skips a day once trained and weighed; keeps a weigh-in nudge if only trained', () => {
    const m = [{ day: '2026-11-01', waistCm: 90 }];
    expect(reminderItems('2026-11-06', [sess('2026-11-06')], [...m, { day: '2026-11-06', weightKg: 72 }])[0].id).toBe('morning-2026-11-09');
    const onlyTrained = reminderItems('2026-11-06', [sess('2026-11-06')], m)[0];
    expect([onlyTrained.id, onlyTrained.title]).toEqual(['morning-2026-11-06', 'Weigh-in']);
  });
});

import { streakItems } from '../src/logic';

describe('streakItems', () => {
  const s = (day: string) => ({ id: day, at: `${day}T06:50:00.000Z`, day, kind: 'strength' as const, durationSec: 1, entries: [] });
  // Week of Mon 26 Oct completed: a 1-week streak going into Mon 2 Nov.
  const lastWeek = [s('2026-10-26'), s('2026-10-28'), s('2026-10-30')];
  const ids = (today: string, sessions: ReturnType<typeof s>[], days = 7) => streakItems(today, sessions, days).map((i) => i.id);

  it('no sessions this week: last chance is Friday (Fri, Sat, Sun left)', () => {
    expect(ids('2026-11-02', lastWeek)).toEqual(['streak-2026-11-06']);
    const it = streakItems('2026-11-02', lastWeek, 7)[0];
    expect(new Date(it.at).getHours()).toBe(20);
    expect(it.title).toBe('1-week streak at risk');
  });
  it('two sessions done: last chance moves to Sunday', () => {
    expect(ids('2026-11-04', [...lastWeek, s('2026-11-02'), s('2026-11-04')])).toEqual(['streak-2026-11-08']);
  });
  it('no alert once 3 are done, or on a day already trained', () => {
    expect(ids('2026-11-06', [...lastWeek, s('2026-11-02'), s('2026-11-04'), s('2026-11-06')], 3)).toEqual([]);
    expect(ids('2026-11-08', [...lastWeek, s('2026-11-02'), s('2026-11-08')], 1)).toEqual([]);
  });
  it('nothing to lose with no streak yet', () => {
    expect(ids('2026-11-02', [])).toEqual([]);
  });
  it('future weeks assume the streak carries on', () => {
    const titles = streakItems('2026-11-02', lastWeek, 14).map((i) => `${i.id} ${i.title}`);
    expect(titles).toEqual(['streak-2026-11-06 1-week streak at risk', 'streak-2026-11-13 2-week streak at risk']);
  });
});
