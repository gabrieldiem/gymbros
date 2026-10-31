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

export type DraftExercise = { exercise_id: string; sets: SetData[]; previous_sets: SetData[] };
export type Draft = { name: string; exercises: DraftExercise[] };
export type { SaveStatus };

const RETRY_MS = 3000;

function toDraft(workout: Workout): Draft {
  return { name: workout.name, exercises: workout.exercises.map((e) => ({ ...e })) };
}

function toBody(draft: Draft): SaveBody {
  const exercises = draft.exercises.map(({ exercise_id, sets }) => ({ exercise_id, sets }));
  const name = draft.name.trim();
  return name ? { name, exercises } : { exercises };
}

/**
 * The logger's local state for an in-progress workout. Edits apply immediately and are saved
 * in the background. Points shown are always the server's `live_points` from the latest save.
 */
export function useWorkoutDraft(workout: Workout, debounceMs = 500) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>(() => toDraft(workout));
  const [livePoints, setLivePoints] = useState(workout.live_points);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [queue] = useState(
    () =>
      new AutosaveQueue<Draft, Workout>({
        save: (value) => saveWorkout(workout.id, toBody(value)),
        onSaved: (saved) => {
          setLivePoints(saved.live_points);
          queryClient.setQueryData(activeWorkoutKey, saved);
        },
        onStatus: setStatus,
        debounceMs,
        retryMs: RETRY_MS,
      }),
  );

  useEffect(() => () => queue.dispose(), [queue]);

  const update = useCallback(
    (change: (current: Draft) => Draft) =>
      setDraft((current) => {
        const next = change(current);
        queue.push(next);
        return next;
      }),
    [queue],
  );

  const flush = useCallback(() => queue.flush(), [queue]);

  return { draft, update, livePoints, status, flush };
}
