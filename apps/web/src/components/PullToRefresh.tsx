import { useQueryClient } from '@tanstack/react-query';
import { RotateCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { useI18n } from '../i18n/context';
import { canStartPull, PULL_TRIGGER, pullOffset } from './pull';
import styles from './PullToRefresh.module.css';

/**
 * Pull down at the top of a page on a phone to fetch everything on screen again. The browser's own
 * pull-to-refresh is off (base.css), and an installed app has none, so this stands in for it.
 * It refetches queries rather than reloading, so a workout's draft and offline state stay put.
 */
export function PullToRefresh() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [offset, setOffset] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const start = useRef<number | null>(null);
  const reached = useRef(0);

  useEffect(() => {
    if (refreshing) return;
    const handleStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      start.current =
        event.touches.length === 1 && touch && canStartPull(event.target, window.scrollY)
          ? touch.clientY
          : null;
    };
    const handleMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (start.current === null || !touch) return;
      reached.current = pullOffset(touch.clientY - start.current);
      setOffset(reached.current);
    };
    const handleEnd = () => {
      if (start.current === null) return;
      start.current = null;
      setOffset(0);
      if (reached.current < PULL_TRIGGER) return;
      reached.current = 0;
      setRefreshing(true);
      void queryClient
        .refetchQueries({ type: 'active' })
        .catch(() => undefined) // Offline: whatever is on screen stays, and the banner says why.
        .finally(() => setRefreshing(false));
    };
    document.addEventListener('touchstart', handleStart, { passive: true });
    document.addEventListener('touchmove', handleMove, { passive: true });
    document.addEventListener('touchend', handleEnd);
    document.addEventListener('touchcancel', handleEnd);
    return () => {
      document.removeEventListener('touchstart', handleStart);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
      document.removeEventListener('touchcancel', handleEnd);
    };
  }, [queryClient, refreshing]);

  const shown = refreshing ? PULL_TRIGGER : offset;
  const ready = offset >= PULL_TRIGGER;
  return (
    <>
      <div
        className={styles.pull}
        data-state={refreshing ? 'refreshing' : ready ? 'ready' : 'pulling'}
        style={{ transform: `translate(-50%, ${shown - 48}px)`, opacity: shown ? 1 : 0 }}
        aria-hidden="true"
      >
        <RotateCw size={20} style={refreshing ? undefined : { rotate: `${offset * 4}deg` }} />
      </div>
      <p className="sr-only" role="status">
        {refreshing ? t('refreshing') : ''}
      </p>
    </>
  );
}
