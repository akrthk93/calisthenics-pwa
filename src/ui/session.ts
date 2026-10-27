import { COOLDOWN, PULL_APART, WARMUP, findStep, ladder, unit, type GuidedMove, type LadderId, type Step } from '../data/exercises';
import { dayKey, fmtClock, fmtDuration } from '../dates';
import { uid } from '../db';
import { keepAwake, unlockAudio } from '../device';
import { currentStep, ladderStatus, plannedSets } from '../logic';
import { addSession, ladderState, store } from '../store';
import { Timer } from '../timer';
import type { Entry, Session, SessionKind } from '../types';
import { showDemo } from './demo';
import { confirmSheet, esc, toast } from './util';
import { renderPromotions } from './promote';
import { navigate } from '../router';

type FlowStep =
  | { t: 'warmup'; idx?: number }
  | { t: 'work'; ladderId: LadderId | null; stepId: string; set: number; of: number; label: string }
  | { t: 'rest'; seconds: number; next: string }
  | { t: 'cooldown'; idx: number }
  | { t: 'walk'; phase: 'out' | 'home' | 'only' }
  | { t: 'summary' };

interface Run {
  id: string;
  kind: SessionKind;
  day: string;
  startedAt: number;
  flow: FlowStep[];
  i: number;
  /** stepId -> values per set (index = set - 1). null = skipped. */
  logs: Record<string, (number | null)[]>;
  planned: Record<string, number>;
  ladderOf: Record<string, LadderId | null>;
  walkSec: number;
  /** Start of the current walk phase (ms), if one is running. */
  walkFrom: number | null;
}

const RUN_KEY = 'cali.run';
let run: Run | null = null;
let timer: Timer | null = null;
let root: HTMLElement;

// ---------- persistence of an in-progress run ----------

function persist() {
  try {
    if (run) localStorage.setItem(RUN_KEY, JSON.stringify(run));
    else localStorage.removeItem(RUN_KEY);
  } catch {
    /* storage unavailable */
  }
}

export function pendingRun(): { kind: SessionKind; startedAt: number } | null {
  try {
    const raw = localStorage.getItem(RUN_KEY);
    if (!raw) return null;
    const r = JSON.parse(raw) as Run;
    // Only offer to resume within 3 hours.
    if (Date.now() - r.startedAt > 3 * 3600_000) {
      localStorage.removeItem(RUN_KEY);
      return null;
    }
    return { kind: r.kind, startedAt: r.startedAt };
  } catch {
    return null;
  }
}

export function discardRun() {
  run = null;
  persist();
}

// ---------- building the flow ----------

const PAIRS: { label: string; ladders: LadderId[] }[] = [
  { label: 'A', ladders: ['push', 'row'] },
  { label: 'B', ladders: ['squat', 'hinge'] },
  { label: 'C', ladders: ['core'] },
];

function stepOf(id: LadderId): Step {
  return currentStep(ladderState(id));
}

export function buildFlow(kind: SessionKind | 'walk-only'): Omit<Run, 'id' | 'startedAt' | 'day'> {
  const today = dayKey();
  const flow: FlowStep[] = [];
  const planned: Record<string, number> = {};
  const ladderOf: Record<string, LadderId | null> = {};
  const add = (ladderId: LadderId | null, step: Step, sets: number) => {
    planned[step.id] = sets;
    ladderOf[step.id] = ladderId;
  };

  if (kind === 'strength') {
    const sets = plannedSets(store.settings, today);
    const groups = PAIRS.map((p) => ({
      label: p.label,
      items: p.ladders.map((l) => ({ ladderId: l as LadderId | null, step: stepOf(l), sets })),
    }));
    if (store.settings.hasBands) groups.push({ label: 'Finisher', items: [{ ladderId: null, step: PULL_APART, sets: 1 }] });

    WARMUP.forEach((_, idx) => flow.push({ t: 'warmup', idx }));
    groups.forEach((g, gi) => {
      const rounds = Math.max(...g.items.map((x) => x.sets));
      for (let set = 1; set <= rounds; set++) {
        g.items.forEach((it, ii) => {
          add(it.ladderId, it.step, it.sets);
          const label = g.items.length > 1 ? `${g.label}${ii + 1}` : g.label;
          flow.push({ t: 'work', ladderId: it.ladderId, stepId: it.step.id, set, of: it.sets, label });
        });
        const lastRound = gi === groups.length - 1 && set === rounds;
        if (!lastRound) {
          const nextGroup = set === rounds ? groups[gi + 1] : g;
          flow.push({ t: 'rest', seconds: store.settings.restSec, next: nextGroup.items[0].step.name });
        }
      }
    });
    COOLDOWN.forEach((_, idx) => flow.push({ t: 'cooldown', idx }));
  } else if (kind === 'minimum') {
    (['push', 'row', 'squat'] as LadderId[]).forEach((l) => {
      const step = stepOf(l);
      add(l, step, 1);
      flow.push({ t: 'work', ladderId: l, stepId: step.id, set: 1, of: 1, label: 'Min' });
    });
  } else if (kind === 'walk') {
    const step = stepOf('vpull');
    const sets = plannedSets(store.settings, today);
    add('vpull', step, sets);
    flow.push({ t: 'walk', phase: 'out' });
    for (let set = 1; set <= sets; set++) {
      flow.push({ t: 'work', ladderId: 'vpull', stepId: step.id, set, of: sets, label: 'Bar' });
      if (set < sets) flow.push({ t: 'rest', seconds: store.settings.barRestSec, next: step.name });
    }
    flow.push({ t: 'walk', phase: 'home' });
  } else {
    flow.push({ t: 'walk', phase: 'only' });
  }

  flow.push({ t: 'summary' });
  return { kind: kind === 'walk-only' ? 'walk' : kind, flow, i: 0, logs: {}, planned, ladderOf, walkSec: 0, walkFrom: null };
}

