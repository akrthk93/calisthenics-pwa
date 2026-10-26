import { LADDERS, ladder, unit, type LadderId } from '../data/exercises';
import { dayKey, fmtDay } from '../dates';
import { uid } from '../db';
import { currentStep, ladderStatus, volume, weeklyAvgWeight } from '../logic';
import { addMetric, ladderState, removeMetric, store } from '../store';
import { showDemo } from './demo';
import { moveLadder, renderPromotions, statusLabel } from './promote';
import { confirmSheet, esc, toast } from './util';

/** Tiny inline SVG sparkline. */
function sparkline(values: number[]): string {
  if (values.length < 2) return '<div class="spark empty">Log 2+ sessions to see a trend</div>';
  const w = 120;
  const h = 32;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - 3 - ((v - min) / span) * (h - 6)}`).join(' ');
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}"/></svg>`;
}

/** Total volume per session for the current step of a ladder, oldest → newest, last 10. */
function trend(id: LadderId): number[] {
  const step = currentStep(ladderState(id));
  return store.sessions
    .slice()
    .reverse()
    .flatMap((s) => s.entries.filter((e) => e.stepId === step.id).map((e) => volume(e.sets)))
    .slice(-10);
}

export function renderProgress(el: HTMLElement) {
  const today = dayKey();
  const s = store.settings;
  const attention = store.ladders
    .filter((l) => ['ready', 'needs-bands', 'stalled'].includes(ladderStatus(l, store.sessions, s, today).kind))
    .map((l) => l.id);

  const weights = store.metrics.filter((m) => m.weightKg != null);
  const waists = store.metrics.filter((m) => m.waistCm != null);
  const avg = weeklyAvgWeight(store.metrics, today);
  const waistNow = waists[0]?.waistCm;
  const waistFirst = waists[waists.length - 1]?.waistCm;
  const waistDelta = waistNow != null && waistFirst != null && waists.length > 1 ? Math.round((waistNow - waistFirst) * 10) / 10 : null;

  el.innerHTML = `
    <header class="page-head"><div><p class="eyebrow">Ladders &amp; body</p><h1>Progress</h1></div></header>

    ${attention.length ? `<h3 class="section">Needs a decision</h3><div data-role="promos"></div>` : ''}

    <h3 class="section">Ladders</h3>
    <p class="muted small">Move up after hitting the top of the range on every set, with clean form, two sessions in a row.</p>
    ${LADDERS.map((l) => {
      const st = ladderState(l.id);
      const step = currentStep(st);
      const status = statusLabel(ladderStatus(st, store.sessions, s, today));
      const dots = l.steps.map((_, i) => `<i class="${i < st.stepIndex ? 'past' : i === st.stepIndex ? 'now' : ''}"></i>`).join('');
      return `
      <div class="card ladder">
        <div class="ladder-head">
          <div><p class="eyebrow">${esc(l.name)}${l.where === 'bar' ? ' · outdoor bars' : ''}</p><h3>${esc(step.name)}</h3>
          <p class="muted small">Step ${st.stepIndex + 1} of ${l.steps.length} · ${step.min}–${step.max}${esc(unit(step))} · since ${esc(fmtDay(st.since, { day: 'numeric', month: 'short' }))}</p></div>
          <span class="pill ${status.cls}">${esc(status.text)}</span>
        </div>
        <div class="dots">${dots}</div>
        ${sparkline(trend(l.id))}
        <div class="row gap">
          <button class="btn ghost small" data-a="demo" data-id="${l.id}">▶ Demo</button>
          <span class="grow"></span>
          <button class="icon-btn" data-a="down" data-id="${l.id}" aria-label="Step down" ${st.stepIndex === 0 ? 'disabled' : ''}>‹</button>
          <button class="icon-btn" data-a="up" data-id="${l.id}" aria-label="Step up" ${st.stepIndex === l.steps.length - 1 ? 'disabled' : ''}>›</button>
        </div>
      </div>`;
    }).join('')}

    <h3 class="section">Body</h3>
    <div class="card">
      <div class="stats">
        <div><small>Weight · 7-day avg</small><b>${avg != null ? `${avg} kg` : '—'}</b></div>
        <div><small>Waist (navel)</small><b>${waistNow != null ? `${waistNow} cm` : '—'}</b>${waistDelta != null ? `<small class="${waistDelta <= 0 ? 'good' : 'warn'}">${waistDelta > 0 ? '+' : ''}${waistDelta} since start</small>` : ''}</div>
      </div>
      <p class="muted small">Weigh 3×/week, waist monthly. Trust the tape over the scale.</p>
      <form class="metric-form" data-role="metric">
        <input class="input" name="weight" type="number" inputmode="decimal" step="0.1" min="30" max="200" placeholder="Weight kg">
        <input class="input" name="waist" type="number" inputmode="decimal" step="0.5" min="40" max="200" placeholder="Waist cm">
        <button class="btn primary" type="submit">Log</button>
      </form>
      ${
        store.metrics.length
          ? `<details><summary>Entries (${store.metrics.length})</summary><ul class="metric-list">${store.metrics
              .slice(0, 30)
              .map(
                (m) =>
                  `<li><span>${esc(fmtDay(m.day))}</span><span>${m.weightKg != null ? `${m.weightKg} kg` : ''}${m.weightKg != null && m.waistCm != null ? ' · ' : ''}${m.waistCm != null ? `${m.waistCm} cm` : ''}</span><button class="link" data-a="delm" data-id="${m.id}">Delete</button></li>`,
              )
              .join('')}</ul></details>`
          : ''
      }
    </div>
    <p class="muted small center">${weights.length} weigh-in${weights.length === 1 ? '' : 's'} logged</p>`;

  const promos = el.querySelector<HTMLElement>('[data-role=promos]');
  if (promos) renderPromotions(promos, attention as LadderId[], () => setTimeout(() => renderProgress(el), 0));

  el.querySelector<HTMLFormElement>('[data-role=metric]')!.onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target as HTMLFormElement);
    const w = parseFloat(String(f.get('weight')));
    const c = parseFloat(String(f.get('waist')));
    if (isNaN(w) && isNaN(c)) return toast('Enter weight or waist');
    await addMetric({ id: uid(), day: today, ...(isNaN(w) ? {} : { weightKg: w }), ...(isNaN(c) ? {} : { waistCm: c }) });
    toast('Logged');
    renderProgress(el);
  };

  el.onclick = async (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-a]');
    if (!b || (b as HTMLButtonElement).disabled || b.closest('[data-role=promos]')) return;
    const id = b.dataset.id as LadderId;
    const a = b.dataset.a;
    if (a === 'demo') showDemo(currentStep(ladderState(id)));
    else if (a === 'up' || a === 'down') {
      const l = ladder(id);
      const st = ladderState(id);
      const target = l.steps[st.stepIndex + (a === 'up' ? 1 : -1)];
      const ok = await confirmSheet(
        `${a === 'up' ? 'Move up' : 'Step back'} to ${target.name}?`,
        a === 'up' ? 'Only skip ahead if the current step is clearly too easy.' : 'Stepping back is fine — clean reps beat ugly ones.',
        a === 'up' ? 'Move up' : 'Step back',
      );
      if (!ok) return;
      if (target.needsBands && !store.settings.hasBands) toast('Heads up: this step needs bands');
      await moveLadder(id, a === 'up' ? 1 : -1);
      renderProgress(el);
    } else if (a === 'delm') {
      await removeMetric(b.dataset.id!);
      renderProgress(el);
    }
  };
}
