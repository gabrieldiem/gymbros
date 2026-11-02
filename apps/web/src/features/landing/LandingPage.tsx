import { LogIn } from 'lucide-react';
import { Navigate } from 'react-router';

import { useAuthOptions } from '../../api/auth';
import { useMe } from '../../api/me';
import { useRules } from '../../api/rules';
import { Brand } from '../../components/Brand';
import { ButtonLink } from '../../components/Button';
import { GoogleButton } from '../../components/GoogleButton';
import { LanguageToggle } from '../../components/LanguageToggle';
import { Logo } from '../../components/Logo';
import { useI18n } from '../../i18n/context';
import { gateRedirect } from '../auth/gate';
import { pendingInvite } from '../auth/pendingInvite';
import { ClimbDemo } from './ClimbDemo';
import styles from './LandingPage.module.css';
import { AchievementList, PointsList, SportsCompare } from './LandingSections';

const REPOSITORY_URL = 'https://github.com/gabrieldiem/gymbros';

function SignIn({ google }: { google: boolean | undefined }) {
  const { t } = useI18n();
  return google === false ? (
    <ButtonLink icon={LogIn} to="/login" wide>
      {t('log_in')}
    </ButtonLink>
  ) : (
    <GoogleButton />
  );
}

function LandingFooter() {
  const { t } = useI18n();
  return (
    <footer className={styles.footer}>
      <svg
        className={styles.ridge}
        viewBox="0 0 1200 120"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d="M0 120 180 44l110 46 170-78 150 72 120-42 170 60 130-52 170 70v0H0z" />
      </svg>
      <div className={styles.footerInner}>
        <div className={styles.footerBrand}>
          <Logo size={40} />
          <p>{t('tagline')}</p>
        </div>
        <nav aria-label={t('landing_footer_game')}>
          <h2>{t('landing_footer_game')}</h2>
          <a href="#sports">{t('landing_footer_sports')}</a>
          <a href="#points">{t('landing_footer_points')}</a>
          <a href="#achievements">{t('landing_footer_achievements')}</a>
        </nav>
        <nav aria-label={t('landing_footer_about')}>
          <h2>{t('landing_footer_about')}</h2>
          <a href={REPOSITORY_URL} target="_blank" rel="noreferrer" className={styles.repo}>
            <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
            </svg>
            {t('landing_source')}
          </a>
          <a href="/terms">{t('legal_terms')}</a>
          <a href="/privacy">{t('legal_privacy')}</a>
        </nav>
      </div>
      <p className={styles.legalNote}>{t('landing_legal_note')}</p>
    </footer>
  );
}

/**
 * The public home page. The hero and demo are static, so they never wait for the API, even a down
 * one; the lists appear once the rules arrive. A session, once known, moves members to the app.
 */
export function LandingPage() {
  const { t } = useI18n();
  const me = useMe();
  const options = useAuthOptions().data;
  const rules = useRules().data;
  const redirect = gateRedirect('guest', me.data ?? null, false, Boolean(pendingInvite()));
  if (redirect) return <Navigate to={redirect} replace />;
  const liftSession = rules?.sessions.find((s) => s.id === 'lift');

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <Brand />
        <nav className={styles.topLinks} aria-label={t('landing_footer_game')}>
          <a href="#sports">{t('landing_footer_sports')}</a>
          <a href="#points">{t('landing_footer_points')}</a>
          <a href="#achievements">{t('landing_footer_achievements')}</a>
        </nav>
        <div className={styles.topActions}>
          <LanguageToggle />
          <ButtonLink icon={LogIn} to="/login" variant="ghost" className={styles.logIn}>
            {t('log_in')}
          </ButtonLink>
        </div>
      </header>
      <main>
        <div className={styles.wrap}>
          <div className={styles.hero}>
            <section className={styles.intro} aria-labelledby="page-title">
              <h1 id="page-title">{t('welcome_title')}</h1>
              <p>{t('landing_intro')}</p>
              <div className={styles.introAction}>
                <SignIn google={options?.google} />
              </div>
            </section>
            <ClimbDemo
              session={liftSession}
              map={(trail) => (
                <section className={styles.map} aria-label={t('landing_sample')}>
                  {trail}
                  <p className={styles.sample}>{t('landing_sample')}</p>
                </section>
              )}
            />
          </div>
          {rules && <SportsCompare sessions={rules.sessions} />}
          {rules && <PointsList rules={rules} />}
          {rules && <AchievementList rules={rules} />}
        </div>
        <section className={styles.cta} aria-labelledby="cta-title">
          <div className={styles.ctaInner}>
            <h2 id="cta-title">{t('landing_cta_title')}</h2>
            <p>{t('landing_cta_sub')}</p>
            <div className={styles.ctaAction}>
              <SignIn google={options?.google} />
            </div>
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
