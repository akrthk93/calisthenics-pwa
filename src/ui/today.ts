import { LADDERS, unit } from '../data/exercises';
import { addDays, dayKey, fmtDay, isStrengthDay, parseDay, weekStart } from '../dates';
import { countsAsStrength, currentStep, ladderStatus, missedLastSlot, plannedSets, weekStreak } from '../logic';
import { store } from '../store';
import { discardRun, pendingRun, startRun } from './session';
import { esc } from './util';
import { navigate } from '../router';

const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Morning' : h < 18 ? 'Afternoon' : 'Evening';
}

function nextStrengthDay(today: string): string {
  let d = addDays(today, 1);
  while (!isStrengthDay(d)) d = addDays(d, 1);
  return d;
}

export function renderToday(el: HTMLElement) {
  const today = dayKey();
  const s = store.settings;
  const sessions = store.sessions;
  const ws = weekStart(today);
  const thisWeek = sessions.filter((x) => x.day >= ws);
  const strengthThisWeek = thisWeek.filter(countsAsStrength).length;
  const walksThisWeek = thisWeek.filter((x) => x.kind === 'walk').length;
  const doneToday = sessions.some((x) => x.day === today && countsAsStrength(x));
  const streak = weekStreak(sessions, today);
  const missed = missedLastSlot(sessions, today, s.startDate);
  const sets = plannedSets(s, today);
  const pend = pendingRun();
  const ready = store.ladders.filter((l) => ['ready', 'needs-bands', 'stalled'].includes(ladderStatus(l, sessions, s, today).kind));
  const deload = s.deloadUntil && today <= s.deloadUntil;

  const strip = DOW.map((label, i) => {
    const d = addDays(ws, i);
    const daySessions = sessions.filter((x) => x.day === d);
    const strong = daySessions.some(countsAsStrength);
    const walk = daySessions.some((x) => x.kind === 'walk');
    const cls = [
      'day',
      isStrengthDay(d) ? 'sched' : '',
      strong ? 'done' : '',
      d === today ? 'today' : '',
      d < today && d >= s.startDate && isStrengthDay(d) && !strong ? 'miss' : '',
    ].join(' ');
    return `<div class="${cls}"><span>${label}</span><i>${parseDay(d).getDate()}</i>${walk ? '<em class="walkdot" title="Walk"></em>' : '<em></em>'}</div>`;
  }).join('');

  let main: string;
  if (doneToday) {
    main = `<div class="card hero done"><p class="eyebrow">Today</p><h2>Done ✓</h2><p class="muted">Next strength session ${esc(fmtDay(nextStrengthDay(today)))}.</p></div>`;
  } else if (isStrengthDay(today)) {
    main = `<div class="card hero"><p class="eyebrow">Today · ${sets} sets each${deload ? ' · deload week' : ''}</p><h2>Strength session</h2><p class="muted">~20 min · warm-up, 3 pairs, cooldown</p>
      <button class="btn primary big" data-a="start">Start session</button></div>`;
  } else {
    main = `<div class="card hero rest"><p class="eyebrow">Today</p><h2>Off day</h2><p class="muted">Next strength session ${esc(fmtDay(nextStrengthDay(today)))}. Good night for a walk.</p>
      <button class="btn big" data-a="start">Train anyway</button></div>`;
  }

  el.innerHTML = `
    <header class="page-head">
      <div><p class="eyebrow">${esc(fmtDay(today, { weekday: 'long', day: 'numeric', month: 'long' }))}</p><h1>${greeting()}</h1></div>
      <div class="streak" title="Weeks in a row with 3+ strength sessions"><b>${streak}</b><span>week${streak === 1 ? '' : 's'}<br>streak</span></div>
    </header>

    ${pend ? `<div class="card resume"><p><b>Unfinished ${pend.kind === 'walk' ? 'walk' : 'session'}</b> from ${new Date(pend.startedAt).toLocaleTimeString('en-SG', { hour: 'numeric', minute: '2-digit' })}</p>
      <div class="row gap"><button class="btn ghost" data-a="discard">Discard</button><button class="btn primary grow" data-a="resume">Resume</button></div></div>` : ''}

    <div class="week">${strip}</div>
    <p class="muted small week-meta">Strength ${strengthThisWeek}/3 · Walks ${walksThisWeek}/3</p>

    ${missed && !doneToday ? `<div class="banner warn">Missed the last session. Don’t miss twice — the 5-minute version counts.</div>` : ''}

    ${main}

    <div class="grid2">
      <button class="card tile" data-a="walk"><span class="tile-ico">🚶</span><b>Walk + Bar Stop</b><small>Evening · 30–40 min</small></button>
      <button class="card tile" data-a="min"><span class="tile-ico">⏱</span><b>Minimum session</b><small>Bad day · 5 min</small></button>
    </div>

    ${ready.length ? `<button class="banner good" data-a="progress">${ready.length} exercise${ready.length > 1 ? 's' : ''} ready for a progress check →</button>` : ''}

    <h3 class="section">Your levels</h3>
    <ul class="levels">
      ${LADDERS.map((l) => {
        const st = store.ladders.find((x) => x.id === l.id)!;
        const step = currentStep(st);
        return `<li><span class="lvl-name">${esc(l.name)}${l.where === 'bar' ? ' <small>(bars)</small>' : ''}</span><span>${esc(step.name)}</span><small>${step.min}–${step.max}${esc(unit(step))}</small></li>`;
      }).join('')}
    </ul>`;

  el.onclick = (e) => {
    const a = (e.target as HTMLElement).closest<HTMLElement>('[data-a]')?.dataset.a;
    if (a === 'start') startRun('strength');
    else if (a === 'walk') startRun('walk');
    else if (a === 'min') startRun('minimum');
    else if (a === 'progress') navigate('progress');
    else if (a === 'resume') navigate('session');
    else if (a === 'discard') {
      discardRun();
      renderToday(el);
    }
  };
}
