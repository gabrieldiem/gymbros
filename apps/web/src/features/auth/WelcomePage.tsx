import { ButtonLink } from '../../components/Button';
import { Logo } from '../../components/Logo';
import { useI18n } from '../../i18n/context';
import styles from './AuthPage.module.css';
import { WelcomeSteps } from './WelcomeSteps';

export function WelcomePage() {
  const { t } = useI18n();
  return (
    <section className={styles.page} aria-labelledby="page-title">
      <span className={styles.mark}>
        <Logo size={64} />
      </span>
      <h1 id="page-title">{t('welcome_title')}</h1>
      <p className={styles.sub}>{t('w_body')}</p>
      <WelcomeSteps />
      <div className={styles.actions}>
        <ButtonLink to="/register" wide>
          {t('create_account')}
        </ButtonLink>
        <ButtonLink to="/login" variant="ghost" wide>
          {t('have_account')}
        </ButtonLink>
      </div>
    </section>
  );
}
