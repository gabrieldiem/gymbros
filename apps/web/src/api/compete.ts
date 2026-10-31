import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Climb } from './climb';
import { apiRequest } from './client';
import type { Actor } from './social';

export type QuestId = 'legs2' | 'ppl' | 'tonnes' | 'cardio';
export type Quest = {
  id: QuestId;
  goal: number;
  bonus: number;
  progress: number;
  claimed: boolean;
};

export type QuestBoard = {
  week_start: string;
  ends_at: string;
  quests: Quest[];
  crew_quest: {
    goal: number;
    bonus: number;
    total: number;
    shares: { member: Actor; points: number }[];
    claimed: boolean;
  };
  bounty: { target: Actor | null; target_points: number; points: number; claimed_by: Actor | null };
  weekly_event: string | null;
  duel_points: number;
};

export type BadgeId =
  | 'first' | 'better' | 'twoplates' | 'tonnage' | 'ironmonth' | 'plateclub' | 'dawn' | 'legs'
  | 'hunter' | 'rope' | 'hype' | 'trash' | 'owl' | 'comeback' | 'unstoppable'; // prettier-ignore

export type Badge = {
  id: BadgeId;
  goal: number;
  points: number;
  icon: string;
  color: string;
  progress: number;
  unlocked_at: string | null;
  crew_count: number;
};

export type DuelMetric = 'points' | 'bench_volume';
export type Stake = 'stake_shakes' | 'stake_plates' | 'stake_playlist' | 'stake_burritos';
export const STAKES: Stake[] = ['stake_shakes', 'stake_plates', 'stake_playlist', 'stake_burritos'];

export type Duel = {
  id: string;
  status: 'pending' | 'active' | 'declined' | 'settled';
  metric: DuelMetric;
  stake: Stake;
  week_start: string;
  challenger: Actor;
  opponent: Actor;
  challenger_value: number;
  opponent_value: number;
  winner_id: string | null;
};

type RecapPr = { member: Actor; exercise_id: string; load_kg: number; reps: number };

export type Recap = {
  week_start: string;
  crew_total: number;
  biggest_climber: Actor | null;
  biggest_climber_points: number;
  biggest_climber_workouts: number;
  heaviest_pr: RecapPr | null;
  my_points: number;
  my_workouts: number;
  weekly_target: number;
  my_volume_kg: number;
  position_before: number;
  position_after: number;
  my_best_pr: RecapPr | null;
  most_improved: Actor | null;
  most_improved_pct: number | null;
  bounty_target: Actor | null;
  weekly_event: string | null;
};

export type MeStats = {
  climb: Climb;
  workouts_total: number;
  badges_unlocked: number;
  heatmap: { day: string; workouts: number }[];
  weekly_volume: { week_start: string; volume_kg: number }[];
  prs: { exercise_id: string; load_kg: number; reps: number; e1rm: number; achieved_at: string }[];
  history: {
    id: string;
    name: string;
    finished_at: string;
    duration_min: number;
    points: number;
    sets: number;
    volume_kg: number;
  }[];
};

export type LiftPoint = { week_start: string; e1rm: number };

export const questsKey = ['quests'] as const;
export const badgesKey = ['badges'] as const;
export const duelsKey = ['duels'] as const;

export function useQuests() {
  return useQuery({
    queryKey: questsKey,
    queryFn: ({ signal }) => apiRequest<QuestBoard>('/quests', { signal }),
    refetchInterval: 20_000,
  });
}

export function useBadges() {
  return useQuery({
    queryKey: badgesKey,
    queryFn: ({ signal }) => apiRequest<Badge[]>('/badges', { signal }),
  });
}

export function useDuels() {
  return useQuery({
    queryKey: duelsKey,
    queryFn: ({ signal }) => apiRequest<Duel[]>('/duels', { signal }),
    refetchInterval: 20_000,
  });
}

export function useChallenge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { opponent_id: string; metric: DuelMetric; stake: Stake }) =>
      apiRequest<Duel>('/duels', { method: 'POST', body }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: duelsKey }),
  });
}

export function useRespondDuel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) =>
      apiRequest<Duel>(`/duels/${id}/${accept ? 'accept' : 'decline'}`, { method: 'POST' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: duelsKey }),
  });
}

export function useRecap(enabled: boolean) {
  return useQuery({
    queryKey: ['recap'],
    queryFn: ({ signal }) => apiRequest<Recap>('/recap', { signal }),
    enabled,
  });
}

export function useMyStats() {
  return useQuery({
    queryKey: ['me', 'stats'],
    queryFn: ({ signal }) => apiRequest<MeStats>('/me/stats', { signal }),
  });
}

export function useLiftHistory(exerciseId: string | null) {
  return useQuery({
    queryKey: ['me', 'prs', exerciseId],
    queryFn: ({ signal }) => apiRequest<LiftPoint[]>(`/me/prs/${exerciseId ?? ''}`, { signal }),
    enabled: exerciseId !== null,
  });
}
