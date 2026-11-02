import type { Standing } from '../../api/climb';

/** Made-up standings for the public page. Never real members. Camps are 1,500 points apart. */
export const SAMPLE_CAMP_STEP = 1500;
export const SAMPLE_SUMMIT = SAMPLE_CAMP_STEP * 6;
export const SAMPLE_WEEKLY_TARGET = 3;
export const SAMPLE_YOU = 'alex';

export const SAMPLE_CREW: Standing[] = [
  {
    user_id: 'sam',
    display_name: 'Sam',
    initials: 'SA',
    color: 'red',
    points: 5520,
    position: 1,
    camp: 3,
    workouts_this_week: 3,
    goal_streak: 6,
    training_now: false,
    is_me: false,
  },
  {
    user_id: 'jordan',
    display_name: 'Jordan',
    initials: 'JO',
    color: 'cyan',
    points: 5010,
    position: 2,
    camp: 3,
    workouts_this_week: 2,
    goal_streak: 3,
    training_now: false,
    is_me: false,
  },
  {
    user_id: 'alex',
    display_name: 'Alex',
    initials: 'AL',
    color: 'volt',
    points: 4830,
    position: 3,
    camp: 3,
    workouts_this_week: 2,
    goal_streak: 4,
    training_now: false,
    is_me: true,
  },
  {
    user_id: 'riley',
    display_name: 'Riley',
    initials: 'RI',
    color: 'pink',
    points: 3430,
    position: 4,
    camp: 2,
    workouts_this_week: 1,
    goal_streak: 1,
    training_now: true,
    is_me: false,
  },
  {
    user_id: 'casey',
    display_name: 'Casey',
    initials: 'CA',
    color: 'violet',
    points: 2240,
    position: 5,
    camp: 1,
    workouts_this_week: 1,
    goal_streak: 0,
    training_now: false,
    is_me: false,
  },
];

/** The sample crew after Alex gained `gained` points over `finished` workouts, re-ranked. */
export function rankSample(gained: number, finished: number): Standing[] {
  return SAMPLE_CREW.map((member) =>
    member.user_id === SAMPLE_YOU
      ? {
          ...member,
          points: member.points + gained,
          workouts_this_week: member.workouts_this_week + finished,
          camp: Math.floor((member.points + gained) / SAMPLE_CAMP_STEP),
        }
      : member,
  )
    .sort((a, b) => b.points - a.points)
    .map((member, index) => ({ ...member, position: index + 1 }));
}
