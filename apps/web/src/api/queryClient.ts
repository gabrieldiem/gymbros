import { QueryClient } from '@tanstack/react-query';

const A_WEEK_MS = 7 * 24 * 3_600_000;

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10_000,
        refetchOnWindowFocus: true,
        retry: 1,
        // Try anyway: navigator.onLine says yes on one bar of signal, and no when it's wrong.
        networkMode: 'offlineFirst',
        // What's kept on the phone has to stay in memory as long (see persistence.ts).
        gcTime: A_WEEK_MS,
      },
      mutations: { networkMode: 'always' },
    },
  });
}
