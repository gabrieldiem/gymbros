import { useMutation, useQueryClient } from '@tanstack/react-query';

import { markCrewWelcomePending } from '../features/auth/crewWelcome';
import { apiRequest } from './client';
import { meKey } from './me';
import type { LoginBody, Me, RegisterBody } from './types';

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

export function useLogin() {
  return useMeMutation((body: LoginBody) =>
    apiRequest<Me>('/auth/login', { method: 'POST', body }),
  );
}

export function useRegister() {
  return useMeMutation(
    (body: RegisterBody) => apiRequest<Me>('/auth/register', { method: 'POST', body }),
    true,
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
