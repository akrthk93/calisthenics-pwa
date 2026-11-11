// The 100-step program: 5 pillars, 8 exercise tracks + habits, 4 blocks.
// A step is an exercise and a target. Strength steps pass on performance; habit steps pass on your log.
import { EXERCISES, type Step } from './exercises';

export type LadderId = 'push' | 'dip' | 'row' | 'vpull' | 'squat' | 'hinge' | 'core' | 'hang';
export type PillarId = 'push' | 'pull' | 'legs' | 'core' | 'habits';
export type Block = 1 | 2 | 3 | 4;

export const BLOCKS: Record<Block, { name: string; about: string }> = {
  1: { name: 'Foundation', about: 'Learn the movements, build the habit.' },
  2: { name: 'Build', about: 'Harder angles, the band work starts, dips begin.' },
  3: { name: 'Strength', about: 'Floor pushups, negatives, single-leg work, hanging core.' },
  4: { name: 'Skill', about: 'Pull-ups, dips, pistols and the L-sit. The finish lines.' },
};

export const PILLARS: { id: PillarId; name: string; tracks: LadderId[] }[] = [
  { id: 'push', name: 'Push', tracks: ['push', 'dip'] },
  { id: 'pull', name: 'Pull', tracks: ['row', 'vpull'] },
  { id: 'legs', name: 'Legs', tracks: ['squat', 'hinge'] },
  { id: 'core', name: 'Core', tracks: ['core', 'hang'] },
  { id: 'habits', name: 'Habits', tracks: [] },
];

/**
 * `sets`: every planned set must reach the target, two sessions in a row.
 * `single`: one set reaching the target, once (a test, e.g. 20 pushups in a row).
 */
export type Test = 'sets' | 'single';

export interface ProgramStep extends Step {
  /** Unique step id, e.g. "push-05". `id` stays the exercise id. */
  key: string;
  /** 1–100, in block order. */
  n: number;
  block: Block;
  track: LadderId;
  sets: number;
  test: Test;
  /** Short target, e.g. "3×12", "3×30s", "3×8/side", "20 in one set". */
  label: string;
  finish?: boolean;
}

export interface Ladder {
  id: LadderId;
  name: string;
  pillar: PillarId;
  where: 'home' | 'bar';
  steps: ProgramStep[];
}

export interface HabitStep {
  key: string;
  n: number;
  block: Block;
  name: string;
  /** How it's checked, shown on the checklist. */
  test: string;
}

// [exercise id, target, block, test?, sets?, name override?, finish?]
type Spec = [string, number, Block, Test?, number?, string?, boolean?];

const TRACK_SPECS: { id: LadderId; name: string; pillar: PillarId; where: 'home' | 'bar'; steps: Spec[] }[] = [
  {
    id: 'push', name: 'Pushups', pillar: 'push', where: 'home',
    steps: [
      ['push-wall', 10, 1], ['push-wall', 15, 1], ['push-counter', 8, 1], ['push-counter', 12, 1],
      ['push-table', 8, 2], ['push-table', 12, 2], ['push-low', 8, 2], ['push-low', 12, 2], ['push-low', 15, 2],
      ['push-negative', 4, 3], ['push-floor', 3, 3], ['push-floor', 6, 3], ['push-floor', 8, 3], ['push-floor', 10, 3],
      ['push-floor', 15, 4], ['push-floor', 20, 4, 'single', 3, '20 pushups in a row', true],
    ],
  },
  {
    id: 'dip', name: 'Dips', pillar: 'push', where: 'bar',
    steps: [
      ['dip-support', 15, 2], ['dip-support', 30, 2],
      ['dip-negative', 3, 3], ['dip-negative', 5, 3], ['dip-feet', 8, 3],
      ['dip-full', 3, 4], ['dip-full', 6, 4], ['dip-full', 10, 4, 'single', 3, '10 dips in a row', true],
    ],
  },
  {
    id: 'row', name: 'Rows', pillar: 'pull', where: 'home',
    steps: [
      ['row-door', 10, 1], ['row-door', 15, 1], ['row-seated', 12, 1], ['row-seated', 15, 1],
      ['row-standing-light', 15, 2], ['row-standing-medium', 10, 2], ['row-standing-medium', 15, 2],
      ['row-squeeze', 12, 3], ['row-standing-heavy', 10, 3], ['row-standing-heavy', 15, 4],
    ],
  },
  {
    id: 'vpull', name: 'Pull-ups', pillar: 'pull', where: 'bar',
    steps: [
      ['vp-hang', 15, 1], ['vp-hang', 30, 1], ['vp-scap', 6, 1],
      ['vp-scap', 10, 2], ['vp-inverted', 8, 2], ['vp-inverted', 12, 2], ['vp-hang', 60, 2, 'single', 3, 'Dead hang for 60s'],
      ['vp-flexed', 10, 3], ['vp-negative', 3, 3], ['vp-negative', 5, 3], ['vp-band', 5, 3, 'sets', 3, 'Band-assisted pull-up (30 kg band)'],
      ['vp-band', 5, 4, 'sets', 3, 'Band-assisted pull-up (20 kg band)'], ['vp-full', 1, 4, 'single', 3, 'Your first strict pull-up'],
      ['vp-full', 3, 4], ['vp-full', 5, 4, 'single', 3, '5 pull-ups in a row', true],
    ],
  },
  {
    id: 'squat', name: 'Squats', pillar: 'legs', where: 'home',
    steps: [
      ['sq-box', 10, 1], ['sq-body', 12, 1],
      ['sq-body', 15, 2], ['sq-body', 20, 2], ['sq-tempo', 10, 2], ['sq-split', 8, 2], ['sq-split', 10, 2], ['sq-split', 12, 2],
      ['sq-rfess', 8, 3], ['sq-rfess', 12, 3], ['sq-pistol-high', 5, 3],
      ['sq-pistol-low', 5, 4], ['sq-pistol-assisted', 5, 4], ['sq-pistol', 1, 4, 'single', 3, 'A pistol squat on each leg', true],
    ],
  },
  {
    id: 'hinge', name: 'Hinge', pillar: 'legs', where: 'home',
    steps: [
      ['hg-bridge', 12, 1], ['hg-pause', 15, 1],
      ['hg-single', 8, 2], ['hg-single', 12, 2],
      ['hg-band-gm', 12, 3], ['hg-band-gm', 15, 3], ['hg-slrdl-supported', 8, 3], ['hg-slrdl', 10, 4],
    ],
  },
  {
    id: 'core', name: 'Core', pillar: 'core', where: 'home',
    steps: [
      ['core-deadbug', 8, 1], ['core-deadbug', 10, 1], ['core-kneeplank', 30, 1],
      ['core-plank', 30, 2], ['core-plank', 45, 2], ['core-sideplank', 20, 2], ['core-hollow-tuck', 20, 2],
      ['core-hollow', 20, 3], ['core-hollow', 30, 3], ['core-plank', 60, 3], ['core-sideplank', 40, 3],
      ['core-hollow', 60, 4, 'single', 3, 'Hollow hold for 60s'],
    ],
  },
  {
    id: 'hang', name: 'Hanging core', pillar: 'core', where: 'bar',
    steps: [
      ['hang-kneeraise', 5, 3], ['hang-kneeraise', 8, 3], ['hang-tucksupport', 5, 3],
      ['hang-tucksupport', 10, 4], ['hang-kneeraise', 10, 4, 'single', 3, '10 hanging knee raises in a row', true],
      ['hang-tucklsit', 5, 4], ['hang-tucklsit', 10, 4, 'single', 3, 'Tuck L-sit for 10s', true],
    ],
  },
];

