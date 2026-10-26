// Sound, vibration and keep-awake helpers.

let ctx: AudioContext | null = null;
let soundOn = true;

export function setSound(on: boolean) {
  soundOn = on;
}

/** Must be called from a user gesture (tap) so iOS lets audio play later. */
export function unlockAudio() {
  try {
    // Short, mixed-with-other-audio cues (iOS 17+). Lets podcasts keep playing, ducked briefly.
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    if (nav.audioSession) nav.audioSession.type = 'transient';
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    // A silent blip primes the output on iOS.
    const g = ctx.createGain();
    g.gain.value = 0;
    g.connect(ctx.destination);
    const o = ctx.createOscillator();
    o.connect(g);
    o.start();
    o.stop(ctx.currentTime + 0.01);
  } catch {
    /* audio unavailable */
  }
}

export function beep(freq = 880, ms = 120, volume = 0.25) {
  if (!soundOn || !ctx) return;
  try {
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(volume, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + ms / 1000 + 0.02);
  } catch {
    /* ignore */
  }
}

export function doneChime() {
  beep(660, 160);
  setTimeout(() => beep(990, 260), 170);
  buzz([120, 80, 120]);
}

export function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* iOS Safari has no vibration API */
  }
}

let lock: WakeLockSentinel | null = null;
let wantLock = false;

export async function keepAwake(on: boolean) {
  wantLock = on;
  try {
    if (on && !lock && 'wakeLock' in navigator) {
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => (lock = null));
    } else if (!on && lock) {
      await lock.release();
      lock = null;
    }
  } catch {
    /* denied or unsupported */
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && wantLock && !lock) void keepAwake(true);
});
