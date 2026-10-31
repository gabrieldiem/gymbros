import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ApiError, apiRequest } from './client';
import type { Me, UpdateMeBody } from './types';

export const meKey = ['me'] as const;

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
