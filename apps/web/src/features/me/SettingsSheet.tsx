import {
  Download,
  FileDown,
  Languages,
  LogOut,
  Mail,
  SignalLow,
  Timer,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { chooseLowData, lowDataChosen } from '../../api/liveInterval';
import { Link } from 'react-router';

import { useLogout } from '../../api/auth';
import { useDeleteMyAccount, useMe, useUpdateMe } from '../../api/me';
import { Button } from '../../components/Button';
import { FormError } from '../../components/FormError';
import { TextField } from '../../components/TextField';
import { LanguageToggle } from '../../components/LanguageToggle';
import { Segmented } from '../../components/Segmented';
import { Sheet } from '../../components/Sheet';
import { useI18n } from '../../i18n/context';
import { GymsSection } from './GymsSection';
import { ProfileSection } from './ProfileSection';
import styles from './Me.module.css';

const REST_OPTIONS = ['60', '90', '120', '180'] as const;

function LowDataSwitch() {
  const { t } = useI18n();
  const [on, setOn] = useState(lowDataChosen);
  return (
    <div>
      <h3 className={styles.iconTitle}>
        <SignalLow size={18} aria-hidden="true" />
        {t('low_data_title')}
      </h3>
      <label className={styles.switch}>
        <input
          type="checkbox"
          checked={on}
          onChange={(e) => {
            chooseLowData(e.target.checked);
            setOn(e.target.checked);
          }}
        />
        <span>{t('low_data_hint')}</span>
      </label>
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
      <summary>
        <Trash2 size={16} aria-hidden="true" /> {t('delete_account')}
      </summary>
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
        <Trash2 size={16} aria-hidden="true" />
        {t('delete_account')}
      </button>
    </details>
  );
}

/** Everything about you in one place: your profile, gyms, language, rest timer, data and account. */
export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const me = useMe().data;
  const updateMe = useUpdateMe();
  const logout = useLogout();
  return (
    <Sheet title={t('settings')} onClose={onClose}>
      <div className={styles.settings}>
        <ProfileSection />
        <GymsSection />
        <div>
          <h3 className={styles.iconTitle}>
            <Languages size={18} aria-hidden="true" />
            {t('language')}
          </h3>
          <p>{t('language_hint')}</p>
          <LanguageToggle />
        </div>
        <div>
          <h3 className={styles.iconTitle}>
            <Timer size={18} aria-hidden="true" />
            {t('rest_set')}
          </h3>
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
        <LowDataSwitch />
        <div>
          <h3 className={styles.iconTitle}>
            <Mail size={18} aria-hidden="true" />
            {t('email_updates_title')}
          </h3>
          <label className={styles.switch}>
            <input
              type="checkbox"
              checked={me?.email_updates ?? true}
              onChange={(e) => updateMe.mutate({ email_updates: e.target.checked })}
            />
            <span>{t('email_updates_hint')}</span>
          </label>
        </div>
        <div>
          <h3 className={styles.iconTitle}>
            <FileDown size={18} aria-hidden="true" />
            {t('export_title')}
          </h3>
          <p>{t('export_hint')}</p>
          <a className={styles.download} href="/api/me/export" download>
            <Download size={18} aria-hidden="true" />
            {t('export_download')}
          </a>
        </div>
        <Button
          icon={LogOut}
          variant="ghost"
          wide
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
        >
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
