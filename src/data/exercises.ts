export type Metric = 'reps' | 'hold';

export interface Video {
  id: string;
  /** Start offset in seconds, for a section of a longer video. */
  start?: number;
  /** Shown under the player, e.g. where this step appears in a progression video. */
  note?: string;
}

// Verified Hybrid Calisthenics (Hampton) videos.
const HC_PUSHUPS: Video = { id: '0GsVJsS6474', note: 'Hampton’s pushup progression: wall → incline → kneeling pushups.' };
const HC_PUSHUPS_COURSE: Video = { id: 'ze4qofHM20k', note: 'Pushups from very easy to very hard. Full pushups and narrow (diamond-style) variations come mid-video.' };
const HC_PULLUPS: Video = { id: 'CGAqIFxl43Q', note: 'Hampton’s pullup progression: wall pullups → horizontal pullups → jackknife → full pullups.' };
const HC_SQUATS = 'z3XQ7T4-abQ';

export interface Step {
  id: string;
  name: string;
  metric: Metric;
  /** Target range: reps, or seconds for holds. */
  min: number;
  max: number;
  perSide?: boolean;
  needsBands?: boolean;
  cues: string[];
  /** YouTube search used when no demo video has been set. */
  search: string;
  /** Default demo clip (Hybrid Calisthenics). Users can override per step in-app. */
  video?: Video;
  /** Short silent looping demo (Imgur id) from hybridcalisthenics.com. */
  loop?: string;
}

export type LadderId = 'push' | 'row' | 'vpull' | 'squat' | 'hinge' | 'core';

export interface Ladder {
  id: LadderId;
  name: string;
  where: 'home' | 'bar';
  steps: Step[];
}

