import { useQuery } from '@tanstack/react-query';

import { apiRequest } from './client';
import type { LineItem, PointsTable } from './train';

export type RuleBadge = { id: string; goal: number; points: number; icon: string; color: string };
export type RuleQuest = { id: string; goal: number; bonus: number };

export type SampleSession = {
  id: 'lift' | 'run' | 'swim';
  minutes: number;
  km: number | null;
  tonnes: number | null;
  total: number;
  line_items: LineItem[];
};

export type Rules = {
  points: PointsTable;
  crew_quest: number;
  crew_quest_goal: number;
  bounty: number;
  duel_win: number;
  rank_step: number;
  rank_count: number;
  swim_km_factor: number;
  quests: RuleQuest[];
  badges: RuleBadge[];
  sessions: SampleSession[];
};

/** What the game pays. Public, and it only changes with a deploy. */
export function useRules() {
  return useQuery({
    queryKey: ['rules'],
    queryFn: ({ signal }) => apiRequest<Rules>('/rules', { signal }),
    staleTime: 60 * 60 * 1000,
  });
}
