export function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T & Element>(sel) as T | null;

export function toast(msg: string) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 2200);
}

/** Bottom sheet. Returns a close function. */
export function sheet(content: string, onMount?: (root: HTMLElement, close: () => void) => void): () => void {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><button class="sheet-close" aria-label="Close">✕</button>${content}</div>`;
  document.body.append(wrap);
  const close = () => {
    wrap.classList.remove('open');
    setTimeout(() => wrap.remove(), 250);
  };
  wrap.addEventListener('click', (e) => {
    if (e.target === wrap || (e.target as HTMLElement).closest('.sheet-close')) close();
  });
  requestAnimationFrame(() => wrap.classList.add('open'));
  onMount?.(wrap.querySelector('.sheet')!, close);
  return close;
}

export function confirmSheet(title: string, body: string, okLabel = 'Confirm', danger = false): Promise<boolean> {
  return new Promise((resolve) => {
    let answered = false;
    const close = sheet(
      `<h2>${esc(title)}</h2><p class="muted">${esc(body)}</p>
       <div class="row gap"><button class="btn ghost" data-a="no">Cancel</button><button class="btn ${danger ? 'danger' : 'primary'}" data-a="yes">${esc(okLabel)}</button></div>`,
      (root, c) => {
        root.addEventListener('click', (e) => {
          const a = (e.target as HTMLElement).closest<HTMLElement>('[data-a]')?.dataset.a;
          if (!a) return;
          answered = true;
          resolve(a === 'yes');
          c();
        });
      },
    );
    // Resolve false if dismissed.
    const obs = new MutationObserver(() => {
      if (!document.body.contains(document.querySelector('.sheet-wrap'))) {
        obs.disconnect();
        if (!answered) resolve(false);
      }
    });
    obs.observe(document.body, { childList: true });
    void close;
  });
}

/** Extract a YouTube video id from a URL or bare id. */
export function youtubeId(input: string): string | null {
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s);
    if (u.hostname.endsWith('youtu.be')) return u.pathname.slice(1, 12) || null;
    if (u.hostname.includes('youtube')) {
      const v = u.searchParams.get('v');
      if (v) return v.slice(0, 11);
      const m = u.pathname.match(/\/(shorts|embed|live)\/([\w-]{11})/);
      if (m) return m[2];
    }
  } catch {
    /* not a URL */
  }
  return null;
}
