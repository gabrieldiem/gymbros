import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiRequest } from './client';
import type { CrewColor } from './types';

export type AdminOverview = {
  users: number;
  crews: number;
  users_without_crew: number;
  workouts: number;
  recent_workouts: number;
  recent_active_users: number;
  recent_points: number;
};

export type AdminCrew = {
  id: string;
  name: string;
  time_zone: string;
  invite_code: string;
  members: number;
  points: number;
};

export type AdminMember = {
  id: string;
  email: string;
  display_name: string;
  initials: string;
  color: CrewColor;
  crew_name: string | null;
  points: number;
  workouts: number;
  last_workout_at: string | null;
  created_at: string;
  is_admin: boolean;
};

export type AdminAction = {
  id: string;
  admin_email: string;
  action: string;
  target: string;
  details: Record<string, string | number>;
  created_at: string;
};

const adminKey = ['admin'] as const;

export function useAdminOverview() {
  return useQuery({
    queryKey: [...adminKey, 'overview'],
    queryFn: ({ signal }) => apiRequest<AdminOverview>('/admin/overview', { signal }),
  });
}

export function useAdminCrews() {
  return useQuery({
    queryKey: [...adminKey, 'crews'],
    queryFn: ({ signal }) => apiRequest<AdminCrew[]>('/admin/crews', { signal }),
  });
}

export function useAdminMembers(search: string) {
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  return useQuery({
    queryKey: [...adminKey, 'members', search],
    queryFn: ({ signal }) => apiRequest<AdminMember[]>(`/admin/members${query}`, { signal }),
  });
}

export function useAdminActions() {
  return useQuery({
    queryKey: [...adminKey, 'actions'],
    queryFn: ({ signal }) => apiRequest<AdminAction[]>('/admin/actions', { signal }),
  });
}

/** Any change can touch every list, and the audit log always grows: refetch them all. */
function useAdminMutation<TBody>(request: (body: TBody) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKey }),
  });
}

export function useCreateCrew() {
  return useAdminMutation((body: { name: string; time_zone: string }) =>
    apiRequest<AdminCrew>('/admin/crews', { method: 'POST', body }),
  );
}

export function useUpdateCrew() {
  return useAdminMutation(({ id, ...body }: { id: string; name: string; time_zone: string }) =>
    apiRequest<AdminCrew>(`/admin/crews/${id}`, { method: 'PATCH', body }),
  );
}

export function useRotateInviteCode() {
  return useAdminMutation((id: string) =>
    apiRequest<AdminCrew>(`/admin/crews/${id}/invite-code`, { method: 'POST' }),
  );
}

export function useAdjustPoints() {
  return useAdminMutation(({ id, ...body }: { id: string; points: number; reason: string }) =>
    apiRequest<null>(`/admin/members/${id}/points`, { method: 'POST', body }),
  );
}

export function useRemoveFromCrew() {
  return useAdminMutation((id: string) =>
    apiRequest<null>(`/admin/members/${id}/crew`, { method: 'DELETE' }),
  );
}

export function useDeleteAccount() {
  return useAdminMutation((id: string) =>
    apiRequest<null>(`/admin/members/${id}`, { method: 'DELETE' }),
  );
}