export const LADDERS: Ladder[] = [
  {
    id: 'push',
    name: 'Push',
    where: 'home',
    steps: [
      {
        id: 'push-wall', name: 'Wall pushup', metric: 'reps', min: 6, max: 12,
        cues: ['Hands at shoulder height, slightly wider than shoulders', 'Body straight from head to heels', 'Chest close to the wall, elbows ~45° from body'],
        search: 'wall push up proper form beginner',
        loop: 'CRilC1v',
        video: { ...HC_PUSHUPS, note: 'Wall pushups open the progression.' },
      },
      {
        id: 'push-counter', name: 'Counter incline pushup', metric: 'reps', min: 6, max: 12,
        cues: ['Hands on the kitchen counter edge', 'Squeeze glutes so hips don’t sag', 'Lower until chest nearly touches the counter'],
        search: 'incline push up kitchen counter form',
        loop: 'CiG06sW',
        video: { ...HC_PUSHUPS, note: 'Incline pushups come right after wall pushups. Hampton’s base is about sternum height.' },
      },
      {
        id: 'push-table', name: 'Table incline pushup', metric: 'reps', min: 6, max: 12,
        cues: ['Use a solid table or desk that can’t slide', 'Plank-straight body', 'Full range: chest to the edge, arms straight at top'],
        search: 'incline push up table form',
        loop: 'm6jfEMA',
        video: { ...HC_PUSHUPS, note: 'Incline pushups section. Same movement, lower base.' },
      },
      {
        id: 'push-low', name: 'Low incline pushup (sofa/step)', metric: 'reps', min: 6, max: 12,
        cues: ['Brace the sofa or step against a wall so it can’t move', 'Add 3–5 sec negatives on the last set', 'Keep elbows tucked ~45°'],
        search: 'low incline push up progression',
        loop: 'm6jfEMA',
        video: HC_PUSHUPS_COURSE,
      },
      {
        id: 'push-floor', name: 'Floor pushup', metric: 'reps', min: 5, max: 12,
        cues: ['Hands under shoulders', 'Body moves as one plank', 'Chest to fist height, full lockout at top'],
        search: 'perfect push up form beginner',
        loop: 'KoqifTm',
        video: HC_PUSHUPS_COURSE,
      },
      {
        id: 'push-pause', name: 'Pause pushup', metric: 'reps', min: 6, max: 12,
        cues: ['Pause 2 sec at the bottom, chest just off the floor', 'Stay tight during the pause', 'Drive up hard'],
        search: 'pause push up',
        loop: 'KoqifTm',
        video: HC_PUSHUPS_COURSE,
      },
      {
        id: 'push-diamond', name: 'Diamond pushup', metric: 'reps', min: 5, max: 12,
        cues: ['Thumbs and index fingers form a diamond under the chest', 'Elbows stay close to ribs', 'Use incline first if wrists complain'],
        search: 'diamond push up form',
        loop: '47ZKzYb',
        video: HC_PUSHUPS_COURSE,
      },
    ],
  },
  {
    id: 'row',
    name: 'Row',
    where: 'home',
    steps: [
      {
        id: 'row-door', name: 'Doorframe row', metric: 'reps', min: 8, max: 15,
        cues: ['Grip both sides of the frame, feet near the threshold', 'Lean back with straight arms, body rigid', 'Pull chest to the frame, squeeze shoulder blades', 'Feet closer to the frame = harder'],
        search: 'doorframe row bodyweight',
        loop: 'EXSOWBj',
        video: { ...HC_PULLUPS, note: 'Wall pullups (first step) are the same idea as a doorframe row: grip, lean back, pull.' },
      },
      {
        id: 'row-seated', name: 'Seated band row (light)', metric: 'reps', min: 8, max: 15, needsBands: true,
        cues: ['Sit tall, band looped around your feet', 'Pull elbows back past your ribs', 'Shoulders down and back, no shrugging'],
        search: 'seated resistance band row form',
        video: { id: 'PKZW3s3G_Y0', note: 'Scott Abel Coaching: seated band rows, with and without an anchor.' },
      },
      {
        id: 'row-standing-light', name: 'Standing band row, door anchor (light)', metric: 'reps', min: 8, max: 15, needsBands: true,
        cues: ['Anchor at chest height, close the door fully', 'Slight knee bend, chest up', 'Pull to lower ribs, control the return'],
        search: 'standing resistance band row door anchor',
        video: { id: 'k7EPhs1i9mU', note: 'Standing band row with a door anchor.' },
      },
      {
        id: 'row-standing-medium', name: 'Standing band row (medium)', metric: 'reps', min: 8, max: 15, needsBands: true,
        cues: ['Same setup, medium band', 'Step back for more tension', 'No leaning back to cheat'],
        search: 'standing resistance band row door anchor',
        video: { id: 'k7EPhs1i9mU', note: 'Standing band row with a door anchor.' },
      },
      {
        id: 'row-squeeze', name: 'Band row + 2s squeeze (medium)', metric: 'reps', min: 8, max: 15, needsBands: true,
        cues: ['Hold 2 sec with shoulder blades squeezed', 'Slow 2–3 sec return', 'Elbows close to body'],
        search: 'band row pause squeeze',
        video: { id: 'k7EPhs1i9mU', note: 'Same row. Add the 2-second squeeze at the top.' },
      },
    ],
  },
  {
    id: 'vpull',
    name: 'Vertical pull',
    where: 'bar',
    steps: [
      {
        id: 'vp-hang', name: 'Dead hang', metric: 'hold', min: 15, max: 30,
        cues: ['Overhand grip, shoulder width', 'Toes can touch the ground at first', 'Relax the legs, breathe'],
        search: 'dead hang beginner',
        video: { id: 'g0I7Jv3oqKw', start: 22, note: 'Move All Ways: grip and form from 0:22, beginner hold times at 1:15.' },
      },
      {
        id: 'vp-scap', name: 'Scapular pull', metric: 'reps', min: 6, max: 10,
        cues: ['Hang with straight arms', 'Pull shoulders down away from ears', 'Body rises a few cm, elbows stay straight'],
        search: 'scapular pull ups',
        video: { id: '-ZIpSoTRsuE', start: 38, note: 'Zack Henderson: technique section (0:38).' },
      },
      {
        id: 'vp-inverted', name: 'Inverted row (low bar)', metric: 'reps', min: 8, max: 12,
        cues: ['Hang under a waist-height bar, heels on the ground', 'Body straight like a plank', 'Pull chest to the bar', 'More horizontal = harder'],
        search: 'inverted row low bar beginner',
        loop: '8BTDOna',
        video: { ...HC_PULLUPS, note: 'Horizontal pullups section: chest-height bar first, then hip height.' },
      },
      {
        id: 'vp-negative', name: 'Negative pull-up', metric: 'reps', min: 3, max: 5,
        cues: ['Step or jump to chin over bar', 'Lower over a full 5 seconds', 'Step down; don’t drop from the top'],
        search: 'negative pull up how to',
        video: { id: 'yT5AnS9OwAw', note: 'Unity Gym: Pull Ups For Beginners, part 3 — negatives.' },
      },
      {
        id: 'vp-band', name: 'Band-assisted pull-up', metric: 'reps', min: 5, max: 8, needsBands: true,
        cues: ['Loop a long band over the bar, knee or foot in it', 'Start with medium band, move to light', 'Chin over bar, full hang at bottom'],
        search: 'band assisted pull up setup',
        video: { id: 'H4gbznM-wkI', note: 'Dante’s Gym: band-assisted pull-ups.' },
      },
      {
        id: 'vp-full', name: 'Pull-up', metric: 'reps', min: 1, max: 8,
        cues: ['Full hang to chin over bar', 'No kipping', 'Do as many as you can, minus one'],
        search: 'pull up proper form',
        loop: '2bVJBWx',
        video: { ...HC_PULLUPS, note: 'Full pullups close out the progression.' },
      },
    ],
  },
  {
    id: 'squat',
    name: 'Squat',
    where: 'home',
    steps: [
      {
        id: 'sq-box', name: 'Box squat (to chair)', metric: 'reps', min: 8, max: 12,
        cues: ['Feet shoulder width, sit back to the chair', 'Touch, don’t flop', 'Stand up through the heels'],
        search: 'box squat to chair form',
        loop: 'KjUMRFA',
        video: { id: HC_SQUATS, start: 250, note: 'Chair squats (4:10). Same as a box squat to a chair.' },
      },
      {
        id: 'sq-body', name: 'Bodyweight squat', metric: 'reps', min: 8, max: 12,
        cues: ['Knees track over toes', 'Heels stay down', 'Hip crease below knee if comfortable'],
        search: 'bodyweight squat form',
        loop: '19qy7fY',
        video: { id: HC_SQUATS, start: 330, note: 'Half squats (5:30) into full squats (6:15).' },
      },
      {
        id: 'sq-tempo', name: 'Tempo squat (3s down, 1s pause)', metric: 'reps', min: 8, max: 12,
        cues: ['Count 3 seconds on the way down', 'Pause 1 sec at the bottom', 'Stand up normally'],
        search: 'tempo squat bodyweight',
        loop: '19qy7fY',
        video: { id: HC_SQUATS, start: 375, note: 'Full squats (6:15). Add the 3-second lower and 1-second pause.' },
      },
      {
        id: 'sq-split', name: 'Split squat', metric: 'reps', min: 8, max: 12, perSide: true,
        cues: ['Long stance, back heel up', 'Drop back knee straight down', 'Front heel stays planted'],
        search: 'split squat form',
        video: { id: '4aqrcebiFZo', note: 'Born Fitness: split squat in 3 steps.' },
      },
      {
        id: 'sq-rfess', name: 'Rear-foot elevated split squat', metric: 'reps', min: 8, max: 12, perSide: true,
        cues: ['Back foot laces-down on the sofa', 'Most weight on the front leg', 'Torso slightly forward'],
        search: 'bulgarian split squat bodyweight form',
        video: { id: 'oGTVhFgRnes', note: 'Bodyweight Bulgarian (rear-foot elevated) split squat.' },
      },
    ],
  },
  {
    id: 'hinge',
    name: 'Hinge',
    where: 'home',
    steps: [
      {
        id: 'hg-bridge', name: 'Glute bridge', metric: 'reps', min: 10, max: 15,
        cues: ['Feet flat, heels close to glutes', 'Drive through heels, squeeze glutes', 'Ribs down — don’t arch the lower back'],
        search: 'glute bridge form',
        loop: 'gQQFZo6',
      },
      {
        id: 'hg-pause', name: 'Glute bridge, 2s pause', metric: 'reps', min: 10, max: 15,
        cues: ['Hold 2 sec at the top', 'Hips level', 'Slow lower'],
        search: 'glute bridge pause hold',
        loop: 'gQQFZo6',
      },
      {
        id: 'hg-single', name: 'Single-leg glute bridge', metric: 'reps', min: 10, max: 15, perSide: true,
        cues: ['Other knee pulled to chest or leg straight', 'Hips stay level', 'Push through the working heel'],
        search: 'single leg glute bridge form',
        video: { id: 'nat5dN0Kuao', start: 44, note: 'Onnit: single-leg glute bridge technique (0:44).' },
      },
      {
        id: 'hg-band-gm', name: 'Band good morning', metric: 'reps', min: 10, max: 15, needsBands: true,
        cues: ['Band under feet, loop behind neck', 'Soft knees, push hips back', 'Flat back, stand tall by squeezing glutes'],
        search: 'resistance band good morning form',
        video: { id: 'jKBQUap7zMo', note: 'Resistance band good morning.' },
      },
    ],
  },
  {
    id: 'core',
    name: 'Core',
    where: 'home',
    steps: [
      {
        id: 'core-deadbug', name: 'Dead bug', metric: 'reps', min: 6, max: 8, perSide: true,
        cues: ['Lower back pressed into the floor', 'Opposite arm and leg extend slowly', 'Exhale as you extend'],
        search: 'dead bug exercise form',
        video: { id: '-gRN_JyVTLY', start: 124, note: 'Jack Hanrahan: setup (2:04), execution (3:26), common mistakes after.' },
      },
      {
        id: 'core-kneeplank', name: 'Kneeling plank', metric: 'hold', min: 20, max: 30,
        cues: ['Elbows under shoulders', 'Straight line knees to head', 'Squeeze glutes, brace abs'],
        search: 'kneeling plank form',
        video: { id: 'C6bPL-IQkWM', note: 'Coach Nick: kneeling plank and 3 common mistakes.' },
      },
      {
        id: 'core-plank', name: 'Plank', metric: 'hold', min: 30, max: 45,
        cues: ['Elbows under shoulders', 'Hips level, not piked', 'Breathe behind the brace'],
        search: 'plank proper form',
        video: { id: '6LqqeBtFn9M', note: 'Get Exercise Confident: plank technique and common mistakes.' },
      },
      {
        id: 'core-hollow', name: 'Hollow body hold', metric: 'hold', min: 20, max: 30,
        cues: ['Lower back glued to floor', 'Arms overhead, legs low but not touching', 'Tuck knees to make it easier'],
        search: 'hollow body hold beginner',
        video: { id: 'MY6_stJuy7M', note: 'Unity Gym: hollow body tutorial.' },
      },
    ],
  },
];

