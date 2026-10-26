import { fmtDay, fmtDuration, weekStart } from '../dates';
import { findStep, ladder } from '../data/exercises';
import { removeSession, store } from '../store';
import { confirmSheet, esc } from './util';

const KIND: Record<string, string> = { strength: 'Strength', minimum: 'Minimum', walk: 'Walk + Bar' };

export function renderHistory(el: HTMLElement) {
  const groups = new Map<string, typeof store.sessions>();
  for (const s of store.sessions) {
    const w = weekStart(s.day);
    groups.set(w, [...(groups.get(w) ?? []), s]);
  }
  const ups = store.events;

  el.innerHTML = `
    <header class="page-head"><div><p class="eyebrow">${store.sessions.length} sessions logged</p><h1>History</h1></div></header>
    ${
      store.sessions.length === 0
        ? '<div class="card empty-state"><p>No sessions yet.</p><p class="muted">Your first one is the hardest to start. Go do it.</p></div>'
        : [...groups.entries()]
            .map(([w, list]) => {
              const strength = list.filter((s) => s.kind !== 'walk').length;
              const walks = list.filter((s) => s.kind === 'walk').length;
              const moved = ups.filter((u) => weekStart(u.day) === w && u.toIndex > u.fromIndex);
              return `
          <h3 class="section">Week of ${esc(fmtDay(w, { day: 'numeric', month: 'short' }))} <small class="muted">· ${strength} strength · ${walks} walk${walks === 1 ? '' : 's'}</small></h3>
          ${moved.map((u) => `<div class="banner good small">⬆ ${esc(ladder(u.ladderId).name)}: ${esc(ladder(u.ladderId).steps[u.toIndex].name)}</div>`).join('')}
          ${list
            .map(
              (s) => `
            <div class="card session">
              <div class="row"><b>${esc(KIND[s.kind])}</b><span class="grow"></span><small class="muted">${esc(fmtDay(s.day))} · ${fmtDuration(s.durationSec)}</small></div>
              ${s.walkMin ? `<p class="small">Walked ${s.walkMin} min</p>` : ''}
              ${
                s.entries.length
                  ? `<ul class="summary compact">${s.entries
                      .map((e) => {
                        const st = findStep(e.stepId)?.step;
                        if (!st) return '';
                        return `<li><span>${esc(st.name)}</span><b>${e.sets.map((v) => `${v}${st.metric === 'hold' ? 's' : ''}`).join(' · ')}</b></li>`;
                      })
                      .join('')}</ul>`
                  : ''
              }
              <button class="link small" data-a="del" data-id="${s.id}">Delete</button>
            </div>`,
            )
            .join('')}`;
            })
            .join('')
    }`;

  el.onclick = async (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-a=del]');
    if (!b) return;
    if (await confirmSheet('Delete session?', 'This can’t be undone.', 'Delete', true)) {
      await removeSession(b.dataset.id!);
      renderHistory(el);
    }
  };
}
