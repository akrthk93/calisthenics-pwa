import { dayKey, fmtDay } from '../dates';
import { exportBackup, importBackup, validateBackup } from '../db';
import { beep, unlockAudio } from '../device';
import { loadAll, store, updateSettings } from '../store';
import { confirmSheet, esc, toast } from './util';

function lastBackup(): string | null {
  try {
    return localStorage.getItem('cali.lastBackup');
  } catch {
    return null;
  }
}

export function renderSettings(el: HTMLElement) {
  const s = store.settings;
  const lb = lastBackup();
  const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone;

  el.innerHTML = `
    <header class="page-head"><div><p class="eyebrow">Plan &amp; data</p><h1>Settings</h1></div></header>

    ${standalone ? '' : `<div class="banner">Install it: tap <b>Share</b> → <b>Add to Home Screen</b>. It then runs full-screen and offline.</div>`}

    <h3 class="section">Plan</h3>
    <div class="card form">
      <label class="field"><span>Plan start date</span><input class="input" type="date" data-k="startDate" value="${esc(s.startDate)}"></label>
      <p class="muted small">Weeks 1–2 use 2 sets per exercise, then 3.</p>
      <label class="switch"><input type="checkbox" data-k="hasBands" ${s.hasBands ? 'checked' : ''}><span>I have resistance bands</span></label>
      <p class="muted small">Unlocks band rows, pull-aparts, band-assisted pull-ups and band good mornings.</p>
      <label class="field"><span>Home rest between pairs (sec)</span><input class="input" type="number" inputmode="numeric" min="15" max="180" step="5" data-k="restSec" value="${s.restSec}"></label>
      <label class="field"><span>Bar stop rest (sec)</span><input class="input" type="number" inputmode="numeric" min="15" max="240" step="5" data-k="barRestSec" value="${s.barRestSec}"></label>
      ${s.deloadUntil && s.deloadUntil >= dayKey() ? `<div class="row gap"><span class="pill warn">Deload until ${esc(fmtDay(s.deloadUntil))}</span><button class="link" data-a="enddeload">End early</button></div>` : ''}
    </div>

    <h3 class="section">Timer</h3>
    <div class="card form">
      <label class="switch"><input type="checkbox" data-k="sound" ${s.sound ? 'checked' : ''}><span>Beeps (3-2-1 and done)</span></label>
      <button class="btn ghost" data-a="testsound">Test sound</button>
      <p class="muted small">If you hear nothing, check the ringer switch and volume. The screen stays awake during sessions.</p>
    </div>

    <h3 class="section">Your data</h3>
    <div class="card form">
      <p class="small">Everything is stored on this phone only. Export a backup now and then — deleting the app or clearing Safari data wipes it.</p>
      <p class="muted small">Last backup: ${lb ? esc(new Date(lb).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })) : 'never'}</p>
      <div class="row gap">
        <button class="btn primary grow" data-a="export">Export backup</button>
        <label class="btn ghost grow">Import<input type="file" accept="application/json,.json" data-role="import" hidden></label>
      </div>
    </div>
    <p class="muted small center">v${__APP_VERSION__}</p>`;

  el.onchange = async (e) => {
    const t = e.target as HTMLInputElement;
    if (t.dataset.role === 'import') return doImport(t, el);
    const k = t.dataset.k as keyof typeof s | undefined;
    if (!k) return;
    if (t.type === 'checkbox') await updateSettings({ [k]: t.checked });
    else if (t.type === 'number') {
      const v = Number(t.value);
      if (v > 0) await updateSettings({ [k]: v });
    } else if (t.type === 'date' && t.value) await updateSettings({ [k]: t.value });
    toast('Saved');
  };

  el.onclick = async (e) => {
    const a = (e.target as HTMLElement).closest<HTMLElement>('[data-a]')?.dataset.a;
    if (a === 'testsound') {
      unlockAudio();
      beep(880, 110);
      setTimeout(() => beep(880, 110), 400);
      setTimeout(() => beep(1320, 300), 800);
    } else if (a === 'export') {
      const data = await exportBackup();
      const json = JSON.stringify(data, null, 1);
      const file = new File([json], `calisthenics-backup-${dayKey()}.json`, { type: 'application/json' });
      try {
        // iOS share sheet lets you save to Files / iCloud Drive.
        if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'Calisthenics backup' });
        else {
          const a2 = document.createElement('a');
          a2.href = URL.createObjectURL(file);
          a2.download = file.name;
          a2.click();
          setTimeout(() => URL.revokeObjectURL(a2.href), 5000);
        }
        localStorage.setItem('cali.lastBackup', new Date().toISOString());
        renderSettings(el);
      } catch (err) {
        if ((err as DOMException).name !== 'AbortError') toast('Export failed');
      }
    } else if (a === 'enddeload') {
      await updateSettings({ deloadUntil: null });
      renderSettings(el);
    }
  };
}

async function doImport(input: HTMLInputElement, el: HTMLElement) {
  const f = input.files?.[0];
  input.value = '';
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    if (!validateBackup(data)) return toast('Not a valid backup file');
    const ok = await confirmSheet(
      'Replace all data?',
      `This backup has ${data.sessions.length} sessions from ${new Date(data.exportedAt).toLocaleDateString('en-SG')}. Your current data will be replaced.`,
      'Replace',
      true,
    );
    if (!ok) return;
    await importBackup(data);
    await loadAll();
    toast('Backup restored');
    renderSettings(el);
  } catch {
    toast('Could not read that file');
  }
}
