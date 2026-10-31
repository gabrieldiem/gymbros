import { useSyncExternalStore } from 'react';

import { useHealth } from '../api/health';
import { useI18n } from '../i18n/context';
import type { MessageKey } from '../i18n/en';
import { cx } from './cx';
import styles from './HealthStatus.module.css';

type State = 'checking' | 'up' | 'down' | 'offline';

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

/** Whether the device has a network connection at all. */
function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}

const LABELS: Record<State, MessageKey> = {
  checking: 'api_checking',
  up: 'api_up',
  down: 'api_down',
  offline: 'offline',
};

/** Server reachability, from `/api/health`. */
export function HealthStatus() {
  const { t } = useI18n();
  const health = useHealth();
  const online = useOnline();
  const state: State = !online
    ? 'offline'
    : health.isPending
      ? 'checking'
      : health.data?.database === 'up'
        ? 'up'
        : 'down';
  return (
    <p className={cx(styles.status, styles[state])} role="status" data-state={state}>
      <span className={styles.dot} aria-hidden="true" />
      {t(LABELS[state])}
    </p>
  );
}
