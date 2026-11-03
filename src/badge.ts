import { dayKey } from './dates';
import { dueCheckins } from './logic';
import { store } from './store';

type BadgeNav = Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };

export function dueCount(): number {
  return dueCheckins(store.metrics, dayKey()).length;
}

/** Whether the home-screen icon badge can work here (iOS 16.4+ home-screen app). */
export function appBadgeSupported(): boolean {
  return 'setAppBadge' in navigator && 'Notification' in window;
}

export function appBadgeAllowed(): boolean {
  return appBadgeSupported() && Notification.permission === 'granted';
}

/** iOS only shows icon badges once notifications are allowed. Must run from a tap. */
export async function enableAppBadge(): Promise<NotificationPermission | 'unsupported'> {
  if (!appBadgeSupported()) return 'unsupported';
  const p = await Notification.requestPermission();
  updateBadges();
  return p;
}

/** Refresh the Progress tab badge and the home-screen icon badge. */
export function updateBadges() {
  const n = dueCount();
  const tab = document.querySelector<HTMLElement>('.tabbar a[data-tab=progress]');
  if (tab) {
    let b = tab.querySelector<HTMLElement>('.tab-badge');
    if (n && !b) {
      b = document.createElement('b');
      b.className = 'tab-badge';
      tab.append(b);
    }
    if (b) {
      if (n) b.textContent = String(n);
      else b.remove();
    }
    tab.setAttribute('aria-label', n ? `Progress, ${n} check-in${n > 1 ? 's' : ''} due` : 'Progress');
  }
  if (appBadgeAllowed()) {
    const nav = navigator as BadgeNav;
    try {
      void (n ? nav.setAppBadge?.(n) : nav.clearAppBadge?.());
    } catch {
      /* ignore */
    }
  }
}
