import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { buildLocalWorkout, hasCompletedSet, toQueued } from '../features/train/localWorkout';
import {
  addToOutbox,
  clearDraft,
  clearLocalWorkout,
  loadLocalWorkout,
  saveLocalWorkout,
  type QueuedWorkout,
  type StoredDraft,
} from '../features/train/offlineStore';
import { ApiError, apiRequest, isConnectionError } from './client';
import type { WorkoutDetail } from './compete';
import type { ClimbChange } from './climb';
import { gymsKey } from './gyms';
import { liveInterval } from './liveInterval';
import type { CrewColor } from './types';

export type ExerciseType = 'w' | 'bw' | 'c' | 's' | 'x';
export type MuscleGroup =
  'Chest' | 'Legs' | 'Back' | 'Shoulders' | 'Arms' | 'Core' | 'Cardio' | 'Mobility';

export type Exercise = {
  id: string;
  name: string;
  group: MuscleGroup;
  type: ExerciseType;
  barbell: boolean;
  ppl: 'push' | 'pull' | 'legs' | null;
  aliases_es: string[];
  /** Cardio only: run km one km of this is worth. */
  km_factor?: number;
  /** Stretching only: the minutes it starts with. */
  default_minutes?: number | null;
  /** A sport with no distance: only minutes are logged. */
  minute_effort_km?: number;
};

export type Routine = { id: string; name: string; exercise_ids: string[] };

export type PointsTable = {
  steps_per_point: number;
  steps_daily_cap: number;
  showed_up: number;
  completed_set: number;
  leg_event_set_bonus: number;
  volume_kg_per_point: number;
  cardio_minute: number;
  cardio_effort_km: number;
  pr: number;
  weekly_goal: number;
  goal_streak_per_week: number;
  goal_streak_max: number;
  over_target: number;
  better_than_last_time: number;
  stretching: number;
  weekly_target: number;
};

export type Catalog = {
  exercises: Exercise[];
  routines: Routine[];
  points: PointsTable;
  weekly_event: string | null;
};

export type SetData = {
  load_kg: number | null;
  reps: number | null;
  minutes: number | null;
  km: number | null;
  done: boolean;
  /** The bar inside `load_kg`, on a barbell lift. */
  bar_kg?: number | null;
  /** On this screen only: someone has typed in this row, so its numbers aren't suggestions. */
  started?: boolean;
};

export type WorkoutExercise = {
  exercise_id: string;
  sets: SetData[];
  previous_sets: SetData[];
  custom_name?: string | null;
};

export type Workout = {
  id: string;
  /** Started with no signal: only this phone knows about it until it's finished. */
  local?: boolean;
  name: string;
  routine_id: string | null;
  /** The past day this logs (a calendar day), or null for a workout happening now. */
  performed_on: string | null;
  gym: string | null;
  photo_url: string | null;
  started_at: string;
  exercises: WorkoutExercise[];
  live_points: number;
};

export type LineItem = { key: string; vars: Record<string, string | number>; points: number };

export type FinishResult = {
  workout_id: string;
  name: string;
  performed_on: string | null;
  started_at: string;
  finished_at: string;
  total: number;
  line_items: LineItem[];
  volume_kg: number;
  cardio_minutes: number;
  completed_sets: number;
  vs_last_pct: number | null;
  prs: { exercise_id: string; load_kg: number; reps: number; bar_kg?: number | null }[];
  workouts_this_week: number;
  weekly_target: number;
  climb: ClimbChange;
};

export type PastDay = { day: string; workouts: number };

export type Week = {
  workouts: number;
  target: number;
  leg_event_active: boolean;
  /** When the week's timed event ends, in crew time. */
  event_ends_at: string | null;
  /** The days a forgotten workout can be logged for, newest first. */
  past_days: PastDay[];
};

export type TrainingNowItem = {
  user_id: string;
  display_name: string;
  initials: string;
  avatar_url?: string | null;
  color: CrewColor;
  workout_name: string;
  gym: string | null;
  gym_lat?: number | null;
  gym_lon?: number | null;
  routine_id: string | null;
  started_at: string;
  current_exercise_id: string | null;
};

export type StartBody = {
  routine_id: string | null;
  name?: string;
  performed_on?: string;
  gym?: string | null;
};

export type WorkoutTemplate = {
  routine_id: string;
  name: string;
  exercises: WorkoutExercise[];
};

export type SaveBody = {
  name?: string;
  gym: string | null;
  exercises: { exercise_id: string; sets: SetData[]; custom_name?: string | null }[];
};

export const catalogKey = ['catalog'] as const;
export const activeWorkoutKey = ['workout', 'active'] as const;
export const weekKey = ['workout', 'week'] as const;
export const trainingNowKey = ['crew', 'training-now'] as const;
export const templatesKey = ['workout', 'templates'] as const;

export function useCatalog() {
  return useQuery({
    queryKey: catalogKey,
    queryFn: ({ signal }) => apiRequest<Catalog>('/catalog', { signal }),
    staleTime: Infinity,
  });
}

export function useActiveWorkout(enabled = true) {
  return useQuery({
    queryKey: activeWorkoutKey,
    enabled,
    // One started with no signal stays here, whatever the server says, until it's finished.
    queryFn: ({ signal }) =>
      loadLocalWorkout() ?? apiRequest<Workout | null>('/workouts/active', { signal }),
  });
}

export function useWeek() {
  return useQuery({
    queryKey: weekKey,
    queryFn: ({ signal }) => apiRequest<Week>('/workouts/week', { signal }),
  });
}

