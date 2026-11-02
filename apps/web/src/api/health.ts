import { useQuery } from '@tanstack/react-query';

import { apiRequest } from './client';
import { liveInterval } from './liveInterval';

export type Health = { status: 'running' | 'degraded'; database: 'up' | 'down' };

export const healthKey = ['health'] as const;

export function fetchHealth(signal?: AbortSignal): Promise<Health> {
  return apiRequest<Health>('/health', { signal });
}

/** Polls `/api/health` every 20 s while the tab is visible. */
export function useHealth() {
  return useQuery({
    queryKey: healthKey,
    queryFn: ({ signal }) => fetchHealth(signal),
    refetchInterval: liveInterval,
    retry: false,
  });
}
