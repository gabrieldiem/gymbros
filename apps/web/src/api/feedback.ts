import { useMutation } from '@tanstack/react-query';

import { apiRequest } from './client';

export type FeedbackKind = 'idea' | 'bug' | 'other';

export function useSendFeedback() {
  return useMutation({
    mutationFn: (body: { kind: FeedbackKind; body: string }) =>
      apiRequest<null>('/feedback', { method: 'POST', body }),
  });
}
