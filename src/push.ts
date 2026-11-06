// Scheduled reminders via the shared pwa-push service (Cloudflare Worker).
import { dayKey } from './dates';
import { reminderItems } from './logic';
import { store } from './store';

const SERVICE = (import.meta.env.VITE_PUSH_URL as string | undefined)?.replace(/\/$/, '') ?? '';
const APP = 'calisthenics';
const DEVICE_KEY = 'cali.pushDevice';

export type PushState = 'unconfigured' | 'unsupported' | 'denied' | 'off' | 'on';

function deviceId(create = false): string | null {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id && create) {
      id = Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export async function pushState(): Promise<PushState> {
  if (!SERVICE) return 'unconfigured';
  if (!supported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  return sub && deviceId() ? 'on' : 'off';
}

async function call(path: string, body: Record<string, unknown>) {
  const res = await fetch(`${SERVICE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app: APP, deviceId: deviceId(), ...body }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(String(data.error ?? `HTTP ${res.status}`));
  return data;
}

function keyBytes(b64url: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64url.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64url.length + 3) % 4));
  const out = new Uint8Array(new ArrayBuffer(s.length));
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** Ask permission, subscribe, register with the service and send the schedule. Call from a tap. */
export async function enablePush(): Promise<PushState> {
  if (!SERVICE) return 'unconfigured';
  if (!supported()) return 'unsupported';
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return perm === 'denied' ? 'denied' : 'off';
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const { key } = (await (await fetch(`${SERVICE}/v1/vapid-public-key`)).json()) as { key: string };
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) });
  }
  deviceId(true);
  await call('/v1/subscribe', { subscription: sub.toJSON() });
  await syncReminders(true);
  return 'on';
}

export async function disablePush() {
  try {
    if (deviceId()) await call('/v1/unsubscribe', {});
  } catch {
    /* offline: the service drops it once pushes fail */
  }
  const reg = await navigator.serviceWorker.ready;
  await (await reg.pushManager.getSubscription())?.unsubscribe();
  try {
    localStorage.removeItem(DEVICE_KEY);
  } catch {
    /* ignore */
  }
}

export async function sendTestPush() {
  return call('/v1/test', { url: `${location.pathname}#/today` });
}

let timer = 0;
let lastSent = '';

/** Re-send the next 4 weeks of reminders. Debounced; skips if nothing changed. */
export function syncReminders(now = false): Promise<void> {
  if (!SERVICE || !deviceId()) return Promise.resolve();
  clearTimeout(timer);
  return new Promise((resolve) => {
    timer = window.setTimeout(
      async () => {
        try {
          const url = `${location.pathname}#/today`;
          const items = reminderItems(dayKey(), store.sessions, store.metrics).map((i) => ({ ...i, url }));
          const sig = JSON.stringify(items);
          if (sig !== lastSent) {
            await call('/v1/schedule', { items });
            lastSent = sig;
          }
        } catch (e) {
          console.warn('reminder sync failed', e);
        }
        resolve();
      },
      now ? 0 : 1500,
    );
  });
}