// ---------- entry points ----------

export function startRun(kind: SessionKind | 'walk-only') {
  unlockAudio();
  run = { id: uid(), startedAt: Date.now(), day: dayKey(), ...buildFlow(kind) };
  persist();
  navigate('session');
}

export function mountSession(el: HTMLElement) {
  root = el;
  if (!run) {
    try {
      const raw = localStorage.getItem(RUN_KEY);
      if (raw) run = JSON.parse(raw) as Run;
    } catch {
      /* ignore */
    }
  }
  if (!run) return navigate('today');
  unlockAudio();
  void keepAwake(true);
  draw();
}

export function unmountSession() {
  timer?.stop();
  timer = null;
  void keepAwake(false);
}

// ---------- helpers ----------

/** Value from the most recent previous session for this step and set, or the bottom of the range. */
function lastValue(step: Step, set: number): number | null {
  for (const s of store.sessions) {
    const e = s.entries.find((x) => x.stepId === step.id);
    if (e && e.sets.length) return e.sets[Math.min(set - 1, e.sets.length - 1)];
  }
  return null;
}

function cur(): FlowStep {
  return run!.flow[run!.i];
}

function go(delta: number) {
  if (!run) return;
  timer?.stop();
  timer = null;
  closeWalkPhase();
  run.i = Math.max(0, Math.min(run.flow.length - 1, run.i + delta));
  const s = cur();
  if (s.t === 'walk' && run.walkFrom == null) run.walkFrom = Date.now();
  persist();
  draw();
  window.scrollTo(0, 0);
}

function closeWalkPhase() {
  if (run && run.walkFrom != null) {
    run.walkSec += (Date.now() - run.walkFrom) / 1000;
    run.walkFrom = null;
  }
}

function progressBar() {
  const pct = Math.round((run!.i / (run!.flow.length - 1)) * 100);
  return `<div class="runbar"><div style="width:${pct}%"></div></div>`;
}

function topBar(title: string) {
  return `
    <header class="run-top">
      <button class="icon-btn" data-a="exit" aria-label="Exit session">✕</button>
      <div class="run-title">${esc(title)}</div>
      <button class="icon-btn" data-a="back" aria-label="Previous step" ${run!.i === 0 ? 'disabled' : ''}>↶</button>
    </header>
    ${progressBar()}`;
}

function ring(display: string, frac: number, sub = '') {
  const r = 88;
  const c = 2 * Math.PI * r;
  return `
    <div class="ring">
      <svg viewBox="0 0 200 200" aria-hidden="true">
        <circle cx="100" cy="100" r="${r}" class="ring-bg"/>
        <circle cx="100" cy="100" r="${r}" class="ring-fg" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - Math.max(0, Math.min(1, frac)))}"/>
      </svg>
      <div class="ring-text"><div class="ring-num" data-role="num">${display}</div><div class="ring-sub">${sub}</div></div>
    </div>`;
}

function updateRing(display: string, frac: number) {
  const num = root.querySelector('[data-role=num]');
  if (num) num.textContent = display;
  const fg = root.querySelector<SVGCircleElement>('.ring-fg');
  if (fg) {
    const c = 2 * Math.PI * 88;
    fg.setAttribute('stroke-dashoffset', String(c * (1 - Math.max(0, Math.min(1, frac)))));
  }
}

