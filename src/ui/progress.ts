import { BLOCKS, HABITS, LADDERS, PILLARS, TOTAL_STEPS, ladder, type Block, type LadderId } from '../data/program';
import { dayKey, fmtDay } from '../dates';
import { uid } from '../db';
import { currentStep, dueCheckins, volume, weeklyAvgWeight } from '../logic';
import { updateBadges } from '../badge';
import { addMetric, ladderState, removeMetric, store } from '../store';
import { showDemo } from './demo';
import { NEEDS_DECISION, moveLadder, program, renderPromotions, statusLabel, trackStatus } from './promote';
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
  if (!step) return [];
  return store.sessions
    .slice()
    .reverse()
    .flatMap((s) => s.entries.filter((e) => e.stepId === step.id).map((e) => volume(e.sets)))
    .slice(-10);
}

export function renderProgress(el: HTMLElement) {
  const today = dayKey();
  const s = store.settings;
  const due = dueCheckins(store.metrics, today);
  const prog = program();
  const attention = store.ladders.filter((l) => [...NEEDS_DECISION, 'gated'].includes(trackStatus(l.id, prog).kind)).map((l) => l.id);
  const blockNo = Math.min(4, prog.block) as Block;
  void s;

  const weights = store.metrics.filter((m) => m.weightKg != null);
  const waists = store.metrics.filter((m) => m.waistCm != null);
  const avg = weeklyAvgWeight(store.metrics, today);
  const waistNow = waists[0]?.waistCm;
  const waistFirst = waists[waists.length - 1]?.waistCm;
  const waistDelta = waistNow != null && waistFirst != null && waists.length > 1 ? Math.round((waistNow - waistFirst) * 10) / 10 : null;

  el.innerHTML = `
    <header class="page-head"><div><p class="eyebrow">Steps &amp; body</p><h1>100 Steps</h1></div></header>

    ${due.length ? `<button class="banner due" data-a="gotobody"><b>${due.length}</b><span>${due.map((d) => esc(d.label)).join(' + ')} due today</span><em>Log →</em></button>` : ''}

    <div class="card score">
      <div class="score-top"><div><p class="eyebrow">Block ${blockNo} · ${esc(BLOCKS[blockNo].name)}</p><b class="score-num">${prog.score}<small>/${TOTAL_STEPS}</small></b></div></div>
      <div class="bar"><i style="width:${(prog.score / TOTAL_STEPS) * 100}%"></i></div>
      <p class="muted small">${prog.block > 4 ? 'All 100 done.' : prog.allowed >= 4 ? 'Every block is open.' : `Steps up to Block ${prog.allowed} are open. Block ${prog.allowed + 1} opens when every pillar finishes Block ${prog.block}.`}</p>
      <p class="muted small"><b>Pass a step:</b> hit the target on every set, clean form, two sessions in a row. Tests (“in one set”) pass the first time you hit them. No dates: take as long as each step needs.</p>
    </div>

    ${attention.length ? `<h3 class="section">Needs a decision</h3><div data-role="promos"></div>` : ''}

    ${PILLARS.map((p) => {
      const x = prog.pillars[p.id];
      const head = `<h3 class="section pillar-head">${esc(p.name)} <small class="muted">${x.done}/${x.total}</small></h3><div class="bar thin"><i style="width:${(x.done / x.total) * 100}%"></i></div>`;
      if (p.id === 'habits')
        return head + `<div class="card"><ul class="checklist-steps">${HABITS.map((h) => `<li class="${prog.habits[h.key] ? 'done' : ''}"><i>${prog.habits[h.key] ? '✓' : h.n}</i><span><b>${esc(h.name)}</b><small>${esc(h.test)}</small></span></li>`).join('')}</ul><p class="muted small">Ticked automatically from your log.</p></div>`;
      return head + p.tracks.map((id) => {
        const l = ladder(id);
        const st = ladderState(id);
        const step = currentStep(st);
        const status = statusLabel(trackStatus(id, prog));
        const dots = l.steps.map((_, i) => `<i class="${i < st.stepIndex ? 'past' : i === st.stepIndex ? 'now' : ''}"></i>`).join('');
        if (!step)
          return `<div class="card ladder"><div class="ladder-head"><div><p class="eyebrow">${esc(l.name)}</p><h3>🏁 Finish line passed</h3></div><span class="pill good">Done ✓</span></div><div class="dots">${dots}</div></div>`;
        const next = l.steps[st.stepIndex + 1];
        const canUp = !!next && next.block <= prog.allowed;
        return `
      <div class="card ladder">
        <div class="ladder-head">
          <div><p class="eyebrow">${esc(l.name)}${l.where === 'bar' ? ' · outdoor bars' : ''} · Step ${step.n}</p><h3>${esc(step.name)}</h3>
          <p class="muted small">${step.test === 'single' ? 'Test' : 'Target'} ${esc(step.label)} · ${st.stepIndex + 1} of ${l.steps.length} · since ${esc(fmtDay(st.since, { day: 'numeric', month: 'short' }))}</p></div>
          <span class="pill ${status.cls}">${esc(status.text)}</span>
        </div>
        <div class="dots">${dots}</div>
        ${sparkline(trend(id))}
        <div class="row gap">
          <button class="btn ghost small" data-a="demo" data-id="${id}">▶ Demo</button>
          <span class="grow"></span>
          <button class="icon-btn" data-a="down" data-id="${id}" aria-label="Step back" ${st.stepIndex === 0 ? 'disabled' : ''}>‹</button>
          <button class="icon-btn" data-a="up" data-id="${id}" aria-label="Skip ahead" ${canUp ? '' : 'disabled'}>›</button>
        </div>
      </div>`;
      }).join('');
    }).join('')}

    <h3 class="section">All 100 steps</h3>
    ${([1, 2, 3, 4] as Block[]).map((b) => {
      const items = [
        ...LADDERS.flatMap((l) => {
          const idx = ladderState(l.id).stepIndex;
          return l.steps.map((st, i) => ({ n: st.n, name: `${l.name}: ${st.name}`, detail: st.label, block: st.block, state: i < idx ? 'done' : i === idx ? 'now' : 'todo', finish: !!st.finish }));
        }),
        ...HABITS.map((h) => ({ n: h.n, name: `Habit: ${h.name}`, detail: h.test, block: h.block, state: prog.habits[h.key] ? 'done' : 'todo', finish: false })),
      ].filter((x) => x.block === b).sort((x, y) => x.n - y.n);
      const done = items.filter((x) => x.state === 'done').length;
      const locked = b > prog.allowed;
      return `<details class="card block"${b === blockNo ? ' open' : ''}><summary><b>Block ${b} · ${esc(BLOCKS[b].name)}</b><span class="muted small">${locked ? '🔒 ' : ''}${done}/${items.length}</span></summary>
        <p class="muted small">${esc(BLOCKS[b].about)}</p>
        <ul class="checklist-steps">${items.map((x) => `<li class="${x.state}${locked && x.state !== 'done' ? ' locked' : ''}"><i>${x.state === 'done' ? '✓' : x.n}</i><span><b>${x.finish ? '🏁 ' : ''}${esc(x.name)}</b><small>${esc(x.detail)}</small></span></li>`).join('')}</ul>
      </details>`;
    }).join('')}

    <h3 class="section" id="body">Body</h3>
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
    updateBadges();
  };

  el.onclick = async (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-a]');
    if (!b || (b as HTMLButtonElement).disabled || b.closest('[data-role=promos]')) return;
    const id = b.dataset.id as LadderId;
    const a = b.dataset.a;
    if (a === 'gotobody') {
      document.getElementById('body')?.scrollIntoView({ behavior: 'smooth' });
      el.querySelector<HTMLInputElement>(due[0]?.key === 'waist' ? 'input[name=waist]' : 'input[name=weight]')?.focus({ preventScroll: true });
      return;
    }
    if (a === 'demo') {
      const st = currentStep(ladderState(id));
      if (st) showDemo(st);
      return;
    }
    else if (a === 'up' || a === 'down') {
      const l = ladder(id);
      const st = ladderState(id);
      const target = l.steps[st.stepIndex + (a === 'up' ? 1 : -1)];
      if (!target) return;
      const ok = await confirmSheet(
        `${a === 'up' ? 'Skip to' : 'Back to'} step ${target.n}: ${target.name} ${target.label}?`,
        a === 'up' ? 'Only skip ahead if the current step is clearly too easy.' : 'Stepping back is fine: clean reps beat ugly ones.',
        a === 'up' ? 'Skip ahead' : 'Step back',
      );
      if (!ok) return;
      if (target.needsBands && !store.settings.hasBands) toast('Heads up: this step needs bands');
      await moveLadder(id, a === 'up' ? 1 : -1);
      renderProgress(el);
    } else if (a === 'delm') {
      await removeMetric(b.dataset.id!);
      renderProgress(el);
      updateBadges();
    }
  };
}
