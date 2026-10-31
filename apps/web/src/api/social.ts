import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';

import { apiRequest } from './client';
import type { CrewColor } from './types';

export type Actor = { user_id: string; display_name: string; initials: string; color: CrewColor };
export type ReactionKind = 'fist' | 'fire';
export type Reactions = { fist: number; fire: number; mine: ReactionKind[] };
export type QuickReply = 'q_light' | 'q_beast' | 'q_form' | 'q_six' | 'q_spot' | 'q_respect';
export const QUICK_REPLIES: QuickReply[] = [
  'q_light',
  'q_beast',
  'q_form',
  'q_six',
  'q_spot',
  'q_respect',
];

export type Comment = {
  id: string;
  author: Actor;
  body: string | null;
  quick_key: QuickReply | null;
  created_at: string;
};

export type PostedSet = {
  load_kg: number | null;
  reps: number | null;
  minutes: number | null;
  km: number | null;
};

export type WorkoutPostVars = {
  name: string;
  routine_id: string | null;
  duration_min: number;
  sets: number;
  volume_kg: number;
  cardio_minutes: number;
  points: number;
  vs_last_pct: number | null;
  prs: { exercise_id: string; load_kg: number; reps: number }[];
  exercises: { exercise_id: string; sets: PostedSet[] }[];
};

export type FeedItem = {
  id: string;
  kind: 'workout' | 'rank_up' | 'badge' | string;
  actor: Actor;
  created_at: string;
  vars: Record<string, unknown>;
  reactions: Reactions;
  comments: Comment[];
  is_mine: boolean;
};

export type FeedPage = {
  items: FeedItem[];
  inactive: { member: Actor; days: number }[];
  next_before: string | null;
};

export type Notification = {
  id: string;
  key: string;
  vars: Record<string, string | number>;
  link: string;
  created_at: string;
  read: boolean;
  actor: Actor | null;
};

export type Inbox = { items: Notification[]; unread: number };

export type HallOfFame = {
  most_improved: { member: Actor; pct: number }[];
  records: { key: string; holder: Actor; vars: Record<string, string | number> }[];
};

export const feedKey = ['feed'] as const;
export const inboxKey = ['notifications'] as const;
export const hallOfFameKey = ['hall-of-fame'] as const;

type FeedData = InfiniteData<FeedPage, string | null>;

/** The crew feed, newest first, with "load more" pages. Polled every 20 s. */
export function useFeed() {
  return useInfiniteQuery({
    queryKey: feedKey,
    queryFn: ({ pageParam, signal }) =>
      apiRequest<FeedPage>(pageParam ? `/feed?before=${encodeURIComponent(pageParam)}` : '/feed', {
        signal,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_before,
    refetchInterval: 20_000,
  });
}

function updateItem(data: FeedData | undefined, id: string, change: (item: FeedItem) => FeedItem) {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.map((item) => (item.id === id ? change(item) : item)),
    })),
  };
}

export function toggledReactions(reactions: Reactions, kind: ReactionKind): Reactions {
  const had = reactions.mine.includes(kind);
  return {
    ...reactions,
    [kind]: Math.max(0, reactions[kind] + (had ? -1 : 1)),
    mine: had ? reactions.mine.filter((k) => k !== kind) : [...reactions.mine, kind],
  };
}

/** Toggle 👊/🔥. Optimistic: the count changes at once and rolls back on error. */
export function useReact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, kind }: { itemId: string; kind: ReactionKind }) =>
      apiRequest<Reactions>(`/feed/${itemId}/reactions`, { method: 'POST', body: { kind } }),
    onMutate: async ({ itemId, kind }) => {
      await queryClient.cancelQueries({ queryKey: feedKey });
      const previous = queryClient.getQueryData<FeedData>(feedKey);
      queryClient.setQueryData<FeedData>(feedKey, (data) =>
        updateItem(data, itemId, (item) => ({
          ...item,
          reactions: toggledReactions(item.reactions, kind),
        })),
      );
      return { previous };
    },
    onError: (_error, _vars, context) => queryClient.setQueryData(feedKey, context?.previous),
    onSuccess: (reactions, { itemId }) =>
      queryClient.setQueryData<FeedData>(feedKey, (data) =>
        updateItem(data, itemId, (item) => ({ ...item, reactions })),
      ),
  });
}

type CommentInput = { itemId: string; body?: string; quick_key?: QuickReply };

/** Add a comment; it appears in the thread as soon as the server confirms it. */
export function useComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, ...body }: CommentInput) =>
      apiRequest<Comment>(`/feed/${itemId}/comments`, { method: 'POST', body }),
    onSuccess: (comment, { itemId }) =>
      queryClient.setQueryData<FeedData>(feedKey, (data) =>
        updateItem(data, itemId, (item) => ({ ...item, comments: [...item.comments, comment] })),
      ),
  });
}

export function useNudge() {
  return useMutation({
    mutationFn: (userId: string) =>
      apiRequest<Actor>('/crew/nudges', { method: 'POST', body: { user_id: userId } }),
  });
}

/** The inbox, polled every 20 s (also drives the toasts for new notifications). */
export function useInbox(enabled = true) {
  return useQuery({
    queryKey: inboxKey,
    queryFn: ({ signal }) => apiRequest<Inbox>('/notifications', { signal }),
    refetchInterval: 20_000,
    enabled,
  });
}

export function useMarkInboxRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiRequest<null>('/notifications/read', { method: 'POST' }),
    onSuccess: () =>
      queryClient.setQueryData<Inbox>(inboxKey, (inbox) =>
        inbox ? { unread: 0, items: inbox.items.map((n) => ({ ...n, read: true })) } : inbox,
      ),
  });
}

export function useHallOfFame() {
  return useQuery({
    queryKey: hallOfFameKey,
    queryFn: ({ signal }) => apiRequest<HallOfFame>('/crew/hall-of-fame', { signal }),
  });
}