const KIND_TITLE: Record<SessionKind, string> = { strength: 'Strength session', minimum: 'Minimum session', walk: 'Walk + Bar Stop' };

// ---------- drawing ----------

function draw() {
  if (!run) return;
  const s = cur();
  switch (s.t) {
    case 'warmup':
      return drawGuided(WARMUP, s.idx ?? 0, 'Warm-up');
    case 'work':
      return drawWork(s);
    case 'rest':
      return drawRest(s);
    case 'cooldown':
      return drawGuided(COOLDOWN, s.idx, 'Cooldown');
    case 'walk':
      return drawWalk(s.phase);
    case 'summary':
      return drawSummary();
  }
}

/** A guided timed move (warm-up or cooldown): auto-starts, auto-advances. */
function drawGuided(list: GuidedMove[], idx: number, label: string) {
  const m = list[idx];
  const asStep = moveAsStep(m, label);
  root.innerHTML = `
    ${topBar(KIND_TITLE[run!.kind])}
    <section class="run-body">
      <p class="eyebrow">${esc(label)} · ${idx + 1} of ${list.length}</p>
      <h1 class="move-name">${esc(m.name)}</h1>
      <p class="move-detail">${esc(m.detail)}</p>
      ${ring(String(m.seconds), 1, 'seconds')}
      <ul class="cues big">${m.cues.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
    </section>
    <footer class="run-actions">
      <div class="row gap">
        <button class="btn ghost" data-a="pause">Pause</button>
        ${m.video || m.loop ? '<button class="btn ghost grow" data-a="demo">▶ Demo</button>' : ''}
        <button class="btn primary big grow" data-a="next">Next →</button>
      </div>
    </footer>`;
  timer = new Timer('down', m.seconds, (d) => updateRing(String(d), d / m.seconds), () => setTimeout(() => cur() && go(1), 700));
  timer.start();
  bind({
    pause: (btn) => {
      timer?.toggle();
      btn.textContent = timer?.isRunning ? 'Pause' : 'Resume';
    },
    demo: (btn) => {
      // Pause while watching; the person resumes when ready.
      if (timer?.isRunning) {
        timer.pause();
        root.querySelector<HTMLElement>('[data-a=pause]')!.textContent = 'Resume';
      }
      void btn;
      showDemo(asStep);
    },
  });
}

function moveAsStep(m: GuidedMove, label: string): Step {
  return {
    id: `${label.toLowerCase()}-${m.name.toLowerCase().replace(/[^a-z]+/g, '-')}`,
    name: m.name,
    metric: 'hold',
    min: 0,
    max: 0,
    cues: m.cues,
    search: m.name,
    video: m.video,
    loop: m.loop,
  };
}

function drawWork(s: Extract<FlowStep, { t: 'work' }>) {
  const found = findStep(s.stepId)!;
  const step = found.step;
  const logged = run!.logs[s.stepId]?.[s.set - 1];
  const prev = lastValue(step, s.set);
  let value = logged ?? prev ?? step.min;
  const isHold = step.metric === 'hold';
  const ladderName = s.ladderId ? ladder(s.ladderId).name : 'Finisher';
  const targetTxt = `${step.min}–${step.max}${unit(step) ? ' ' + unit(step).trim() : ' reps'}`;
  const tip = run!.kind === 'minimum' ? 'One easy set. It counts.' : s.set === 1 && cur() === run!.flow.find((f) => f.t === 'work') ? isHold ? '' : 'Stop each set with reps left in the tank.' : '';

  const pips = Array.from({ length: s.of }, (_, k) => `<i class="${k < s.set - 1 ? 'done' : k === s.set - 1 ? 'now' : ''}"></i>`).join('');

  root.innerHTML = `
    ${topBar(KIND_TITLE[run!.kind])}
    <section class="run-body work">
      <div class="work-head">
        <p class="eyebrow">${esc(s.label)} · ${esc(ladderName)}</p>
        <div class="pips" aria-label="Set ${s.set} of ${s.of}">${pips}<span>Set ${s.set}/${s.of}</span></div>
      </div>
      <h1 class="ex-name">${esc(step.name)}</h1>
      <p class="target">Target <b>${esc(targetTxt)}</b>${prev != null ? ` · last <b>${prev}${isHold ? 's' : ''}</b>` : ''}</p>
      ${isHold ? ring(`${value}`, 1, 'seconds') : ''}
      <div class="stepper${isHold ? ' compact' : ''}">
        <button class="step-btn" data-a="dec" aria-label="Less">−</button>
        <div class="step-val"><span data-role="val">${value}</span><small>${isHold ? 'sec goal' : step.perSide ? 'reps / side' : 'reps'}</small></div>
        <button class="step-btn" data-a="inc" aria-label="More">+</button>
      </div>
      ${tip ? `<p class="tip">${esc(tip)}</p>` : ''}
    </section>
    <footer class="run-actions">
      ${isHold ? `<button class="btn big" data-a="hold">Start hold</button>` : ''}
      <button class="btn primary huge" data-a="done">Done set ✓</button>
      <div class="row gap">
        <button class="btn ghost grow" data-a="demo">▶ Demo &amp; form</button>
        <button class="btn ghost" data-a="skip">Skip</button>
      </div>
    </footer>`;

  const delta = isHold ? 5 : 1;
  const setVal = (v: number) => {
    value = Math.max(0, v);
    root.querySelector('[data-role=val]')!.textContent = String(value);
    if (isHold && !timer?.isRunning) updateRing(String(value), 1);
  };

  bind({
    inc: () => setVal(value + delta),
    dec: () => setVal(value - delta),
    demo: () => showDemo(step),
    skip: () => {
      record(s, null);
      go(1);
    },
    done: () => {
      if (isHold && timer?.isRunning) {
        value = Math.floor(timer.elapsed());
        timer.stop();
      }
      record(s, value);
      go(1);
    },
    hold: (btn) => {
      if (timer?.isRunning) {
        // Stopped early: log what was held.
        const held = Math.floor(timer.elapsed());
        timer.stop();
        timer = null;
        setVal(held);
        btn.textContent = 'Restart hold';
        return;
      }
      const goal = value;
      btn.textContent = 'Stop';
      timer = new Timer('down', goal, (d) => updateRing(String(d), goal ? d / goal : 0), () => {
        btn.textContent = 'Restart hold';
        setVal(goal);
        timer = null;
      });
      timer.start();
    },
  });
}

