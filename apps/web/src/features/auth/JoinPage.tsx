import { LogOut } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';

import { Link } from 'react-router';

import { useJoinCrew, useLogout } from '../../api/auth';
import { useMe } from '../../api/me';
import { Button } from '../../components/Button';
import { FormError } from '../../components/FormError';
import { TextField } from '../../components/TextField';
import { useI18n } from '../../i18n/context';
import styles from './AuthPage.module.css';
import { forgetInvite, pendingInvite } from './pendingInvite';

export function JoinPage() {
  const { t } = useI18n();
  const join = useJoinCrew();
  const logout = useLogout();
  const isAdmin = useMe().data?.is_admin;
  // Filled in when an invite link brought them here.
  const [code, setCode] = useState(pendingInvite);

  // Following an invite link is the decision to join: do it right away. If the code can't be used,
  // show why and forget it, so the next visit doesn't try again.
  const autoJoined = useRef(false);
  useEffect(() => {
    const invited = pendingInvite();
    if (!invited || autoJoined.current) return;
    autoJoined.current = true;
    join.mutate(invited, { onError: forgetInvite });
  }, [join]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    join.mutate(code.trim());
  }

  return (
    <section className={styles.page} aria-labelledby="page-title">
      <h1 id="page-title">{t('join_title')}</h1>
      <p className={styles.sub}>{t('join_sub')}</p>
      <form className={styles.form} onSubmit={handleSubmit}>
        <TextField
          label={t('field_invite')}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          required
          minLength={4}
          maxLength={20}
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <FormError error={join.error} />
        <Button type="submit" wide disabled={join.isPending}>
          {join.isPending ? t('joining') : t('join_cta')}
        </Button>
      </form>
      <p className={styles.switch}>
        {isAdmin && <Link to="/admin">{t('admin_title')}</Link>}{' '}
        <Button icon={LogOut} variant="quiet" onClick={() => logout.mutate()}>
          {t('log_out')}
        </Button>
      </p>
    </section>
  );
}
