import type { SetData, Workout } from '../../api/train';

/**
 * What's on this phone until the server has it. Plain localStorage: it has to survive a reload at
 * the gym, and a workout is small.
 */
const ACTIVE_KEY = 'gymbros.offline.active';
const OUTBOX_KEY = 'gymbros.offline.outbox';
const DRAFT_PREFIX = 'gymbros.offline.draft.';

export type StoredDraft = {
  name: string;
  gym: string | null;
  exercises: { exercise_id: string; sets: SetData[]; previous_sets: SetData[] }[];
};

/** A whole finished workout, as `POST /api/workouts/{id}/sync` takes it. */
export type QueuedWorkout = {
  id: string;
  routine_id: string | null;
  name: string;
  gym: string | null;
  performed_on: string | null;
  started_at: string;
  finished_at: string;
  exercises: { exercise_id: string; sets: SetData[] }[];
  /** The server refused it, so trying again won't help. */
  failed?: boolean;
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage is full or blocked. The server still gets it if there's signal.
  }
}

// ---- A workout started with no signal, which only this phone knows about.

export const loadLocalWorkout = (): Workout | null => read<Workout | null>(ACTIVE_KEY, null);

export const saveLocalWorkout = (workout: Workout) => write(ACTIVE_KEY, workout);

export const clearLocalWorkout = () => localStorage.removeItem(ACTIVE_KEY);

// ---- The edits of a workout the server knows about, until it has them.

export const loadDraft = (id: string): StoredDraft | null =>
  read<StoredDraft | null>(DRAFT_PREFIX + id, null);

export const saveDraft = (id: string, draft: StoredDraft) => write(DRAFT_PREFIX + id, draft);

export const clearDraft = (id: string) => localStorage.removeItem(DRAFT_PREFIX + id);

// ---- Finished workouts waiting for signal.

const listeners = new Set<() => void>();
let outbox: QueuedWorkout[] | null = null;

function currentOutbox(): QueuedWorkout[] {
  outbox ??= read<QueuedWorkout[]>(OUTBOX_KEY, []);
  return outbox;
}

function setOutbox(next: QueuedWorkout[]) {
  outbox = next;
  write(OUTBOX_KEY, next);
  listeners.forEach((listener) => listener());
}

export const getOutbox = (): QueuedWorkout[] => currentOutbox();

export function subscribeToOutbox(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function addToOutbox(workout: QueuedWorkout) {
  // The same id replaces: finishing can only be queued once, but never count it twice.
  setOutbox([...currentOutbox().filter((w) => w.id !== workout.id), workout]);
}

export function removeFromOutbox(id: string) {
  setOutbox(currentOutbox().filter((w) => w.id !== id));
}

export function markFailed(id: string) {
  setOutbox(currentOutbox().map((w) => (w.id === id ? { ...w, failed: true } : w)));
}

/** Signing out leaves nothing of this account on the phone. */
export function clearOfflineData() {
  clearLocalWorkout();
  Object.keys(localStorage)
    .filter((key) => key.startsWith(DRAFT_PREFIX))
    .forEach((key) => localStorage.removeItem(key));
  setOutbox([]);
}