export const PULL_APART: Step = {
  id: 'pull-apart', name: 'Band pull-apart', metric: 'reps', min: 15, max: 20, needsBands: true,
  cues: ['Arms straight at shoulder height', 'Pull band to chest by squeezing shoulder blades', 'Slow return'],
  search: 'band pull apart form',
  video: { id: 'yIVdFq14LiE', note: 'GaglioneStrength: band pull-apart guide.' },
};

export const WARMUP = [
  { name: 'Arm circles', detail: '10 each way' },
  { name: 'Cat-cow', detail: '8 slow reps' },
  { name: 'Bodyweight good mornings', detail: '10 reps' },
  { name: 'Squats to a chair', detail: '8 reps' },
];

export const COOLDOWN = [
  { name: 'Hip flexor stretch — left', seconds: 30 },
  { name: 'Hip flexor stretch — right', seconds: 30 },
  { name: 'Doorway chest stretch', seconds: 30 },
  { name: 'Child’s pose', seconds: 30 },
];

export function ladder(id: LadderId): Ladder {
  const l = LADDERS.find((x) => x.id === id);
  if (!l) throw new Error(`Unknown ladder ${id}`);
  return l;
}

export function findStep(stepId: string): { ladder?: Ladder; step: Step; index: number } | undefined {
  if (stepId === PULL_APART.id) return { step: PULL_APART, index: 0 };
  for (const l of LADDERS) {
    const i = l.steps.findIndex((s) => s.id === stepId);
    if (i >= 0) return { ladder: l, step: l.steps[i], index: i };
  }
  return undefined;
}

export function unit(step: Step): string {
  const u = step.metric === 'hold' ? 's' : '';
  return step.perSide ? `${u} per side` : u;
}
