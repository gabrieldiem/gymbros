import { Navigate } from 'react-router';

import { useAuthOptions } from '../../api/auth';
import { useMe } from '../../api/me';
import { Brand } from '../../components/Brand';
import { ButtonLink } from '../../components/Button';
import { GoogleButton } from '../../components/GoogleButton';
import { LanguageToggle } from '../../components/LanguageToggle';
import { LegalLinks } from '../../components/LegalLinks';
import { useI18n } from '../../i18n/context';
import { gateRedirect } from '../auth/gate';
import { WelcomeSteps } from '../auth/WelcomeSteps';
import { RopeOrder } from '../climb/RopeOrder';
import { TrailMap } from '../climb/TrailMap';
import styles from './LandingPage.module.css';
import { SAMPLE_CAMP_STEP, SAMPLE_CREW, SAMPLE_SUMMIT, SAMPLE_WEEKLY_TARGET } from './sampleCrew';

const REPOSITORY_URL = 'https://github.com/gabrieldiem/gymbros';

/**
 * The public home page: the ATUS Climb dashboard with a made-up crew. Everything on it is static,
 * so it never waits for the API, even a down one. A session, once known, moves members to the app.
 */
export function LandingPage() {
  const { t } = useI18n();
  const me = useMe();
  const options = useAuthOptions().data;
  const redirect = gateRedirect('guest', me.data ?? null, false);
  if (redirect) return <Navigate to={redirect} replace />;

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <Brand />
        <div className={styles.topActions}>
          <LanguageToggle />
          <ButtonLink to="/login" variant="ghost" className={styles.logIn}>
            {t('log_in')}
          </ButtonLink>
        </div>
      </header>
      <main className={styles.main}>
        <section className={styles.intro} aria-labelledby="page-title">
          <h1 id="page-title">{t('welcome_title')}</h1>
          <p>{t('w_body')}</p>
          {options?.google === false ? (
            <ButtonLink to="/login" wide>
              {t('log_in')}
            </ButtonLink>
          ) : (
            <GoogleButton />
          )}
        </section>
        <section className={styles.map} aria-label={t('landing_sample')}>
          <TrailMap standings={SAMPLE_CREW} summit={SAMPLE_SUMMIT} campStep={SAMPLE_CAMP_STEP} />
          <p className={styles.sample}>{t('landing_sample')}</p>
        </section>
        <div className={styles.rope}>
          <RopeOrder standings={SAMPLE_CREW} target={SAMPLE_WEEKLY_TARGET} />
        </div>
        <section className={styles.how} aria-labelledby="how-title">
          <h2 id="how-title">{t('landing_how')}</h2>
          <WelcomeSteps />
        </section>
      </main>
      <footer className={styles.footer}>
        <LegalLinks />
        <a href={REPOSITORY_URL} target="_blank" rel="noreferrer" className={styles.repo}>
          <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
          </svg>
          {t('landing_source')}
        </a>
      </footer>
    </div>
  );
}
