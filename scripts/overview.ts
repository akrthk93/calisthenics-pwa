// Writes docs/100-STEPS.md from the program data, so the printable list never drifts from the app.
// Run: npm run overview
import { writeFileSync } from 'node:fs';
import { BLOCKS, HABITS, LADDERS, PILLARS, TOTAL_STEPS, type Block } from '../src/data/program';

const rows = [
  ...LADDERS.flatMap((l) => l.steps.map((s) => ({ n: s.n, block: s.block, text: `**${l.name}:** ${s.name}: ${s.label}${s.finish ? ' 🏁' : ''}${l.where === 'bar' ? ' _(bars)_' : ''}` }))),
  ...HABITS.map((h) => ({ n: h.n, block: h.block, text: `**Habit:** ${h.name}: ${h.test}` })),
].sort((a, b) => a.n - b.n);

const finish = LADDERS.flatMap((l) => l.steps.filter((s) => s.finish).map((s) => `- ${s.name} (step ${s.n})`));
const pillarLine = PILLARS.map((p) => {
  const n = p.id === 'habits' ? HABITS.length : LADDERS.filter((l) => l.pillar === p.id).reduce((a, l) => a + l.steps.length, 0);
  return `${p.name} ${n}`;
}).join(' · ');

const out = `# 100 Steps

${TOTAL_STEPS} steps in 4 blocks across 5 pillars (${pillarLine}). No dates: each step takes as long as it takes.

## Finish lines
${finish.join('\n')}
- A 12-week streak of 3+ sessions a week

## The rules
- **Week:** strength on Mon/Wed/Fri mornings (about 20 min). Walk + Bar Stop on 2–3 evenings: the pull-up, dip and hanging-core tracks are done at the outdoor bars.
- **Pass a step:** hit the target on every set with clean form, two sessions in a row. Then clear it and start the next one.
- **Tests** (marked "in one set" or "single"): pass the first time you hit the number once.
- **Habits** tick themselves from your log.
- **Block gate:** a pillar can be at most one block ahead of your slowest pillar. Block 3 opens when every pillar (habits included) has finished Block 1, and so on.
- **Stalled:** no progress on a step for 3 weeks → take a deload week (2 sets), or step back one step and rebuild.
- **Missed a session:** never miss twice. The 5-minute minimum session counts for the streak.

${([1, 2, 3, 4] as Block[]).map((b) => `## Block ${b}: ${BLOCKS[b].name}
_${BLOCKS[b].about}_

${rows.filter((r) => r.block === b).map((r) => `- [ ] ${r.n}. ${r.text}`).join('\n')}
`).join('\n')}`;

writeFileSync('docs/100-STEPS.md', out);
console.log(`wrote docs/100-STEPS.md (${rows.length} steps)`);
