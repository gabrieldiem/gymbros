import { useState, type FormEvent } from 'react';

import { useJoinCrew, useLogout } from '../../api/auth';
import { Button } from '../../components/Button';
import { FormError } from '../../components/FormError';
import { TextField } from '../../components/TextField';
import { useI18n } from '../../i18n/context';
import styles from './AuthPage.module.css';

export function JoinPage() {
  const { t } = useI18n();
  const join = useJoinCrew();
  const logout = useLogout();
  const [code, setCode] = useState('');

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
        <Button variant="quiet" onClick={() => logout.mutate()}>
          {t('log_out')}
        </Button>
      </p>
    </section>
  );
}
