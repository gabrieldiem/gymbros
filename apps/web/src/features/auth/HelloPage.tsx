import { useNavigate } from 'react-router';

import { useMe } from '../../api/me';
import { Button } from '../../components/Button';
import { Logo } from '../../components/Logo';
import { useI18n } from '../../i18n/context';
import styles from './AuthPage.module.css';
import { clearCrewWelcome } from './crewWelcome';
import { WelcomeSteps } from './WelcomeSteps';

/** "This is {crew}": shown once after joining a crew. */
export function HelloPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const crewName = useMe().data?.crew?.name ?? '';

  function handleStart() {
    clearCrewWelcome();
    navigate('/climb', { replace: true });
  }

  return (
    <section className={styles.page} aria-labelledby="page-title">
      <span className={styles.mark}>
        <Logo size={64} />
      </span>
      <h1 id="page-title">{t('w_title', { crew: crewName })}</h1>
      <p className={styles.sub}>{t('w_body')}</p>
      <WelcomeSteps />
      <div className={styles.actions}>
        <Button wide onClick={handleStart}>
          {t('w_cta')}
        </Button>
      </div>
    </section>
  );
}
