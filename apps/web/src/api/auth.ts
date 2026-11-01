import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { markCrewWelcomePending } from '../features/auth/crewWelcome';
import { apiRequest } from './client';
import { meKey } from './me';
import type { AuthOptions, DevLoginBody, Me } from './types';

/**
 * Every auth mutation answers with the new /api/me body; put it straight in the cache and let
 * the route gates redirect. `joinsCrew` marks the one-time crew welcome before the gates run.
 */
function useMeMutation<TBody>(request: (body: TBody) => Promise<Me>, joinsCrew = false) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: (me) => {
      if (joinsCrew && me.crew) markCrewWelcomePending();
      queryClient.setQueryData(meKey, me);
    },
  });
}

/** Which ways to sign in this server offers. They only change with a deploy. */
export function useAuthOptions() {
  return useQuery({
    queryKey: ['auth', 'options'],
    queryFn: ({ signal }) => apiRequest<AuthOptions>('/auth/options', { signal }),
    staleTime: Infinity,
  });
}

/** Full-page navigation: the API redirects to Google and back, so this is not a fetch. */
export function googleSignInUrl(language: string): string {
  return `/api/auth/google/start?lang=${encodeURIComponent(language)}`;
}

export function useDevLogin() {
  return useMeMutation((body: DevLoginBody) =>
    apiRequest<Me>('/auth/dev-login', { method: 'POST', body }),
  );
}

export function useJoinCrew() {
  return useMeMutation(
    (inviteCode: string) =>
      apiRequest<Me>('/crews/join', { method: 'POST', body: { invite_code: inviteCode } }),
    true,
  );
}

/**
 * Log out and drop every user's cached data: the next user must not see this one's. `me` is set
 * to null rather than removed so the mounted route gates see the change and redirect.
 */
export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiRequest<null>('/auth/logout', { method: 'POST' }),
    onSettled: () => {
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== meKey[0] });
      queryClient.setQueryData(meKey, null);
    },
  });
}