/** Who is mid-workout in the crew. Polled every 20 s while the tab is visible. */
export function useTrainingNow() {
  return useQuery({
    queryKey: trainingNowKey,
    queryFn: ({ signal }) => apiRequest<TrainingNowItem[]>('/crew/training-now', { signal }),
    refetchInterval: liveInterval,
  });
}

export function useWorkoutTemplates() {
  return useQuery({
    queryKey: templatesKey,
    queryFn: ({ signal }) => apiRequest<WorkoutTemplate[]>('/workouts/templates', { signal }),
    staleTime: 60_000,
  });
}

/** Start a workout. With no signal it starts anyway, on this phone. */
export function useStartWorkout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: StartBody) => {
      try {
        return await apiRequest<Workout>('/workouts', { method: 'POST', body });
      } catch (error) {
        if (!isConnectionError(error)) throw error;
        const gyms = queryClient.getQueryData<{ name: string; is_default: boolean }[]>(gymsKey);
        const workout = buildLocalWorkout(
          body,
          queryClient.getQueryData<Catalog>(catalogKey),
          queryClient.getQueryData<WorkoutTemplate[]>(templatesKey),
          gyms?.find((gym) => gym.is_default)?.name ?? null,
          new Date(),
        );
        saveLocalWorkout(workout);
        return workout;
      }
    },
    onSuccess: (workout) => queryClient.setQueryData(activeWorkoutKey, workout),
  });
}

/** PUT the whole logger state. The response carries the server's live points. */
export function saveWorkout(id: string, body: SaveBody): Promise<Workout> {
  return apiRequest<Workout>(`/workouts/${id}`, { method: 'PUT', body });
}

export function useDiscardWorkout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (loadLocalWorkout()?.id === id) return null;
      return apiRequest<null>(`/workouts/${id}`, { method: 'DELETE' });
    },
    onSuccess: (_result, id) => {
      clearLocalWorkout();
      clearDraft(id);
      queryClient.setQueryData(activeWorkoutKey, null);
      void queryClient.invalidateQueries({ queryKey: trainingNowKey });
    },
  });
}

type PhotoResult = { photo_url: string | null };

/** Add, replace or remove a workout's photo, and show the new one wherever it appears. */
export function useWorkoutPhoto(workoutId: string) {
  const queryClient = useQueryClient();
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: activeWorkoutKey });
    void queryClient.invalidateQueries({ queryKey: ['me', 'workouts', workoutId] });
    void queryClient.invalidateQueries({ queryKey: ['feed'] });
  };
  const upload = useMutation({
    mutationFn: (file: Blob) =>
      apiRequest<PhotoResult>(`/workouts/${workoutId}/photo`, { method: 'PUT', file }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: () => apiRequest<PhotoResult>(`/workouts/${workoutId}/photo`, { method: 'DELETE' }),
    onSuccess: refresh,
  });
  return { upload, remove };
}

/** Everything that changes when a workout arrives on the server. */
export function refreshAfterWorkout(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: weekKey });
  void queryClient.invalidateQueries({ queryKey: templatesKey });
  void queryClient.invalidateQueries({ queryKey: ['climb'] });
  void queryClient.invalidateQueries({ queryKey: trainingNowKey });
  void queryClient.invalidateQueries({ queryKey: ['feed'] });
  void queryClient.invalidateQueries({ queryKey: ['me', 'stats'] });
}

/** Change a finished workout. The answer is the workout as it now stands, rescored. */
export function useEditWorkout(workoutId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SaveBody) =>
      apiRequest<WorkoutDetail>(`/workouts/${workoutId}/edit`, { method: 'PUT', body }),
    onSuccess: (workout) => {
      queryClient.setQueryData(['me', 'workouts', workoutId], workout);
      refreshAfterWorkout(queryClient);
    },
  });
}

export function syncWorkout(workout: QueuedWorkout) {
  const { routine_id, name, gym, performed_on, started_at, finished_at, exercises } = workout;
  return apiRequest<FinishResult>(`/workouts/${workout.id}/sync`, {
    method: 'POST',
    body: { routine_id, name, gym, performed_on, started_at, finished_at, exercises },
  });
}

export type FinishOutcome = { queued: false; result: FinishResult } | { queued: true };

/**
 * Finish a workout. If the server can't be reached it waits on this phone instead (the outbox), so
 * finishing always works. How long it tries first is limited: nobody should stand there waiting.
 */
export function useFinishWorkout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      workout,
      draft,
      flush,
    }: {
      workout: Workout;
      draft: StoredDraft;
      flush: () => Promise<void>;
    }): Promise<FinishOutcome> => {
      const finishedAt = new Date();
      const queued = toQueued(workout, draft, finishedAt);
      try {
        if (workout.local) return { queued: false, result: await syncWorkout(queued) };
        await withinBudget(flush());
        const result = await apiRequest<FinishResult>(`/workouts/${workout.id}/finish`, {
          method: 'POST',
        });
        return { queued: false, result };
      } catch (error) {
        if (!isConnectionError(error)) throw error;
        // The server decides this, but it can't be asked and an empty workout would only fail later.
        if (!hasCompletedSet(draft)) {
          throw new ApiError(409, { detail: { code: 'workout_empty' } });
        }
        addToOutbox(queued);
        return { queued: true };
      }
    },
    onSuccess: (_outcome, { workout }) => {
      clearLocalWorkout();
      clearDraft(workout.id);
      queryClient.setQueryData(activeWorkoutKey, null);
      refreshAfterWorkout(queryClient);
    },
  });
}

const SAVE_BUDGET_MS = 8_000;

function withinBudget(saving: Promise<void>): Promise<void> {
  return Promise.race([
    saving,
    new Promise<void>((_resolve, reject) => {
      setTimeout(() => reject(new Error('Saving is taking too long')), SAVE_BUDGET_MS);
    }),
  ]);
}
