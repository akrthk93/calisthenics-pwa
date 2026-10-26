import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { dayKey } from './dates';
import { initialLadders } from './logic';
import type { Backup, BodyMetric, LadderState, ProgressEvent, Session, Settings } from './types';

interface Schema extends DBSchema {
  kv: { key: string; value: unknown };
  sessions: { key: string; value: Session; indexes: { day: string } };
  metrics: { key: string; value: BodyMetric };
  events: { key: string; value: ProgressEvent };
}

let dbp: Promise<IDBPDatabase<Schema>> | null = null;

function db() {
  dbp ??= openDB<Schema>('calisthenics', 1, {
    upgrade(d) {
      d.createObjectStore('kv');
      d.createObjectStore('sessions', { keyPath: 'id' }).createIndex('day', 'day');
      d.createObjectStore('metrics', { keyPath: 'id' });
      d.createObjectStore('events', { keyPath: 'id' });
    },
  });
  return dbp;
}

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export function defaultSettings(today = dayKey()): Settings {
  return { startDate: today, hasBands: false, restSec: 60, barRestSec: 90, sound: true, deloadUntil: null, videos: {} };
}

export async function getSettings(): Promise<Settings> {
  const s = (await (await db()).get('kv', 'settings')) as Settings | undefined;
  if (s) return { ...defaultSettings(), ...s };
  const fresh = defaultSettings();
  await saveSettings(fresh);
  return fresh;
}

export async function saveSettings(s: Settings) {
  await (await db()).put('kv', s, 'settings');
}

export async function getLadders(): Promise<LadderState[]> {
  const l = (await (await db()).get('kv', 'ladders')) as LadderState[] | undefined;
  const fresh = initialLadders(dayKey());
  if (l) {
    // Add any ladders introduced after this data was created.
    const missing = fresh.filter((f) => !l.some((x) => x.id === f.id));
    if (!missing.length) return l;
    const merged = [...l, ...missing];
    await saveLadders(merged);
    return merged;
  }
  await saveLadders(fresh);
  return fresh;
}

export async function saveLadders(l: LadderState[]) {
  await (await db()).put('kv', l, 'ladders');
}

export async function getSessions(): Promise<Session[]> {
  const all = await (await db()).getAll('sessions');
  return all.sort((a, b) => b.at.localeCompare(a.at));
}

export async function saveSession(s: Session) {
  await (await db()).put('sessions', s);
}

export async function deleteSession(id: string) {
  await (await db()).delete('sessions', id);
}

export async function getMetrics(): Promise<BodyMetric[]> {
  const all = await (await db()).getAll('metrics');
  return all.sort((a, b) => b.day.localeCompare(a.day));
}

export async function saveMetric(m: BodyMetric) {
  await (await db()).put('metrics', m);
}

export async function deleteMetric(id: string) {
  await (await db()).delete('metrics', id);
}

export async function getEvents(): Promise<ProgressEvent[]> {
  const all = await (await db()).getAll('events');
  return all.sort((a, b) => b.day.localeCompare(a.day));
}

export async function saveEvent(e: ProgressEvent) {
  await (await db()).put('events', e);
}

export async function exportBackup(): Promise<Backup> {
  return {
    app: 'calisthenics-pwa',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: await getSettings(),
    ladders: await getLadders(),
    sessions: await getSessions(),
    metrics: await getMetrics(),
    events: await getEvents(),
  };
}

export function validateBackup(x: unknown): x is Backup {
  const b = x as Backup;
  return !!b && b.app === 'calisthenics-pwa' && b.version === 1 && Array.isArray(b.sessions) && Array.isArray(b.ladders) && !!b.settings;
}

/** Replaces all data with the backup. */
export async function importBackup(b: Backup) {
  const d = await db();
  const tx = d.transaction(['kv', 'sessions', 'metrics', 'events'], 'readwrite');
  await Promise.all([
    tx.objectStore('kv').clear(),
    tx.objectStore('sessions').clear(),
    tx.objectStore('metrics').clear(),
    tx.objectStore('events').clear(),
  ]);
  await tx.objectStore('kv').put(b.settings, 'settings');
  await tx.objectStore('kv').put(b.ladders, 'ladders');
  for (const s of b.sessions) await tx.objectStore('sessions').put(s);
  for (const m of b.metrics ?? []) await tx.objectStore('metrics').put(m);
  for (const e of b.events ?? []) await tx.objectStore('events').put(e);
  await tx.done;
}

export async function requestPersistence() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch {
    /* not supported */
  }
}
