import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiRequest } from './client';
import type { CrewColor } from './types';

export type ExerciseType = 'w' | 'bw' | 'c';
export type MuscleGroup = 'Chest' | 'Legs' | 'Back' | 'Shoulders' | 'Arms' | 'Cardio';

export type Exercise = {
  id: string;
  name: string;
  group: MuscleGroup;
  type: ExerciseType;
  barbell: boolean;
  ppl: 'push' | 'pull' | 'legs' | null;
  aliases_es: string[];
};

export type Routine = { id: string; name: string; exercise_ids: string[] };

export type PointsTable = {
  showed_up: number;
  completed_set: number;
  leg_event_set_bonus: number;
  volume_kg_per_point: number;
  cardio_minute: number;
  pr: number;
  weekly_goal: number;
  goal_streak_per_week: number;
  goal_streak_max: number;
  over_target: number;
  better_than_last_time: number;
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
};

export type WorkoutExercise = { exercise_id: string; sets: SetData[]; previous_sets: SetData[] };

export type Workout = {
  id: string;
  name: string;
  routine_id: string | null;
  started_at: string;
  exercises: WorkoutExercise[];
  live_points: number;
};

export type LineItem = { key: string; vars: Record<string, string | number>; points: number };

export type FinishResult = {
  workout_id: string;
  name: string;
  started_at: string;
  finished_at: string;
  total: number;
  line_items: LineItem[];
  volume_kg: number;
  cardio_minutes: number;
  completed_sets: number;
  vs_last_pct: number | null;
  prs: { exercise_id: string; load_kg: number; reps: number }[];
  workouts_this_week: number;
  weekly_target: number;
};

export type Week = { workouts: number; target: number; leg_event_active: boolean };

export type TrainingNowItem = {
  user_id: string;
  display_name: string;
  initials: string;
  color: CrewColor;
  workout_name: string;
  routine_id: string | null;
  started_at: string;
  current_exercise_id: string | null;
};

export type SaveBody = {
  name?: string;
  exercises: { exercise_id: string; sets: SetData[] }[];
};

export const catalogKey = ['catalog'] as const;
export const activeWorkoutKey = ['workout', 'active'] as const;
export const weekKey = ['workout', 'week'] as const;
export const trainingNowKey = ['crew', 'training-now'] as const;

export function useCatalog() {
  return useQuery({
    queryKey: catalogKey,
    queryFn: ({ signal }) => apiRequest<Catalog>('/catalog', { signal }),
    staleTime: Infinity,
  });
}

export function useActiveWorkout() {
  return useQuery({
    queryKey: activeWorkoutKey,
    queryFn: ({ signal }) => apiRequest<Workout | null>('/workouts/active', { signal }),
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
    refetchInterval: 20_000,
  });
}

export function useStartWorkout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { routine_id: string | null; name?: string }) =>
      apiRequest<Workout>('/workouts', { method: 'POST', body }),
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
    mutationFn: (id: string) => apiRequest<null>(`/workouts/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.setQueryData(activeWorkoutKey, null);
      void queryClient.invalidateQueries({ queryKey: trainingNowKey });
    },
  });
}

export function useFinishWorkout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<FinishResult>(`/workouts/${id}/finish`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.setQueryData(activeWorkoutKey, null);
      void queryClient.invalidateQueries({ queryKey: weekKey });
      void queryClient.invalidateQueries({ queryKey: trainingNowKey });
    },
  });
}
