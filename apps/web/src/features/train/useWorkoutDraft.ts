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
import { clearDraft, loadDraft, saveDraft, saveLocalWorkout } from './offlineStore';

export type DraftExercise = { exercise_id: string; sets: SetData[]; previous_sets: SetData[] };
export type Draft = { name: string; gym: string | null; exercises: DraftExercise[] };
export type { SaveStatus };

const RETRY_MS = 3000;

function toDraft(workout: Workout): Draft {
  return {
    name: workout.name,
    gym: workout.gym,
    exercises: workout.exercises.map((e) => ({ ...e })),
  };
}

function toBody(draft: Draft): SaveBody {
  const exercises = draft.exercises.map(({ exercise_id, sets }) => ({ exercise_id, sets }));
  const name = draft.name.trim();
  return name ? { name, gym: draft.gym, exercises } : { gym: draft.gym, exercises };
}

/**
 * The logger's local state for an in-progress workout. Edits apply immediately and are saved
 * in the background. Points shown are always the server's `live_points` from the latest save.
 */
export function useWorkoutDraft(workout: Workout, debounceMs = 500) {
  const queryClient = useQueryClient();
  // Edits the server never got, from before a reload, win over what it last had.
  const [restored] = useState(() => loadDraft(workout.id));
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
          queryClient.setQueryData(activeWorkoutKey, saved);
        },
        onStatus: setStatus,
        debounceMs,
        retryMs: RETRY_MS,
      }),
  );

  useEffect(() => {
    if (!workout.local && restored) queue.push(restored);
    return () => queue.dispose();
  }, [queue, restored, workout.local]);

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
