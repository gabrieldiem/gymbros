import type { FeedItem, FeedPage, HallOfFame, Inbox } from '../src/api/social';

export const MAXO = {
  user_id: 'maxo',
  display_name: 'Maxo',
  initials: 'MX',
  color: 'red' as const,
};
export const MATEX = {
  user_id: 'matex',
  display_name: 'Matex',
  initials: 'MT',
  color: 'violet' as const,
};
export const GABI = { user_id: 'u1', display_name: 'Gabi', initials: 'GA', color: 'volt' as const };

export const WORKOUT_POST: FeedItem = {
  id: 'f1',
  kind: 'workout',
  actor: MAXO,
  created_at: new Date(Date.now() - 2 * 3_600_000).toISOString(),
  vars: {
    name: 'Push day',
    routine_id: 'push',
    duration_min: 64,
    sets: 3,
    volume_kg: 6820,
    cardio_minutes: 0,
    points: 198,
    vs_last_pct: 6,
    prs: [{ exercise_id: 'bench', load_kg: 110, reps: 3 }],
    exercises: [
      {
        exercise_id: 'bench',
        sets: [
          { load_kg: 110, reps: 3, minutes: null, km: null },
          { load_kg: 105, reps: 5, minutes: null, km: null },
        ],
      },
    ],
  },
  reactions: { fist: 3, fire: 2, mine: [] },
  comments: [
    {
      id: 'c1',
      author: { user_id: 'santi', display_name: 'Santi', initials: 'SA', color: 'cyan' },
      body: 'Light weight baby',
      quick_key: null,
      created_at: new Date(Date.now() - 3_600_000).toISOString(),
    },
  ],
  is_mine: false,
};

export const RANK_UP: FeedItem = {
  ...WORKOUT_POST,
  id: 'f2',
  kind: 'rank_up',
  vars: { camp: 2 },
  comments: [],
};

export const FEED: FeedPage = {
  items: [WORKOUT_POST, RANK_UP],
  inactive: [{ member: MATEX, days: 3 }],
  next_before: null,
};

export const HOF: HallOfFame = {
  most_improved: [
    { member: MATEX, pct: 18 },
    { member: GABI, pct: 11 },
    { member: MAXO, pct: 4 },
  ],
  records: [
    { key: 'rec_heaviest', holder: GABI, vars: { exercise_id: 'squat', load_kg: 140, reps: 3 } },
    { key: 'rec_streak', holder: MAXO, vars: { n: 14 } },
    { key: 'rec_session', holder: MAXO, vars: { n: 412 } },
  ],
};

export const INBOX: Inbox = {
  unread: 1,
  items: [
    {
      id: 'n1',
      key: 'n_passed',
      vars: { name: 'Maxo' },
      link: '/climb',
      created_at: new Date(Date.now() - 600_000).toISOString(),
      read: false,
      actor: MAXO,
    },
    {
      id: 'n2',
      key: 'n_react',
      vars: { name: 'Santi', kind: 'fire', item: 'workout' },
      link: '/crew',
      created_at: new Date(Date.now() - 86_400_000).toISOString(),
      read: true,
      actor: { user_id: 'santi', display_name: 'Santi', initials: 'SA', color: 'cyan' },
    },
  ],
};
