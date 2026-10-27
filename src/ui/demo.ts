import { unit, type Step, type Video } from '../data/exercises';
import { store, updateSettings } from '../store';
import { esc, sheet, toast, youtubeId } from './util';

export function videoFor(step: Step): Video | undefined {
  const pinned = store.settings.videos[step.id];
  return pinned ? { id: pinned } : step.video;
}

export function cuesHtml(step: Step): string {
  return `<ul class="cues">${step.cues.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>`;
}

function embed(v: Video): string {
  const id = encodeURIComponent(v.id);
  const start = v.start ? `&start=${v.start}` : '';
  const src = `https://www.youtube-nocookie.com/embed/${id}?playsinline=1&rel=0&modestbranding=1${start}`;
  const watch = `https://www.youtube.com/watch?v=${id}${v.start ? `&t=${v.start}s` : ''}`;
  return `<div class="video"><iframe src="${src}" title="Exercise demo" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>
    <p class="muted small">${v.note ? esc(v.note) + ' ' : ''}<a href="${watch}" target="_blank" rel="noopener">Open in YouTube ↗</a></p>`;
}

/** Hampton's silent looping demo. Hidden if it fails to load. */
function loopHtml(imgurId: string): string {
  const src = `https://i.imgur.com/${encodeURIComponent(imgurId)}.mp4`;
  return `<div class="video loop"><video src="${src}" autoplay loop muted playsinline preload="auto" onerror="this.parentElement.remove()"></video></div>
    <p class="muted small">Looping demo from Hybrid Calisthenics.</p>`;
}

export function showDemo(step: Step, onChange?: () => void) {
  const render = () => {
    const id = videoFor(step);
    const search = `https://www.youtube.com/results?search_query=${encodeURIComponent(step.search)}`;
    return `
      <h2>${esc(step.name)}</h2>
      <p class="muted small">Target ${step.min}–${step.max}${esc(unit(step))}</p>
      ${step.loop ? loopHtml(step.loop) : ''}
      ${id ? `${step.loop ? '<h3>Full explanation</h3>' : ''}${embed(id)}` : step.loop ? '' : `<div class="video empty"><p>No demo pinned yet.</p><a class="btn" href="${search}" target="_blank" rel="noopener">Find one on YouTube ↗</a></div>`}
      <h3>Form cues</h3>
      ${cuesHtml(step)}
      <details class="pin"${id ? '' : ' open'}>
        <summary>${id ? 'Change demo video' : 'Pin a demo video'}</summary>
        <p class="muted small">Find a clip, tap Share → Copy link, paste it here.</p>
        <div class="row gap">
          <input class="input" type="url" inputmode="url" placeholder="https://youtu.be/…" data-role="url">
          <button class="btn primary" data-a="save">Pin</button>
        </div>
        ${id ? `<div class="row gap top"><a class="btn ghost" href="${search}" target="_blank" rel="noopener">Search again ↗</a>${store.settings.videos[step.id] ? '<button class="btn ghost" data-a="clear">Remove</button>' : ''}</div>` : ''}
      </details>`;
  };

  sheet(`<div data-role="body">${render()}</div>`, (root) => {
    const body = root.querySelector<HTMLElement>('[data-role=body]')!;
    root.addEventListener('click', async (e) => {
      const a = (e.target as HTMLElement).closest<HTMLElement>('[data-a]')?.dataset.a;
      if (a === 'save') {
        const val = root.querySelector<HTMLInputElement>('[data-role=url]')!.value;
        const id = youtubeId(val);
        if (!id) return toast('That doesn’t look like a YouTube link');
        await updateSettings({ videos: { ...store.settings.videos, [step.id]: id } });
        body.innerHTML = render();
        toast('Demo pinned');
        onChange?.();
      } else if (a === 'clear') {
        const videos = { ...store.settings.videos };
        delete videos[step.id];
        await updateSettings({ videos });
        body.innerHTML = render();
        onChange?.();
      }
    });
  });
}
