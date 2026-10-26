export type Route = 'today' | 'session' | 'progress' | 'history' | 'settings';

const ROUTES: Route[] = ['today', 'session', 'progress', 'history', 'settings'];

export function currentRoute(): Route {
  const r = location.hash.replace(/^#\/?/, '') as Route;
  return ROUTES.includes(r) ? r : 'today';
}

export function navigate(r: Route) {
  if (currentRoute() === r && location.hash) {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    location.hash = `#/${r}`;
  }
}
