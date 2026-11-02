import type { Catalog, SetData, StartBody, Workout, WorkoutTemplate } from '../../api/train';
import { forServer } from './barbell';
import type { QueuedWorkout, StoredDraft } from './offlineStore';

const EMPTY_SET: SetData = { load_kg: null, reps: null, minutes: null, km: null, done: false };

function newId(): string {
  return crypto.randomUUID();
}

/** A routine or empty workout started with no signal, from what the phone already has. */
export function buildLocalWorkout(
  body: StartBody,
  catalog: Catalog | undefined,
  templates: WorkoutTemplate[] | undefined,
  defaultGym: string | null,
  now: Date,
): Workout {
  const template = templates?.find((t) => t.routine_id === body.routine_id);
  const routine = catalog?.routines.find((r) => r.id === body.routine_id);
  const fallback = (routine?.exercise_ids ?? []).map((exercise_id) => {
    const single = catalog?.exercises.find((e) => e.id === exercise_id);
    const count = single?.type === 'c' || single?.type === 's' ? 1 : 3;
    const set = { ...EMPTY_SET, minutes: single?.default_minutes ?? null };
    return {
      exercise_id,
      sets: Array.from({ length: count }, () => ({ ...set })),
      previous_sets: [],
    };
  });
  return {
    id: newId(),
    local: true,
    name: body.name ?? template?.name ?? routine?.name ?? 'Workout',
    routine_id: body.routine_id,
    performed_on: body.performed_on ?? null,
    gym: body.gym === undefined ? defaultGym : body.gym,
    photo_url: null,
    started_at: now.toISOString(),
    exercises: template?.exercises ?? fallback,
    live_points: 0,
  };
}

/** The whole workout, ready for the server. */
export function toQueued(workout: Workout, draft: StoredDraft, finishedAt: Date): QueuedWorkout {
  return {
    id: workout.id,
    routine_id: workout.routine_id,
    name: draft.name.trim() || workout.name,
    gym: draft.gym,
    performed_on: workout.performed_on,
    started_at: workout.started_at,
    finished_at: finishedAt.toISOString(),
    exercises: draft.exercises.map(({ exercise_id, sets }) => ({
      exercise_id,
      sets: forServer(sets),
    })),
  };
}

/** A set that would count. Scoring is the server's, but this is what "nothing to finish" is. */
export function hasCompletedSet(draft: StoredDraft): boolean {
  return draft.exercises.some((e) => e.sets.some((s) => s.done && Boolean(s.reps || s.minutes)));
}
