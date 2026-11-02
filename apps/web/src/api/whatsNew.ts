import { useQuery } from '@tanstack/react-query';

import { apiRequest } from './client';

export type WhatsNewEntry = { id: string; date: string; link: string };

export function useWhatsNew() {
  return useQuery({
    queryKey: ['whats-new'],
    queryFn: ({ signal }) => apiRequest<WhatsNewEntry[]>('/whats-new', { signal }),
  });
}
