import type { Badge, Duel, MeStats, QuestBoard, Recap } from '../src/api/compete';
import { CLIMB_ALL } from './climbFixtures';
import { GABI, MATEX, MAXO } from './crewFixtures';

export const BOARD: QuestBoard = {
  week_start: '2026-11-02',
  ends_at: '2026-11-09T03:00:00Z',
  quests: [
    { id: 'legs2', goal: 2, bonus: 150, progress: 1, claimed: false },
    { id: 'ppl', goal: 3, bonus: 120, progress: 3, claimed: true },
    { id: 'tonnes', goal: 20, bonus: 200, progress: 12.4, claimed: false },
    { id: 'cardio', goal: 60, bonus: 100, progress: 25, claimed: false },
  ],
  crew_quest: {
    goal: 4000,
    bonus: 200,
    total: 2655,
    shares: [
      { member: MAXO, points: 620 },
      { member: GABI, points: 540 },
      { member: MATEX, points: 480 },
    ],
    claimed: false,
  },
  bounty: { target: MAXO, target_points: 4310, points: 150, claimed_by: null },
  weekly_event: 'leg_day_x2',
  duel_points: 150,
};

export const BADGES: Badge[] = [
  {
    id: 'first',
    goal: 1,
    points: 50,
    icon: 'boot',
    color: '#7CFF4F',
    progress: 1,
    unlocked_at: '2026-10-01T10:00:00Z',
    crew_count: 5,
  },
  {
    id: 'tonnage',
    goal: 100,
    points: 150,
    icon: 'kettle',
    color: '#FFE600',
    progress: 82.4,
    unlocked_at: null,
    crew_count: 3,
  },
];

export const DUEL_IN: Duel = {
  id: 'd1',
  status: 'pending',
  metric: 'bench_volume',
  stake: 'stake_shakes',
  week_start: '2026-11-02',
  challenger: MAXO,
  opponent: GABI,
  challenger_value: 3105,
  opponent_value: 2340,
  winner_id: null,
};

export const RECAP: Recap = {
  week_start: '2026-10-26',
  crew_total: 4870,
  biggest_climber: { user_id: 'santi', display_name: 'Santi', initials: 'SA', color: 'cyan' },
  biggest_climber_points: 812,
  biggest_climber_workouts: 5,
  heaviest_pr: { member: MAXO, exercise_id: 'bench', load_kg: 110, reps: 3 },
  my_points: 640,
  my_workouts: 4,
  weekly_target: 3,
  my_volume_kg: 19200,
  position_before: 3,
  position_after: 2,
  my_best_pr: null,
  most_improved: MATEX,
  most_improved_pct: 18,
  bounty_target: MAXO,
  weekly_event: 'leg_day_x2',
};

export const STATS: MeStats = {
  climb: CLIMB_ALL,
  workouts_total: 64,
  badges_unlocked: 7,
  heatmap: Array.from({ length: 84 }, (_, i) => ({
    day: new Date(Date.UTC(2026, 7, 10 + i)).toISOString().slice(0, 10),
    workouts: i % 3 === 0 ? 1 : 0,
  })),
  weekly_volume: Array.from({ length: 8 }, (_, i) => ({
    week_start: new Date(Date.UTC(2026, 8, 14 + i * 7)).toISOString().slice(0, 10),
    volume_kg: 15000 + i * 900,
  })),
  prs: [
    { exercise_id: 'squat', load_kg: 140, reps: 3, e1rm: 154, achieved_at: '2026-10-20T20:00:00Z' },
  ],
  history: [
    {
      id: 'w1',
      name: 'Leg day',
      finished_at: new Date(Date.now() - 86_400_000).toISOString(),
      duration_min: 72,
      points: 241,
      sets: 19,
      volume_kg: 9450,
    },
  ],
};
