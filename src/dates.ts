const pad = (n: number) => String(n).padStart(2, '0');

export function dayKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDay(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, n: number): string {
  const d = parseDay(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86_400_000);
}

/** Monday of the week containing `key`. */
export function weekStart(key: string): string {
  const d = parseDay(key);
  const dow = (d.getDay() + 6) % 7; // Mon=0
  return addDays(key, -dow);
}

/** 0 = Monday … 6 = Sunday */
export function weekday(key: string): number {
  return (parseDay(key).getDay() + 6) % 7;
}

/** Mon, Wed, Fri */
export const STRENGTH_DAYS = [0, 2, 4];

export function isStrengthDay(key: string): boolean {
  return STRENGTH_DAYS.includes(weekday(key));
}

export function fmtDay(key: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }): string {
  return parseDay(key).toLocaleDateString('en-SG', opts);
}

export function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m ? `${m}:${pad(s)}` : `${s}s`;
}

/** Always m:ss, e.g. 0:07, 12:30 */
export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${pad(s % 60)}`;
}
