import type { LadderId } from './data/exercises';

export interface Settings {
  /** YYYY-MM-DD local date the plan started (drives 2 vs 3 sets). */
  startDate: string;
  hasBands: boolean;
  restSec: number;
  barRestSec: number;
  sound: boolean;
  /** YYYY-MM-DD; while today <= this date, plan uses 2 sets (stall deload). */
  deloadUntil: string | null;
  /** Per-step YouTube video id overrides. */
  videos: Record<string, string>;
}

export interface LadderState {
  id: LadderId;
  stepIndex: number;
  /** YYYY-MM-DD the current step started. */
  since: string;
}

export interface Entry {
  ladderId: LadderId | null;
  stepId: string;
  /** Planned set count when logged. */
  planned: number;
  /** Reps, or seconds for holds, per set. */
  sets: number[];
}

export type SessionKind = 'strength' | 'minimum' | 'walk';

export interface Session {
  id: string;
  /** ISO datetime of completion. */
  at: string;
  /** YYYY-MM-DD local. */
  day: string;
  kind: SessionKind;
  durationSec: number;
  walkMin?: number;
  entries: Entry[];
}

export interface BodyMetric {
  id: string;
  day: string;
  weightKg?: number;
  waistCm?: number;
}

export interface ProgressEvent {
  id: string;
  day: string;
  ladderId: LadderId;
  fromIndex: number;
  toIndex: number;
}

export interface Backup {
  app: 'calisthenics-pwa';
  version: 1;
  exportedAt: string;
  settings: Settings;
  ladders: LadderState[];
  sessions: Session[];
  metrics: BodyMetric[];
  events: ProgressEvent[];
}
