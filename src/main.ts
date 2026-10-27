import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource/barlow-condensed/latin-800.css';
import './styles.css';
import { registerSW } from 'virtual:pwa-register';
import { requestPersistence } from './db';
import { currentRoute, type Route } from './router';
import { loadAll } from './store';
import { renderHistory } from './ui/history';
import { renderProgress } from './ui/progress';
import { mountSession, unmountSession } from './ui/session';
import { renderSettings } from './ui/settings';
import { renderToday } from './ui/today';

const app = document.getElementById('app')!;
let last: Route | null = null;

function render() {
  const r = currentRoute();
  if (last === 'session' && r !== 'session') unmountSession();
  last = r;
  document.body.dataset.route = r;
  document.querySelectorAll<HTMLElement>('.tabbar a').forEach((a) => a.classList.toggle('active', a.dataset.tab === r));
  app.onclick = null;
  app.onchange = null;
  app.className = r === 'session' ? 'run' : 'page';
  ({ today: renderToday, progress: renderProgress, history: renderHistory, settings: renderSettings, session: mountSession })[r](app);
}

// Re-render Today when the app comes back to the foreground on a new day.
let lastDay = new Date().toDateString();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  const d = new Date().toDateString();
  if (d !== lastDay && currentRoute() !== 'session') {
    lastDay = d;
    render();
  }
});

async function boot() {
  await loadAll();
  void requestPersistence();
  window.addEventListener('hashchange', render);
  render();
  registerSW({ immediate: true });
}

boot().catch((err) => {
  app.innerHTML = `<div class="card"><h2>Couldn’t start</h2><p class="muted">${String(err)}</p></div>`;
});
