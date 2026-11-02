import { useSyncExternalStore } from 'react';

import { Button } from '../../components/Button';
import { useI18n } from '../../i18n/context';
import { removeFromOutbox } from './offlineStore';
import styles from './OfflineBanner.module.css';
import { useOutbox, useOutboxSync } from './useOutboxSync';

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

/** What's going on with no signal, only while it matters. Also what sends the waiting workouts. */
export function OfflineBanner() {
  const { t } = useI18n();
  useOutboxSync();
  const online = useSyncExternalStore(subscribe, () => navigator.onLine);
  const outbox = useOutbox();
  const waiting = outbox.filter((w) => !w.failed).length;
  const failed = outbox.filter((w) => w.failed);
  if (online && !waiting && !failed.length) return null;
  return (
    <aside className={styles.banner} aria-label={t('offline_title')}>
      {!online && <p>{t('offline_logging')}</p>}
      {waiting > 0 && (
        <p>{waiting === 1 ? t('offline_waiting_1') : t('offline_waiting_n', { n: waiting })}</p>
      )}
      {failed.map((workout) => (
        <div key={workout.id} className={styles.failed}>
          <p>{t('offline_failed', { name: workout.name })}</p>
          <Button variant="quiet" onClick={() => removeFromOutbox(workout.id)}>
            {t('offline_discard')}
          </Button>
        </div>
      ))}
    </aside>
  );
}
