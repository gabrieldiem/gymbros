import { useEffect, useSyncExternalStore } from 'react';

import { useMe } from '../api/me';
import { useActiveWorkout } from '../api/train';
import { applyUpdate, isUpdateReadyAtOpen, subscribeToUpdate } from './appUpdate';

const LAST_APPLIED = 'gymbros-update-applied';
const RETRY_AFTER_MS = 60_000;

/** A new version that keeps failing to take over must not turn into a reload loop. */
function appliedJustNow(): boolean {
  const last = Number(sessionStorage.getItem(LAST_APPLIED) ?? 0);
  return Date.now() - last < RETRY_AFTER_MS;
}

/**
 * Starts a new version found while the app opens, so an ordinary reload gets it. A workout in
 * progress waits: switching mid-set isn't worth it, and the banner offers it afterwards.
 */
export function ApplyUpdateOnOpen() {
  const ready = useSyncExternalStore(subscribeToUpdate, isUpdateReadyAtOpen);
  const me = useMe();
  const signedIn = Boolean(me.data);
  const workout = useActiveWorkout(signedIn);
  const settled = me.isFetched && (!signedIn || workout.isFetched);
  const training = Boolean(workout.data);

  useEffect(() => {
    if (!ready || !settled || training || appliedJustNow()) return;
    sessionStorage.setItem(LAST_APPLIED, String(Date.now()));
    applyUpdate();
  }, [ready, settled, training]);

  return null;
}