function record(s: Extract<FlowStep, { t: 'work' }>, v: number | null) {
  const arr = (run!.logs[s.stepId] ??= []);
  arr[s.set - 1] = v;
  persist();
}

function drawRest(s: Extract<FlowStep, { t: 'rest' }>) {
  root.innerHTML = `
    ${topBar(KIND_TITLE[run!.kind])}
    <section class="run-body center">
      <p class="eyebrow">Rest</p>
      ${ring(String(s.seconds), 1, 'seconds')}
      <p class="eyebrow">Up next</p>
      <p class="next-name">${esc(s.next)}</p>
    </section>
    <footer class="run-actions">
      <div class="row gap">
        <button class="btn ghost big" data-a="add">+15s</button>
        <button class="btn primary big grow" data-a="next">Skip rest →</button>
      </div>
    </footer>`;
  let total = s.seconds;
  timer = new Timer('down', s.seconds, (d) => updateRing(String(d), d / total), () => go(1));
  timer.start();
  bind({
    add: () => {
      total += 15;
      timer?.add(15);
    },
  });
}

function drawWalk(phase: 'out' | 'home' | 'only') {
  const text = {
    out: { h: 'Walk to the bars', p: 'Easy pace for about 10 minutes — talk, don’t sing.', btn: 'At the bars →' },
    home: { h: 'Walk home', p: '10–20 minutes. Bring it home.', btn: 'Finish walk ✓' },
    only: { h: 'Walk', p: '20–30 minutes at a pace where you can talk but not sing.', btn: 'Finish walk ✓' },
  }[phase];
  const goalMin = phase === 'only' ? 25 : phase === 'out' ? 10 : 15;
  root.innerHTML = `
    ${topBar(KIND_TITLE[run!.kind])}
    <section class="run-body center">
      <p class="eyebrow">${phase === 'out' ? 'Part 1 of 3' : phase === 'home' ? 'Part 3 of 3' : 'Walk only'}</p>
      <h1 class="move-name">${esc(text.h)}</h1>
      ${ring('0:00', 0, `goal ${goalMin} min`)}
      <p class="muted">${esc(text.p)}</p>
      <p class="muted small">Timer keeps time with the screen locked.</p>
    </section>
    <footer class="run-actions">
      ${phase === 'out' ? '<button class="btn ghost" data-a="walkonly">No bars today — just walk</button>' : ''}
      <button class="btn primary big" data-a="next">${text.btn}</button>
    </footer>`;
  if (run!.walkFrom == null) run!.walkFrom = Date.now();
  const from = run!.walkFrom;
  const tick = () => {
    const sec = (Date.now() - from) / 1000;
    updateRing(fmtClock(sec), sec / (goalMin * 60));
  };
  tick();
  const h = window.setInterval(tick, 1000);
  timer = { stop: () => clearInterval(h) } as unknown as Timer;
  bind({
    walkonly: () => {
      // Drop the bar sets and the walk-home leg; keep timing.
      run!.flow = [{ t: 'walk', phase: 'only' }, { t: 'summary' }];
      run!.i = 0;
      run!.planned = {};
      run!.ladderOf = {};
      persist();
      draw();
    },
  });
}

