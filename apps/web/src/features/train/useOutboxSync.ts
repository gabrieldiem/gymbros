import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useSyncExternalStore } from 'react';

import { ApiError, isConnectionError } from '../../api/client';
import { refreshAfterWorkout, syncWorkout } from '../../api/train';
import { useToast } from '../../components/toast';
import { useI18n } from '../../i18n/context';
import { getOutbox, markFailed, removeFromOutbox, subscribeToOutbox } from './offlineStore';

const CHECK_EVERY_MS = 30_000;

export const useOutbox = () => useSyncExternalStore(subscribeToOutbox, getOutbox);

const alreadyArrived = (error: unknown) =>
  error instanceof ApiError &&
  error.status === 409 &&
  (error.body as { detail?: { code?: string } } | null)?.detail?.code === 'workout_finished';

/**
 * Sends finished workouts waiting on this phone, one at a time, whenever there may be signal. If
 * an answer got lost, sending one again is safe: the server says it already has it.
 */
export function useOutboxSync() {
  const { t, n } = useI18n();
  const queryClient = useQueryClient();
  const showToast = useToast();
  const sending = useRef(false);
  const outbox = useOutbox();

  useEffect(() => {
    const send = async () => {
      if (sending.current) return;
      sending.current = true;
      try {
        for (const workout of getOutbox().filter((w) => !w.failed)) {
          try {
            const result = await syncWorkout(workout);
            removeFromOutbox(workout.id);
            refreshAfterWorkout(queryClient);
            showToast(t('offline_synced', { name: workout.name, n: n(result.total) }));
          } catch (error) {
            if (alreadyArrived(error)) removeFromOutbox(workout.id);
            else if (isConnectionError(error) || (error as ApiError).status === 401) return;
            else markFailed(workout.id);
          }
        }
      } finally {
        sending.current = false;
      }
    };
    void send();
    window.addEventListener('online', send);
    const id = setInterval(() => void send(), CHECK_EVERY_MS);
    return () => {
      window.removeEventListener('online', send);
      clearInterval(id);
    };
    // Starts again when something new is queued, so it goes out straight away if it can.
  }, [outbox.length, n, queryClient, showToast, t]);
}
