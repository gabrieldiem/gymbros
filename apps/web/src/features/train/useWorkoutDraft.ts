import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';

import {
  activeWorkoutKey,
  saveWorkout,
  type SaveBody,
  type SetData,
  type Workout,
} from '../../api/train';
import { AutosaveQueue, type SaveStatus } from './autosaveQueue';
import { forServer } from './barbell';
import {
  clearDraft,
  loadDraft,
  saveDraft,
  saveLocalWorkout,
  type StoredDraft,
} from './offlineStore';

export type DraftExercise = {
  exercise_id: string;
  sets: SetData[];
  previous_sets: SetData[];
  custom_name?: string | null;
};
export type Draft = {
  name: string;
  gym: string | null;
  /** Null for today, else the past day it's for. */
  performed_on: string | null;
  exercises: DraftExercise[];
};
export type { SaveStatus };

const RETRY_MS = 3000;

function toDraft(workout: Workout): Draft {
  return {
    name: workout.name,
    gym: workout.gym,
    performed_on: workout.performed_on,
    exercises: workout.exercises.map((e) => ({ ...e })),
  };
}

function fromStored(stored: StoredDraft, workout: Workout): Draft {
  const day = stored.performed_on === undefined ? workout.performed_on : stored.performed_on;
  return { ...stored, performed_on: day };
}

/** Last time's sets as the server sees them now: they depend on the day the workout is for. */
function withPrevious(draft: Draft, saved: Workout): Draft {
  const exercises = draft.exercises.map((e, i) => {
    const fresh = saved.exercises[i];
    return fresh?.exercise_id === e.exercise_id ? { ...e, previous_sets: fresh.previous_sets } : e;
  });
  return { ...draft, exercises };
}

function toBody(draft: Draft): SaveBody {
  const exercises = draft.exercises.map(({ exercise_id, sets, custom_name }) => ({
    exercise_id,
    sets: forServer(sets),
    ...(custom_name ? { custom_name } : {}),
  }));
  const name = draft.name.trim();
  const rest = { gym: draft.gym, performed_on: draft.performed_on, exercises };
  return name ? { name, ...rest } : rest;
}

/**
 * The logger's local state for an in-progress workout. Edits apply immediately and are saved
 * in the background. Points shown are always the server's `live_points` from the latest save.
 */
export function useWorkoutDraft(workout: Workout, debounceMs = 500) {
  const queryClient = useQueryClient();
  // Edits the server never got, from before a reload, win over what it last had.
  const [restored] = useState(() => {
    const stored = loadDraft(workout.id);
    return stored ? fromStored(stored, workout) : null;
  });
  const [draft, setDraft] = useState<Draft>(() => restored ?? toDraft(workout));
  const [livePoints, setLivePoints] = useState(workout.live_points);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [queue] = useState(
    () =>
      new AutosaveQueue<Draft, Workout>({
        save: async (value) => {
          if (workout.local) {
            const saved = { ...workout, ...value };
            saveLocalWorkout(saved);
            return saved;
          }
          const saved = await saveWorkout(workout.id, toBody(value));
          // Unless something newer is already waiting to be saved.
          if (JSON.stringify(loadDraft(workout.id)) === JSON.stringify(value)) {
            clearDraft(workout.id);
          }
          return saved;
        },
        onSaved: (saved) => {
          setLivePoints(saved.live_points);
          setDraft((current) => withPrevious(current, saved));
          queryClient.setQueryData(activeWorkoutKey, saved);
        },
        onStatus: setStatus,
        debounceMs,
        retryMs: RETRY_MS,
      }),
  );

  useEffect(() => {
    if (!workout.local && restored) {
      saveDraft(workout.id, restored); // As it's sent, so it's cleared once the server has it.
      queue.push(restored);
    }
    return () => queue.dispose();
  }, [queue, restored, workout.id, workout.local]);

  const update = useCallback(
    (change: (current: Draft) => Draft) =>
      setDraft((current) => {
        const next = change(current);
        if (!workout.local) saveDraft(workout.id, next);
        queue.push(next);
        return next;
      }),
    [queue, workout.id, workout.local],
  );

  const flush = useCallback(() => queue.flush(), [queue]);

  return { draft, update, livePoints, status, flush };
}
