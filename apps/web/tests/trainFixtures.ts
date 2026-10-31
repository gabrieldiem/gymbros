import type { Catalog, FinishResult, SetData, Workout } from '../src/api/train';

export const CATALOG: Catalog = {
  exercises: [
    {
      id: 'bench',
      name: 'Bench press',
      group: 'Chest',
      type: 'w',
      barbell: true,
      ppl: 'push',
      aliases_es: ['press de banca'],
    },
    {
      id: 'ohp',
      name: 'Overhead press',
      group: 'Shoulders',
      type: 'w',
      barbell: true,
      ppl: 'push',
      aliases_es: ['press militar'],
    },
    {
      id: 'squat',
      name: 'Back squat',
      group: 'Legs',
      type: 'w',
      barbell: true,
      ppl: 'legs',
      aliases_es: ['sentadilla'],
    },
    {
      id: 'run',
      name: 'Treadmill run',
      group: 'Cardio',
      type: 'c',
      barbell: false,
      ppl: null,
      aliases_es: ['cinta'],
    },
  ],
  routines: [
    { id: 'push', name: 'Push day', exercise_ids: ['bench', 'ohp'] },
    { id: 'legs', name: 'Leg day', exercise_ids: ['squat'] },
  ],
  points: {
    showed_up: 50,
    completed_set: 5,
    leg_event_set_bonus: 5,
    volume_kg_per_point: 100,
    cardio_minute: 3,
    pr: 100,
    weekly_goal: 150,
    goal_streak_per_week: 20,
    goal_streak_max: 100,
    over_target: 50,
    better_than_last_time: 25,
    weekly_target: 3,
  },
  weekly_event: 'leg_day_x2',
};

export const set = (load_kg: number | null, reps: number | null, done = false): SetData => ({
  load_kg,
  reps,
  minutes: null,
  km: null,
  done,
});

export function makeWorkout(overrides: Partial<Workout> = {}): Workout {
  return {
    id: 'w1',
    name: 'Push day',
    routine_id: 'push',
    started_at: new Date(Date.now() - 5 * 60_000).toISOString(),
    exercises: [
      {
        exercise_id: 'bench',
        sets: [set(92.5, 5), set(92.5, 5)],
        previous_sets: [set(90, 5, true), set(90, 5, true)],
      },
    ],
    live_points: 0,
    ...overrides,
  };
}

export const FINISHED: FinishResult = {
  workout_id: 'w1',
  name: 'Push day',
  started_at: '2026-11-02T18:00:00Z',
  finished_at: '2026-11-02T18:52:00Z',
  total: 213,
  line_items: [
    { key: 'ln_show', vars: {}, points: 50 },
    { key: 'ln_sets', vars: { n: 2 }, points: 10 },
    { key: 'ln_vol', vars: { kg: 925 }, points: 9 },
    { key: 'ln_pr', vars: { exercise_id: 'bench', load_kg: 92.5, reps: 5 }, points: 100 },
    { key: 'ln_better', vars: { pct: 3 }, points: 25 },
  ],
  volume_kg: 925,
  cardio_minutes: 0,
  completed_sets: 2,
  vs_last_pct: 3,
  prs: [{ exercise_id: 'bench', load_kg: 92.5, reps: 5 }],
  workouts_this_week: 2,
  weekly_target: 3,
};
