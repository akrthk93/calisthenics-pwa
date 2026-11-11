import { unit } from '../data/exercises';
import { BLOCKS, ladder, type LadderId } from '../data/program';
import { addDays, dayKey } from '../dates';
import { uid } from '../db';
import { currentStep, ladderStatus, programState, type LadderStatus, type ProgramState } from '../logic';
import { addEvent, ladderState, setLadder, store, updateSettings } from '../store';
import { esc, toast } from './util';

/** Overall program position from the store. */
export function program(): ProgramState {
  return programState(store.ladders, store.sessions, store.metrics);
}

export function trackStatus(id: LadderId, p: ProgramState = program()): LadderStatus {
  return ladderStatus(ladderState(id), store.sessions, store.settings, dayKey(), p.allowed);
}

/** Statuses that ask for a decision. */
export const NEEDS_DECISION = ['ready', 'finish', 'needs-bands', 'stalled'];

/** Move a track by `delta` steps. Moving past the last step completes the track. */
export async function moveLadder(id: LadderId, delta: number) {
  const st = ladderState(id);
  const steps = ladder(id).steps;
  const to = Math.max(0, Math.min(steps.length, st.stepIndex + delta));
  if (to === st.stepIndex) return;
  const today = dayKey();
  await setLadder({ ...st, stepIndex: to, since: today });
  await addEvent({ id: uid(), day: today, ladderId: id, fromIndex: st.stepIndex, toIndex: to, stepKey: steps[to]?.key ?? `${id}-done` });
}

export function statusLabel(s: LadderStatus): { text: string; cls: string } {
  switch (s.kind) {
    case 'ready':
      return { text: 'Passed: move on', cls: 'good' };
    case 'finish':
      return { text: 'Finish line hit!', cls: 'good' };
    case 'needs-bands':
      return { text: 'Passed: needs bands', cls: 'good' };
    case 'gated':
      return { text: `Passed · Block ${s.block} locked`, cls: '' };
    case 'locked':
      return { text: `Unlocks in Block ${s.block}`, cls: '' };
    case 'complete':
      return { text: 'Done ✓', cls: 'good' };
    case 'stalled':
      return { text: `Stalled ${Math.floor(s.days / 7)} wks`, cls: 'warn' };
    case 'working':
      return { text: s.sessionsAtTop ? 'Hit it once: 1 more' : 'Building', cls: '' };
  }
}

/** Cards with progression actions for the given tracks. */
export function renderPromotions(el: HTMLElement, ids: LadderId[], onDone?: () => void) {
  const today = dayKey();
  const draw = () => {
    const p = program();
    el.innerHTML =
      ids
        .map((id) => {
          const st = ladderState(id);
          const step = currentStep(st);
          if (!step) return '';
          const s = trackStatus(id, p);
          const name = ladder(id).name;
          const head = `<p class="eyebrow">${esc(name)} · Step ${step.n}</p>`;
          const hit = step.test === 'single' ? `You hit <b>${esc(step.label)}</b>.` : `You hit <b>${step.max}${esc(unit(step))}</b> on every set, two sessions running.`;
          if (s.kind === 'ready')
            return `<div class="card promo">${head}
            <p>${hit} Clean form on every rep? Then <b>${esc(step.name)}</b> is cleared.</p>
            <p class="muted small">Next: Step ${s.next.n} · ${esc(s.next.name)} ${esc(s.next.label)}</p>
            <div class="row gap"><button class="btn ghost" data-a="later" data-id="${id}">Not yet</button><button class="btn primary grow" data-a="up" data-id="${id}">Clear step ${step.n}</button></div></div>`;
          if (s.kind === 'finish')
            return `<div class="card promo finish">${head}
            <h3>🏁 ${esc(step.name)}</h3>
            <p>That’s the ${esc(name.toLowerCase())} finish line. Clean form on every rep?</p>
            <div class="row gap"><button class="btn ghost" data-a="later" data-id="${id}">Not yet</button><button class="btn primary grow" data-a="up" data-id="${id}">Mark it done</button></div></div>`;
          if (s.kind === 'needs-bands')
            return `<div class="card promo">${head}
            <p>${hit} The next step, <b>${esc(s.next.name)}</b>, needs resistance bands.</p>
            <div class="row gap"><button class="btn ghost" data-a="later" data-id="${id}">Not yet</button><button class="btn primary grow" data-a="bands" data-id="${id}">I have bands: move on</button></div></div>`;
          if (s.kind === 'stalled')
            return `<div class="card promo warn">${head}
            <p>No progress on <b>${esc(step.name)}</b> for ${Math.floor(s.days / 7)} weeks. Drop to 2 sets for one week, then go again.</p>
            <div class="row gap"><button class="btn ghost" data-a="later" data-id="${id}">Ignore</button>${
              store.settings.deloadUntil && store.settings.deloadUntil >= today
                ? '<span class="pill">Deload week on</span>'
                : `<button class="btn primary grow" data-a="deload">Start deload week</button>`
            }</div></div>`;
          if (s.kind === 'gated')
            return `<div class="card promo">${head}
            <p>${hit} Step ${step.n} is done, but the next one is in Block ${s.block} (${esc(BLOCKS[s.block].name)}). It unlocks once every pillar has finished Block ${s.block - 2}. Keep this step ticking over until then.</p></div>`;
          return '';
        })
        .join('') || '<p class="muted">All caught up.</p>';
  };
  draw();
  el.onclick = async (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-a]');
    if (!b) return;
    const id = b.dataset.id as LadderId | undefined;
    if (b.dataset.a === 'up' && id) {
      const n = currentStep(ladderState(id))?.n;
      await moveLadder(id, 1);
      const next = currentStep(ladderState(id));
      toast(next ? `Step ${n} cleared. Next: ${next.name} ${next.label}` : `${ladder(id).name}: finish line done 🏁`);
      ids = ids.filter((x) => x !== id);
    } else if (b.dataset.a === 'bands' && id) {
      await updateSettings({ hasBands: true });
      await moveLadder(id, 1);
      toast('Bands on: step cleared');
      ids = ids.filter((x) => x !== id);
    } else if (b.dataset.a === 'deload') {
      await updateSettings({ deloadUntil: addDays(today, 6) });
      toast('2 sets per exercise until ' + addDays(today, 6));
    } else if (b.dataset.a === 'later' && id) {
      ids = ids.filter((x) => x !== id);
    }
    draw();
    onDone?.();
  };
}
