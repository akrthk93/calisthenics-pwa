import { beep, doneChime } from './device';

export type TimerMode = 'down' | 'up';

/**
 * Wall-clock based timer, so it stays correct if the phone locks or the tab is backgrounded.
 * Countdown beeps at 3-2-1 and chimes at zero.
 */
export class Timer {
  private startedAt = 0;
  private pausedElapsed = 0;
  private running = false;
  private handle = 0;
  private lastBeep = -1;
  private finished = false;

  constructor(
    public readonly mode: TimerMode,
    public readonly seconds: number,
    private readonly onTick: (display: number, t: Timer) => void,
    private readonly onDone?: () => void,
  ) {}

  get isRunning() {
    return this.running;
  }

  elapsed(): number {
    return this.pausedElapsed + (this.running ? (Date.now() - this.startedAt) / 1000 : 0);
  }

  /** Seconds to show: remaining for countdowns, elapsed for count-ups. */
  display(): number {
    const e = this.elapsed();
    return this.mode === 'down' ? Math.max(0, Math.ceil(this.seconds - e)) : Math.floor(e);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.startedAt = Date.now();
    this.loop();
  }

  pause() {
    if (!this.running) return;
    this.pausedElapsed = this.elapsed();
    this.running = false;
    clearTimeout(this.handle);
    this.onTick(this.display(), this);
  }

  toggle() {
    if (this.running) this.pause();
    else this.start();
  }

  /** Add seconds to a countdown. */
  add(sec: number) {
    if (this.mode !== 'down') return;
    this.pausedElapsed -= sec;
    this.finished = false;
    this.lastBeep = -1;
    this.onTick(this.display(), this);
  }

  stop() {
    this.running = false;
    clearTimeout(this.handle);
  }

  private loop = () => {
    if (!this.running) return;
    const d = this.display();
    this.onTick(d, this);

    const target = this.mode === 'down' ? this.seconds : 0;
    const remaining = this.mode === 'down' ? d : target > 0 ? target - d : Infinity;

    if (remaining <= 3 && remaining >= 1 && this.lastBeep !== remaining) {
      this.lastBeep = remaining;
      beep(880, 110);
    }
    if (this.mode === 'down' && d <= 0 && !this.finished) {
      this.finished = true;
      this.running = false;
      this.pausedElapsed = this.seconds;
      doneChime();
      this.onDone?.();
      return;
    }
    this.handle = window.setTimeout(this.loop, 200);
  };
}
