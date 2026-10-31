import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';

import { useRegister } from '../../api/auth';
import type { RegisterBody } from '../../api/types';
import { Button } from '../../components/Button';
import { FormError } from '../../components/FormError';
import { TextField } from '../../components/TextField';
import { useI18n } from '../../i18n/context';
import styles from './AuthPage.module.css';

type Fields = { name: string; email: string; password: string; inviteCode: string };

function toBody(fields: Fields, language: RegisterBody['language']): RegisterBody {
  const body: RegisterBody = {
    display_name: fields.name.trim(),
    email: fields.email.trim(),
    password: fields.password,
    language,
  };
  const code = fields.inviteCode.trim();
  return code ? { ...body, invite_code: code } : body;
}

export function RegisterPage() {
  const { t, lang } = useI18n();
  const register = useRegister();
  const [fields, setFields] = useState<Fields>({
    name: '',
    email: '',
    password: '',
    inviteCode: '',
  });
  const set = (key: keyof Fields) => (e: { target: { value: string } }) =>
    setFields((current) => ({ ...current, [key]: e.target.value }));

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    register.mutate(toBody(fields, lang));
  }

  return (
    <section className={styles.page} aria-labelledby="page-title">
      <h1 id="page-title">{t('register_title')}</h1>
      <p className={styles.sub}>{t('register_sub')}</p>
      <form className={styles.form} onSubmit={handleSubmit}>
        <TextField
          label={t('field_name')}
          hint={t('field_name_hint')}
          autoComplete="nickname"
          required
          maxLength={24}
          value={fields.name}
          onChange={set('name')}
        />
        <TextField
          label={t('field_email')}
          type="email"
          autoComplete="email"
          required
          value={fields.email}
          onChange={set('email')}
        />
        <TextField
          label={t('field_password')}
          hint={t('field_password_hint')}
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
          value={fields.password}
          onChange={set('password')}
        />
        <TextField
          label={t('field_invite')}
          hint={t('field_invite_hint')}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={20}
          value={fields.inviteCode}
          onChange={set('inviteCode')}
        />
        <FormError error={register.error} />
        <Button type="submit" wide disabled={register.isPending}>
          {register.isPending ? t('creating_account') : t('create_account')}
        </Button>
      </form>
      <p className={styles.switch}>
        <Link to="/login">{t('have_account')}</Link>
      </p>
    </section>
  );
}
