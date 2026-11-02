import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';

import { useLogout } from '../../api/auth';
import { useDeleteMyAccount, useMe, useUpdateMe } from '../../api/me';
import type { CrewColor } from '../../api/types';
import { Button } from '../../components/Button';
import { FormError } from '../../components/FormError';
import { TextField } from '../../components/TextField';
import { useToast } from '../../components/toast';
import { LanguageToggle } from '../../components/LanguageToggle';
import { Segmented } from '../../components/Segmented';
import { Sheet } from '../../components/Sheet';
import { useI18n } from '../../i18n/context';
import type { MessageKey } from '../../i18n/en';
import { GymsSection } from './GymsSection';
import styles from './Me.module.css';

const REST_OPTIONS = ['60', '90', '120', '180'] as const;

const COLORS: { value: CrewColor; hex: string; label: MessageKey }[] = [
  { value: 'volt', hex: '#FFE600', label: 'color_volt' },
  { value: 'red', hex: '#FF3B1F', label: 'color_red' },
  { value: 'cyan', hex: '#00D1FF', label: 'color_cyan' },
  { value: 'pink', hex: '#FF4FD8', label: 'color_pink' },
  { value: 'violet', hex: '#B48CFF', label: 'color_violet' },
];

function NameForm() {
  const { t } = useI18n();
  const me = useMe().data;
  const updateMe = useUpdateMe();
  const showToast = useToast();
  const [name, setName] = useState(me?.display_name ?? '');
  const trimmed = name.trim();
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    updateMe.mutate({ display_name: trimmed }, { onSuccess: () => showToast(t('saved')) });
  };
  return (
    <form className={styles.nameForm} onSubmit={handleSubmit}>
      <TextField
        label={t('settings_name')}
        hint={t('settings_name_hint')}
        autoComplete="nickname"
        required
        maxLength={24}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <Button
        type="submit"
        variant="ghost"
        disabled={!trimmed || trimmed === me?.display_name || updateMe.isPending}
      >
        {t('save')}
      </Button>
    </form>
  );
}

function ColorPicker() {
  const { t } = useI18n();
  const me = useMe().data;
  const updateMe = useUpdateMe();
  return (
    <div>
      <h3>{t('settings_color')}</h3>
      <div className={styles.colors} role="group" aria-label={t('settings_color')}>
        {COLORS.map(({ value, hex, label }) => (
          <button
            key={value}
            type="button"
            className={styles.color}
            style={{ background: hex }}
            aria-pressed={me?.color === value}
            aria-label={t(label)}
            onClick={() => updateMe.mutate({ color: value })}
          />
        ))}
      </div>
    </div>
  );
}

function DeleteAccount() {
  const { t } = useI18n();
  const me = useMe().data;
  const destroy = useDeleteMyAccount();
  const [typed, setTyped] = useState('');
  const email = me?.email ?? '';
  const matches = typed.trim().toLowerCase() === email.toLowerCase();
  return (
    <details className={styles.deleteAccount}>
      <summary>{t('delete_account')}</summary>
      <p>{t('delete_hint')}</p>
      <TextField
        label={t('delete_type_email', { email })}
        autoComplete="off"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
      />
      <FormError error={destroy.error} />
      <button
        type="button"
        className={styles.destroy}
        disabled={!matches || destroy.isPending}
        onClick={() => destroy.mutate(typed)}
      >
        {t('delete_account')}
      </button>
    </details>
  );
}

/** Name, color, language, rest timer length, log out and deleting the account. */
export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const me = useMe().data;
  const updateMe = useUpdateMe();
  const logout = useLogout();
  return (
    <Sheet title={t('settings')} onClose={onClose}>
      <div className={styles.settings}>
        <NameForm />
        <ColorPicker />
        <GymsSection />
        <div>
          <h3>{t('language')}</h3>
          <p>{t('language_hint')}</p>
          <LanguageToggle />
        </div>
        <div>
          <h3>{t('rest_set')}</h3>
          <p>{t('rest_hint')}</p>
          <Segmented
            label={t('rest_set')}
            value={String(me?.rest_seconds ?? 90)}
            onChange={(value) => updateMe.mutate({ rest_seconds: Number(value) })}
            options={REST_OPTIONS.map((s) => ({
              value: s,
              label: t('seconds_n', { n: Number(s) }),
            }))}
          />
        </div>
        <Button variant="ghost" wide onClick={() => logout.mutate()} disabled={logout.isPending}>
          {t('log_out')}
        </Button>
        <DeleteAccount />
        <p className={styles.legal}>
          <Link to="/privacy">{t('legal_privacy')}</Link>
          <Link to="/terms">{t('legal_terms')}</Link>
        </p>
      </div>
    </Sheet>
  );
}
