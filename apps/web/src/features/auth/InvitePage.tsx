import { LogIn } from 'lucide-react';
import { useEffect } from 'react';
import { Link, Navigate, useParams } from 'react-router';

import { useAuthOptions, useInvite } from '../../api/auth';
import { errorCode } from '../../api/errors';
import { useMe } from '../../api/me';
import { ButtonLink } from '../../components/Button';
import { GoogleButton } from '../../components/GoogleButton';
import { LegalLinks } from '../../components/LegalLinks';
import { Logo } from '../../components/Logo';
import { LoadingScreen } from '../../components/StatusScreen';
import { useI18n } from '../../i18n/context';
import styles from './AuthPage.module.css';
import { forgetInvite, normalizeCode, rememberInvite } from './pendingInvite';

/** Where an invite link lands. The code is kept through sign-in, and joining happens on return. */
export function InvitePage() {
  const { t } = useI18n();
  const { code = '' } = useParams();
  const me = useMe();
  const invite = useInvite(code);
  const options = useAuthOptions().data;

  const myCrew = me.data?.crew;
  const dead = !me.data && invite.isError;

  useEffect(() => {
    if (me.isPending) return;
    if (myCrew || dead) forgetInvite();
    else rememberInvite(code);
  }, [code, me.isPending, myCrew, dead]);

  if (me.isPending) return <LoadingScreen />;
  if (myCrew) {
    if (myCrew.invite_code === normalizeCode(code)) return <Navigate to="/climb" replace />;
    return (
      <section className={styles.page} aria-labelledby="page-title">
        <h1 id="page-title">{t('invite_other_crew', { crew: myCrew.name })}</h1>
        <p className={styles.sub}>{t('invite_other_crew_sub')}</p>
        <ButtonLink to="/climb" wide>
          {t('invite_back_to_crew', { crew: myCrew.name })}
        </ButtonLink>
      </section>
    );
  }
  if (me.data) return <Navigate to="/join" replace />;

  if (invite.isError) {
    const reason = errorCode(invite.error);
    return (
      <section className={styles.page} aria-labelledby="page-title">
        <h1 id="page-title">
          {t(
            reason === 'invite_code_expired'
              ? 'invite_expired'
              : reason === 'invite_code_used_up'
                ? 'invite_used_up'
                : 'invite_invalid',
          )}
        </h1>
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
        <ButtonLink icon={LogIn} to="/login" wide>
          {t('log_in')}
        </ButtonLink>
      ) : (
        <GoogleButton />
      )}
      <LegalLinks />
    </section>
  );
}
