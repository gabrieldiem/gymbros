import { useState, type FormEvent } from 'react';

import { useLogout } from '../../api/auth';
import { useMe, useUpdateMe } from '../../api/me';
import type { CrewColor } from '../../api/types';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { useToast } from '../../components/toast';
import { LanguageToggle } from '../../components/LanguageToggle';
import { Segmented } from '../../components/Segmented';
import { Sheet } from '../../components/Sheet';
import { useI18n } from '../../i18n/context';
import type { MessageKey } from '../../i18n/en';
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

/** Name, color, language, rest timer length and log out. */
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
      </div>
    </Sheet>
  );
}
