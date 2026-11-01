import { useAuthOptions } from '../../api/auth';
import { ButtonLink } from '../../components/Button';
import { GoogleButton } from '../../components/GoogleButton';
import { LegalLinks } from '../../components/LegalLinks';
import { Logo } from '../../components/Logo';
import { useI18n } from '../../i18n/context';
import styles from './AuthPage.module.css';
import { WelcomeSteps } from './WelcomeSteps';

export function WelcomePage() {
  const { t } = useI18n();
  const options = useAuthOptions().data;
  return (
    <section className={styles.page} aria-labelledby="page-title">
      <span className={styles.mark}>
        <Logo size={64} />
      </span>
      <h1 id="page-title">{t('welcome_title')}</h1>
      <p className={styles.sub}>{t('w_body')}</p>
      <WelcomeSteps />
      <div className={styles.actions}>
        {options?.google !== false && <GoogleButton />}
        {options?.dev_login && (
          <ButtonLink to="/login" variant="ghost" wide>
            {t('dev_login')}
          </ButtonLink>
        )}
      </div>
      <LegalLinks />
    </section>
  );
}
