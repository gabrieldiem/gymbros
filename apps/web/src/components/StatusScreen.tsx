import { useI18n } from '../i18n/context';
import { Button } from './Button';
import { Logo } from './Logo';
import styles from './StatusScreen.module.css';

/** Full-screen loading state while the session is resolved. */
export function LoadingScreen() {
  const { t } = useI18n();
  return (
    <div className={styles.screen} role="status" aria-live="polite">
      <span className={styles.pulse}>
        <Logo size={48} />
      </span>
      <span className="sr-only">{t('loading')}</span>
    </div>
  );
}

/** Full-screen error with a retry. */
export function LoadErrorScreen({ onRetry }: { onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <div className={styles.screen} role="alert">
      <Logo size={48} />
      <p>{t('load_failed')}</p>
      <Button variant="ghost" onClick={onRetry}>
        {t('retry')}
      </Button>
    </div>
  );
}
