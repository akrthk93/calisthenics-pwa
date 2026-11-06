import { describe, expect, it } from 'vitest';
import { ladderStatus, missedLastSlot, plannedSets, slotFor, weekStreak } from '../src/logic';
import type { LadderState, Session, Settings } from '../src/types';

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

describe('ladderStatus', () => {
  it('is ready after two sessions in a row at the top of the range', () => {
    const s = [sess('2026-11-11', 'strength', [push([12, 12, 12])]), sess('2026-11-13', 'strength', [push([12, 12, 12])])];
    const st = ladderStatus(pushState, s, settings(), '2026-11-13');
    expect(st.kind).toBe('ready');
  });
  it('is not ready if only the latest session hit the top', () => {
    const s = [sess('2026-11-11', 'strength', [push([12, 11, 10])]), sess('2026-11-13', 'strength', [push([12, 12, 12])])];
    const st = ladderStatus(pushState, s, settings(), '2026-11-13');
    expect(st).toEqual({ kind: 'working', sessionsAtTop: 1 });
  });
  it('requires all planned sets', () => {
    const s = [sess('2026-11-11', 'strength', [push([12, 12])]), sess('2026-11-13', 'strength', [push([12, 12])])];
    expect(ladderStatus(pushState, s, settings(), '2026-11-13').kind).toBe('working');
  });
  it('ignores minimum sessions', () => {
    const s = [sess('2026-11-11', 'strength', [push([12, 12, 12])]), sess('2026-11-13', 'minimum', [push([12], 1)])];
    expect(ladderStatus(pushState, s, settings(), '2026-11-13').kind).toBe('working');
  });
  it('blocks band steps without bands', () => {
    const row: LadderState = { id: 'row', stepIndex: 0, since: '2026-10-26' };
    const e = { ladderId: 'row' as const, stepId: 'row-door', planned: 2, sets: [15, 15] };
    const s = [sess('2026-10-28', 'strength', [e]), sess('2026-10-30', 'strength', [e])];
    expect(ladderStatus(row, s, settings(), '2026-10-30').kind).toBe('needs-bands');
    expect(ladderStatus(row, s, settings({ hasBands: true }), '2026-10-30').kind).toBe('ready');
  });
  it('flags a stall after 3 weeks without progress', () => {
    const s = ['2026-10-26', '2026-10-28', '2026-10-30', '2026-11-16'].map((d) => sess(d, 'strength', [push([8, 8, 7])]));
    expect(ladderStatus(pushState, s, settings(), '2026-11-16').kind).toBe('stalled');
  });
  it('only counts sessions since the current step started', () => {
    const s = [sess('2026-11-11', 'strength', [push([12, 12, 12])]), sess('2026-11-13', 'strength', [push([12, 12, 12])])];
    const fresh: LadderState = { ...pushState, since: '2026-11-14' };
    expect(ladderStatus(fresh, s, settings(), '2026-11-14').kind).toBe('working');
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
