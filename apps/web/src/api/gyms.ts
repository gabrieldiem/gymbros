import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiRequest } from './client';

export type Gym = { id: string; name: string; is_default: boolean };

export const gymsKey = ['me', 'gyms'] as const;

export function useGyms() {
  return useQuery({
    queryKey: gymsKey,
    queryFn: ({ signal }) => apiRequest<Gym[]>('/me/gyms', { signal }),
  });
}

function useGymMutation<T>(mutationFn: (value: T) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: gymsKey }),
  });
}

export function useAddGym() {
  return useGymMutation((name: string) =>
    apiRequest<Gym>('/me/gyms', { method: 'POST', body: { name } }),
  );
}

export function useMakeGymDefault() {
  return useGymMutation((id: string) =>
    apiRequest<Gym>(`/me/gyms/${id}`, { method: 'PATCH', body: { is_default: true } }),
  );
}

export function useDeleteGym() {
  return useGymMutation((id: string) => apiRequest<null>(`/me/gyms/${id}`, { method: 'DELETE' }));
}
