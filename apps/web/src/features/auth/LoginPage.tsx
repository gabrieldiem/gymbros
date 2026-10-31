import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';

import { useLogin } from '../../api/auth';
import { Button } from '../../components/Button';
import { FormError } from '../../components/FormError';
import { TextField } from '../../components/TextField';
import { useI18n } from '../../i18n/context';
import styles from './AuthPage.module.css';

export function LoginPage() {
  const { t } = useI18n();
  const login = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    login.mutate({ email: email.trim(), password });
  }

  return (
    <section className={styles.page} aria-labelledby="page-title">
      <h1 id="page-title">{t('login_title')}</h1>
      <p className={styles.sub}>{t('login_sub')}</p>
      <form className={styles.form} onSubmit={handleSubmit}>
        <TextField
          label={t('field_email')}
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          label={t('field_password')}
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <FormError error={login.error} />
        <Button type="submit" wide disabled={login.isPending}>
          {login.isPending ? t('logging_in') : t('log_in')}
        </Button>
      </form>
      <p className={styles.switch}>
        <Link to="/register">{t('no_account')}</Link>
      </p>
    </section>
  );
}