function entriesFromRun(): Entry[] {
  return Object.entries(run!.logs)
    .map(([stepId, vals]) => ({
      ladderId: run!.ladderOf[stepId] ?? null,
      stepId,
      planned: run!.planned[stepId] ?? vals.length,
      sets: vals.filter((v): v is number => v != null),
    }))
    .filter((e) => e.sets.length);
}

function drawSummary() {
  closeWalkPhase();
  const entries = entriesFromRun();
  const dur = Math.round((Date.now() - run!.startedAt) / 1000);
  const walkMin = Math.round(run!.walkSec / 60);
  root.innerHTML = `
    ${topBar(KIND_TITLE[run!.kind])}
    <section class="run-body">
      <p class="eyebrow">Nice work</p>
      <h1 class="move-name">Session done</h1>
      <p class="muted">${fmtDuration(dur)} total</p>
      ${
        run!.kind === 'walk'
          ? `<label class="field"><span>Walk minutes</span><input class="input" type="number" inputmode="numeric" min="0" data-role="walk" value="${walkMin}"></label>`
          : ''
      }
      ${
        entries.length
          ? `<ul class="summary">${entries
              .map((e) => {
                const st = findStep(e.stepId)!.step;
                return `<li><span>${esc(st.name)}</span><b>${e.sets.map((v) => `${v}${st.metric === 'hold' ? 's' : ''}`).join(' · ')}</b></li>`;
              })
              .join('')}</ul>`
          : run!.kind === 'walk'
            ? ''
            : '<p class="muted">Nothing logged.</p>'
      }
    </section>
    <footer class="run-actions"><button class="btn primary big" data-a="save">Save session</button></footer>`;
  bind({
    save: async () => {
      const wm = root.querySelector<HTMLInputElement>('[data-role=walk]');
      await saveRun(entries, dur, wm ? Number(wm.value) || 0 : undefined);
    },
  });
}

async function saveRun(entries: Entry[], dur: number, walkMin?: number) {
  const r = run!;
  const session: Session = {
    id: r.id,
    at: new Date().toISOString(),
    day: r.day,
    kind: r.kind,
    durationSec: dur,
    entries,
    ...(walkMin != null ? { walkMin } : {}),
  };
  await addSession(session);
  run = null;
  persist();
  void keepAwake(false);

  // Offer progressions for ladders trained in this session.
  const today = dayKey();
  const touched = [...new Set(entries.map((e) => e.ladderId).filter(Boolean))] as LadderId[];
  const ready = touched.filter((id) => ['ready', 'needs-bands', 'stalled'].includes(ladderStatus(ladderState(id), store.sessions, store.settings, today).kind));
  if (ready.length) {
    root.innerHTML = `<section class="run-body"><p class="eyebrow">Saved</p><h1>Progress check</h1><div data-role="promos"></div></section>
      <footer class="run-actions"><button class="btn primary big" data-a="home">Done</button></footer>`;
    renderPromotions(root.querySelector('[data-role=promos]')!, ready);
    root.querySelector('[data-a=home]')!.addEventListener('click', () => navigate('today'));
  } else {
    toast('Session saved');
    navigate('today');
  }
}

// ---------- events ----------

function bind(handlers: Record<string, (btn: HTMLElement) => void> = {}) {
  root.onclick = async (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-a]');
    if (!btn || (btn as HTMLButtonElement).disabled) return;
    const a = btn.dataset.a!;
    if (handlers[a]) return handlers[a](btn);
    if (a === 'next') return go(1);
    if (a === 'back') return go(-1);
    if (a === 'exit') return exitRun();
  };
}

async function exitRun() {
  const entries = run ? entriesFromRun() : [];
  const isWalk = run?.kind === 'walk';
  if (entries.length || isWalk) {
    const keep = await confirmSheet('Leave session?', 'Save what you’ve done so far, or discard it.', 'Save & leave');
    if (keep) {
      closeWalkPhase();
      const dur = Math.round((Date.now() - run!.startedAt) / 1000);
      timer?.stop();
      return saveRun(entries, dur, isWalk ? Math.round(run!.walkSec / 60) : undefined);
    }
    const discard = await confirmSheet('Discard session?', 'Nothing from this session will be saved.', 'Discard', true);
    if (!discard) return;
  }
  discardRun();
  navigate('today');
}
