import { useI18n } from '../i18n/context';
import { Button } from './Button';
import styles from './InstallBanner.module.css';
import { useInstallPrompt } from './useInstallPrompt';

/** Offers "Add to home screen" when the browser allows it. Dismissed for good with "Not now". */
export function InstallBanner() {
  const { t } = useI18n();
  const prompt = useInstallPrompt();
  if (!prompt.available) return null;
  return (
    <aside className={styles.banner} aria-label={t('install_title')}>
      <span className={styles.text}>
        <b>{t('install_title')}</b>
        <span>{t('install_body')}</span>
      </span>
      <Button onClick={() => void prompt.install()}>{t('install_cta')}</Button>
      <Button variant="quiet" onClick={prompt.dismiss}>
        {t('install_later')}
      </Button>
    </aside>
  );
}
