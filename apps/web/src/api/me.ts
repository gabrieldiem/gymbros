import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { clearOfflineData } from '../features/train/offlineStore';
import { ApiError, apiRequest } from './client';
import type { Me, UpdateMeBody } from './types';

export const meKey = ['me'] as const;

/** Signing out or deleting the account: nothing of this account stays, in memory or on the phone. */
export function removeEverythingButMe(queryClient: QueryClient) {
  queryClient.removeQueries({
    predicate: (query) => query.queryKey.length > 1 || query.queryKey[0] !== meKey[0],
  });
}

/** The signed-in user, or null when there is no session. Other errors throw. */
export async function fetchMe(signal?: AbortSignal): Promise<Me | null> {
  try {
    return await apiRequest<Me>('/me', { signal });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export function useMe() {
  return useQuery({ queryKey: meKey, queryFn: ({ signal }) => fetchMe(signal), staleTime: 60_000 });
}

/** Delete your account. The body repeats your email to confirm. */
export function useDeleteMyAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (confirmEmail: string) =>
      apiRequest<null>('/me/delete', { method: 'POST', body: { confirm_email: confirmEmail } }),
    onSuccess: () => {
      clearOfflineData();
      removeEverythingButMe(queryClient);
      queryClient.setQueryData(meKey, null);
    },
  });
}

/** PATCH /api/me. The cache is updated optimistically (profile fields only, never points). */
export function useUpdateMe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateMeBody) => apiRequest<Me>('/me', { method: 'PATCH', body }),
    onMutate: async (body) => {
      await queryClient.cancelQueries({ queryKey: meKey });
      const previous = queryClient.getQueryData<Me | null>(meKey);
      if (previous) queryClient.setQueryData<Me>(meKey, { ...previous, ...body });
      return { previous };
    },
    onError: (_error, _body, context) => queryClient.setQueryData(meKey, context?.previous),
    onSuccess: (me) => queryClient.setQueryData(meKey, me),
  });
}

/** Replace your profile picture. Everywhere that shows you refetches with its new URL. */
export function useUploadAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: Blob) => apiRequest<Me>('/me/avatar', { method: 'PUT', file }),
    onSuccess: (me) => {
      queryClient.setQueryData(meKey, me);
      void queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] !== meKey[0] });
    },
  });
}

export function useRemoveAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiRequest<Me>('/me/avatar', { method: 'DELETE' }),
    onSuccess: (me) => {
      queryClient.setQueryData(meKey, me);
      void queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] !== meKey[0] });
    },
  });
}