export const HABIT_SPECS: { key: string; block: Block; name: string; test: string }[] = [
  { key: 'habit-01', block: 1, name: 'First full week', test: '3 strength sessions in one Mon–Sun week' },
  { key: 'habit-02', block: 1, name: 'First Walk + Bar Stop', test: 'Log one evening walk' },
  { key: 'habit-03', block: 1, name: 'Weigh-in week', test: '3 weigh-ins logged in one week' },
  { key: 'habit-04', block: 1, name: 'First waist check', test: 'Log a waist measurement' },
  { key: 'habit-05', block: 2, name: '2-week streak', test: '2 weeks in a row with 3+ sessions' },
  { key: 'habit-06', block: 2, name: 'Full week', test: '3 sessions and 2 walks in one week' },
  { key: 'habit-07', block: 3, name: '4-week streak', test: '4 weeks in a row with 3+ sessions' },
  { key: 'habit-08', block: 3, name: '25 sessions', test: '25 strength sessions logged' },
  { key: 'habit-09', block: 4, name: '8-week streak', test: '8 weeks in a row with 3+ sessions' },
  { key: 'habit-10', block: 4, name: '12-week streak', test: '12 weeks in a row with 3+ sessions' },
];

function label(ex: Step, target: number, test: Test, sets: number): string {
  const u = ex.metric === 'hold' ? 's' : '';
  const side = ex.perSide ? '/side' : '';
  return test === 'single' ? `${target}${u}${side} in one set` : `${sets}×${target}${u}${side}`;
}

function build() {
  const tracks: Ladder[] = TRACK_SPECS.map((t) => ({
    id: t.id,
    name: t.name,
    pillar: t.pillar,
    where: t.where,
    steps: t.steps.map(([exId, target, block, test = 'sets', sets = 3, name, finish], i) => {
      const ex = EXERCISES[exId];
      if (!ex) throw new Error(`Unknown exercise ${exId}`);
      return {
        ...ex,
        name: name ?? ex.name,
        min: Math.max(1, Math.round(target * 0.6)),
        max: target,
        key: `${t.id}-${String(i + 1).padStart(2, '0')}`,
        n: 0,
        block,
        track: t.id,
        sets,
        test,
        label: label(ex, target, test, sets),
        finish,
      } satisfies ProgramStep;
    }),
  }));
  const habits: HabitStep[] = HABIT_SPECS.map((h) => ({ ...h, n: 0 }));

  // Number 1–100: by block, then pillar, then track, then position in the track.
  const pillarOrder = PILLARS.map((p) => p.id);
  const trackOrder = TRACK_SPECS.map((t) => t.id);
  type Item = { block: Block; p: number; t: number; i: number; set: (n: number) => void };
  const items: Item[] = [
    ...tracks.flatMap((tr) => tr.steps.map((s, i) => ({ block: s.block, p: pillarOrder.indexOf(tr.pillar), t: trackOrder.indexOf(tr.id), i, set: (n: number) => (s.n = n) }))),
    ...habits.map((h, i) => ({ block: h.block, p: pillarOrder.indexOf('habits'), t: 99, i, set: (n: number) => (h.n = n) })),
  ];
  items.sort((a, b) => a.block - b.block || a.p - b.p || a.t - b.t || a.i - b.i).forEach((it, k) => it.set(k + 1));
  return { tracks, habits, total: items.length };
}

const built = build();
export const LADDERS: Ladder[] = built.tracks;
export const HABITS: HabitStep[] = built.habits;
export const TOTAL_STEPS = built.total;

export function ladder(id: LadderId): Ladder {
  const l = LADDERS.find((x) => x.id === id);
  if (!l) throw new Error(`Unknown track ${id}`);
  return l;
}

export function pillarOf(id: LadderId): PillarId {
  return ladder(id).pillar;
}
