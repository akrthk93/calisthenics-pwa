import * as db from './db';
import { setSound } from './device';
import type { BodyMetric, LadderState, ProgressEvent, Session, Settings } from './types';

/** In-memory copy of everything, loaded once at start and written through to IndexedDB. */
export const store = {
  settings: null as unknown as Settings,
  ladders: [] as LadderState[],
  sessions: [] as Session[],
  metrics: [] as BodyMetric[],
  events: [] as ProgressEvent[],
};

export async function loadAll() {
  store.settings = await db.getSettings();
  store.ladders = await db.getLadders();
  store.sessions = await db.getSessions();
  store.metrics = await db.getMetrics();
  store.events = await db.getEvents();
  setSound(store.settings.sound);
}

export async function updateSettings(patch: Partial<Settings>) {
  store.settings = { ...store.settings, ...patch };
  setSound(store.settings.sound);
  await db.saveSettings(store.settings);
}

export async function setLadder(next: LadderState) {
  store.ladders = store.ladders.map((l) => (l.id === next.id ? next : l));
  await db.saveLadders(store.ladders);
}

export async function addSession(s: Session) {
  store.sessions = [s, ...store.sessions.filter((x) => x.id !== s.id)].sort((a, b) => b.at.localeCompare(a.at));
  await db.saveSession(s);
}

export async function removeSession(id: string) {
  store.sessions = store.sessions.filter((s) => s.id !== id);
  await db.deleteSession(id);
}

export async function addMetric(m: BodyMetric) {
  store.metrics = [m, ...store.metrics.filter((x) => x.id !== m.id)].sort((a, b) => b.day.localeCompare(a.day));
  await db.saveMetric(m);
}

export async function removeMetric(id: string) {
  store.metrics = store.metrics.filter((m) => m.id !== id);
  await db.deleteMetric(id);
}

export async function addEvent(e: ProgressEvent) {
  store.events = [e, ...store.events];
  await db.saveEvent(e);
}

export function ladderState(id: LadderState['id']): LadderState {
  return store.ladders.find((l) => l.id === id)!;
}
