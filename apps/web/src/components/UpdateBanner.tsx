import { RefreshCw } from 'lucide-react';
import { useState, useSyncExternalStore } from 'react';

import { useActiveWorkout } from '../api/train';
import { useI18n } from '../i18n/context';
import { applyUpdate, isUpdateReady, subscribeToUpdate } from '../pwa/appUpdate';
import { Button } from './Button';
import styles from './InstallBanner.module.css';

/**
 * Says a new version is ready. It waits while a workout is in progress, and "Later" hides it until
 * the app is next opened or reloaded, which is when the new version starts anyway.
 */
export function UpdateBanner() {
  const { t } = useI18n();
  const ready = useSyncExternalStore(subscribeToUpdate, isUpdateReady);
  const workout = useActiveWorkout().data;
  const [later, setLater] = useState(false);
  if (!ready || later || workout) return null;
  return (
    <aside className={styles.banner} aria-label={t('update_title')}>
      <span className={styles.text}>
        <b>{t('update_title')}</b>
        <span>{t('update_body')}</span>
      </span>
      <Button icon={RefreshCw} onClick={applyUpdate}>
        {t('update_cta')}
      </Button>
      <Button variant="quiet" onClick={() => setLater(true)}>
        {t('update_later')}
      </Button>
    </aside>
  );
}
