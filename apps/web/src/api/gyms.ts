import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiRequest } from './client';

export type GymLocation = { lat: number; lon: number; address?: string | null };
export type Gym = { id: string; name: string; is_default: boolean; location?: GymLocation | null };
export type Place = { name: string; address: string | null; lat: number; lon: number };

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
  return useGymMutation((body: { name: string; location?: GymLocation | null }) =>
    apiRequest<Gym>('/me/gyms', { method: 'POST', body }),
  );
}

export function useUpdateGym() {
  return useGymMutation(
    ({ id, ...body }: { id: string; name?: string; location?: GymLocation | null }) =>
      apiRequest<Gym>(`/me/gyms/${id}`, { method: 'PATCH', body }),
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

/** Places matching what someone typed, or the place in a link they pasted. */
export function useFindPlaces() {
  return useMutation({
    mutationFn: async (query: string): Promise<Place[]> => {
      if (/^https?:\/\//i.test(query.trim())) {
        const place = await apiRequest<Place>('/places/from-link', {
          method: 'POST',
          body: { url: query.trim() },
        });
        return [place];
      }
      return apiRequest<Place[]>(`/places?q=${encodeURIComponent(query.trim())}`);
    },
  });
}
