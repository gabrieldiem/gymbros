import { useEffect } from 'react';
import { Link, Navigate, useParams } from 'react-router';

import { useAuthOptions, useInvite } from '../../api/auth';
import { useMe } from '../../api/me';
import { ButtonLink } from '../../components/Button';
import { GoogleButton } from '../../components/GoogleButton';
import { LegalLinks } from '../../components/LegalLinks';
import { Logo } from '../../components/Logo';
import { LoadingScreen } from '../../components/StatusScreen';
import { useI18n } from '../../i18n/context';
import styles from './AuthPage.module.css';
import { rememberInvite } from './pendingInvite';

/** Where an invite link lands. The code is kept, so the join screen is filled in after signing in. */
export function InvitePage() {
  const { t } = useI18n();
  const { code = '' } = useParams();
  const me = useMe();
  const invite = useInvite(code);
  const options = useAuthOptions().data;

  useEffect(() => {
    rememberInvite(code);
  }, [code]);

  if (me.isPending) return <LoadingScreen />;
  if (me.data) return <Navigate to={me.data.crew ? '/climb' : '/join'} replace />;

  if (invite.isError) {
    return (
      <section className={styles.page} aria-labelledby="page-title">
        <h1 id="page-title">{t('invite_invalid')}</h1>
        <p className={styles.sub}>{t('invite_invalid_sub')}</p>
        <Link to="/">{t('invite_home')}</Link>
      </section>
    );
  }

  return (
    <section className={styles.page} aria-labelledby="page-title">
      <span className={styles.mark}>
        <Logo size={64} />
      </span>
      <h1 id="page-title">
        {invite.data ? t('invite_title', { crew: invite.data.crew_name }) : t('invite_title_plain')}
      </h1>
      <p className={styles.sub}>
        {invite.data ? t('invite_sub', { n: invite.data.members }) : t('w_body')}
      </p>
      {options?.google === false ? (
        <ButtonLink to="/login" wide>
          {t('log_in')}
        </ButtonLink>
      ) : (
        <GoogleButton />
      )}
      <LegalLinks />
    </section>
  );
}
