import { ladder, unit, type LadderId } from '../data/exercises';
import { addDays, dayKey } from '../dates';
import { uid } from '../db';
import { currentStep, ladderStatus, type LadderStatus } from '../logic';
import { addEvent, ladderState, setLadder, store, updateSettings } from '../store';
import { esc, toast } from './util';

export async function moveLadder(id: LadderId, delta: number) {
  const st = ladderState(id);
  const max = ladder(id).steps.length - 1;
  const to = Math.max(0, Math.min(max, st.stepIndex + delta));
  if (to === st.stepIndex) return;
  const today = dayKey();
  await setLadder({ ...st, stepIndex: to, since: today });
  await addEvent({ id: uid(), day: today, ladderId: id, fromIndex: st.stepIndex, toIndex: to });
}

export function statusLabel(s: LadderStatus): { text: string; cls: string } {
  switch (s.kind) {
    case 'ready':
      return { text: 'Ready to move up', cls: 'good' };
    case 'needs-bands':
      return { text: 'Ready — needs bands', cls: 'good' };
    case 'maxed':
      return { text: 'Top of ladder', cls: 'good' };
    case 'stalled':
      return { text: `Stalled ${Math.floor(s.days / 7)} wks`, cls: 'warn' };
    case 'working':
      return { text: s.sessionsAtTop ? 'Hit the top once — 1 more' : 'Building', cls: '' };
  }
}

/** Cards with progression actions for the given ladders. */
export function renderPromotions(el: HTMLElement, ids: LadderId[], onDone?: () => void) {
  const today = dayKey();
  const draw = () => {
    el.innerHTML = ids
      .map((id) => {
        const st = ladderState(id);
        const step = currentStep(st);
        const s = ladderStatus(st, store.sessions, store.settings, today);
        const name = ladder(id).name;
        if (s.kind === 'ready')
          return `<div class="card promo"><p class="eyebrow">${esc(name)}</p>
            <p>You hit <b>${step.max}${esc(unit(step))}</b> on every set, two sessions running. Move up from <b>${esc(step.name)}</b> to <b>${esc(s.next.name)}</b>?</p>
            <div class="row gap"><button class="btn ghost" data-a="later" data-id="${id}">Not yet</button><button class="btn primary grow" data-a="up" data-id="${id}">Move up</button></div></div>`;
        if (s.kind === 'needs-bands')
          return `<div class="card promo"><p class="eyebrow">${esc(name)}</p>
            <p>You’ve outgrown <b>${esc(step.name)}</b>. The next step, <b>${esc(s.next.name)}</b>, needs resistance bands.</p>
            <div class="row gap"><button class="btn ghost" data-a="later" data-id="${id}">Not yet</button><button class="btn primary grow" data-a="bands" data-id="${id}">I have bands — move up</button></div></div>`;
        if (s.kind === 'stalled')
          return `<div class="card promo warn"><p class="eyebrow">${esc(name)}</p>
            <p>No progress on <b>${esc(step.name)}</b> for ${Math.floor(s.days / 7)} weeks. Drop to 2 sets for one week, then go again.</p>
            <div class="row gap"><button class="btn ghost" data-a="later" data-id="${id}">Ignore</button>${
              store.settings.deloadUntil && store.settings.deloadUntil >= today
                ? '<span class="pill">Deload week on</span>'
                : `<button class="btn primary grow" data-a="deload">Start deload week</button>`
            }</div></div>`;
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
      await moveLadder(id, 1);
      toast(`${ladder(id).name}: now ${currentStep(ladderState(id)).name}`);
      ids = ids.filter((x) => x !== id);
    } else if (b.dataset.a === 'bands' && id) {
      await updateSettings({ hasBands: true });
      await moveLadder(id, 1);
      toast('Bands on — ladder moved up');
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
