import type { Climb, Standing } from '../src/api/climb';

const standing = (overrides: Partial<Standing>): Standing => ({
  user_id: 'x',
  display_name: 'X',
  initials: 'XX',
  color: 'red',
  points: 0,
  position: 1,
  camp: 0,
  workouts_this_week: 0,
  goal_streak: 0,
  training_now: false,
  is_me: false,
  ...overrides,
});

export const CLIMB_ALL: Climb = {
  mode: 'all',
  camp_step: 1500,
  summit: 9000,
  weekly_target: 3,
  standings: [
    standing({
      user_id: 'maxo',
      display_name: 'Maxo',
      initials: 'MX',
      color: 'red',
      points: 4310,
      position: 1,
      camp: 2,
      workouts_this_week: 3,
      goal_streak: 12,
    }),
    standing({
      user_id: 'u1',
      display_name: 'Gabi',
      initials: 'GA',
      color: 'volt',
      points: 3880,
      position: 2,
      camp: 2,
      workouts_this_week: 2,
      goal_streak: 3,
      is_me: true,
    }),
    standing({
      user_id: 'santi',
      display_name: 'Santi',
      initials: 'SA',
      color: 'cyan',
      points: 3725,
      position: 3,
      camp: 2,
      workouts_this_week: 3,
      training_now: true,
    }),
  ],
  me: {
    position: 2,
    points: 3880,
    camp: 2,
    workouts_this_week: 2,
    goal_streak: 3,
    above: { display_name: 'Maxo', initials: 'MX', color: 'red', gap: 430, training_now: false },
    below: { display_name: 'Santi', initials: 'SA', color: 'cyan', gap: 155, training_now: true },
    next_camp: { camp: 3, points_needed: 620 },
  },
  improvement: { strength_pct: 11, volume_pct: -4, workouts_change: 3 },
};

export const CLIMB_WEEK: Climb = {
  ...CLIMB_ALL,
  mode: 'week',
  camp_step: 250,
  summit: 1500,
  standings: [
    { ...(CLIMB_ALL.standings[2] as Standing), points: 705, position: 1 },
    { ...(CLIMB_ALL.standings[0] as Standing), points: 620, position: 2 },
    { ...(CLIMB_ALL.standings[1] as Standing), points: 540, position: 3 },
  ],
  me: {
    ...CLIMB_ALL.me,
    position: 3,
    points: 540,
    above: { display_name: 'Maxo', initials: 'MX', color: 'red', gap: 80, training_now: false },
    below: null,
  },
};
