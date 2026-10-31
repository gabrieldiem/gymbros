import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { apiRequest } from './client';
import type { CrewColor } from './types';

export type ClimbMode = 'all' | 'week';

export type Standing = {
  user_id: string;
  display_name: string;
  initials: string;
  color: CrewColor;
  points: number;
  position: number;
  camp: number;
  workouts_this_week: number;
  goal_streak: number;
  training_now: boolean;
  is_me: boolean;
};

export type Neighbour = {
  display_name: string;
  initials: string;
  color: CrewColor;
  gap: number;
  training_now: boolean;
};

export type Climb = {
  mode: ClimbMode;
  camp_step: number;
  summit: number;
  weekly_target: number;
  standings: Standing[];
  me: {
    position: number;
    points: number;
    camp: number;
    workouts_this_week: number;
    goal_streak: number;
    above: Neighbour | null;
    below: Neighbour | null;
    next_camp: { camp: number; points_needed: number } | null;
  };
  improvement: { strength_pct: number | null; volume_pct: number | null; workouts_change: number };
};

export type ClimbChange = {
  points_before: number;
  points_after: number;
  camp_before: number;
  camp_after: number;
  passed: string[];
};

export const climbKey = (mode: ClimbMode) => ['climb', mode] as const;

/** Standings, polled every 20 s while the tab is visible. Keeps the old data while switching mode. */
export function useClimb(mode: ClimbMode) {
  return useQuery({
    queryKey: climbKey(mode),
    queryFn: ({ signal }) => apiRequest<Climb>(`/climb?mode=${mode}`, { signal }),
    refetchInterval: 20_000,
    placeholderData: keepPreviousData,
  });
}
