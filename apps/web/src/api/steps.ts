import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { apiRequest } from './client';
import type { CrewColor } from './types';

export type StepsMode = 'week' | 'all';
export type StepEntry = {
  id: string;
  start_date: string;
  end_date: string;
  steps: number;
  points: number;
  removable?: boolean;
};
export type StepStanding = {
  user_id: string;
  display_name: string;
  initials: string;
  avatar_url?: string | null;
  color: CrewColor;
  steps: number;
  position: number;
  is_me: boolean;
};
export type StepsPage = {
  mode: StepsMode;
  summit: number;
  camp_step: number;
  steps_per_point: number;
  daily_cap: number;
  today: string;
  earliest: string;
  taken_days: string[];
  standings: StepStanding[];
  last_days: { day: string; steps: number }[];
  my_week: number;
  my_total: number;
  my_best_day: number;
  entries: StepEntry[];
};

const stepsKey = ['steps'] as const;

export function useSteps(mode: StepsMode) {
  return useQuery({
    queryKey: [...stepsKey, mode],
    queryFn: ({ signal }) => apiRequest<StepsPage>(`/steps?mode=${mode}`, { signal }),
  });
}

function refresh(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: stepsKey });
  void queryClient.invalidateQueries({ queryKey: ['climb'] });
  void queryClient.invalidateQueries({ queryKey: ['me', 'stats'] });
}

export function useLogSteps() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { start_date: string; end_date: string; steps: number }) =>
      apiRequest<StepEntry>('/steps', { method: 'POST', body }),
    onSuccess: () => refresh(queryClient),
  });
}

export function useRemoveSteps() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest<null>(`/steps/${id}`, { method: 'DELETE' }),
    onSuccess: () => refresh(queryClient),
  });
}
