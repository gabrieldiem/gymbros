import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';

import { useAuthOptions, useDevLogin } from '../../api/auth';
import { Button } from '../../components/Button';
import { FormError } from '../../components/FormError';
import { GoogleButton } from '../../components/GoogleButton';
import { LegalLinks } from '../../components/LegalLinks';
import { TextField } from '../../components/TextField';
import { useI18n } from '../../i18n/context';
import styles from './AuthPage.module.css';

/** Email-only sign-in for demo and e2e accounts. The server only offers it outside production. */
function DevLoginForm() {
  const { t, lang } = useI18n();
  const login = useDevLogin();
  const [email, setEmail] = useState('');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    login.mutate({ email: email.trim(), language: lang });
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <TextField
        label={t('field_email')}
        hint={t('dev_login_hint')}
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <FormError error={login.error} />
      <Button type="submit" variant="ghost" wide disabled={login.isPending}>
        {login.isPending ? t('logging_in') : t('log_in')}
      </Button>
    </form>
  );
}

export function LoginPage() {
  const { t } = useI18n();
  const options = useAuthOptions().data;
  const [params] = useSearchParams();

  return (
    <section className={styles.page} aria-labelledby="page-title">
      <h1 id="page-title">{t('login_title')}</h1>
      <p className={styles.sub}>{t('login_sub')}</p>
      {params.get('auth_error') && (
        <p className={styles.error} role="alert">
          {t('err_google_failed')}
        </p>
      )}
      {options?.google !== false && <GoogleButton />}
      {options?.dev_login && <DevLoginForm />}
      <LegalLinks />
    </section>
  );
}
