import { Send } from 'lucide-react';

import { useEmailSettings, useTestDigest, useUpdateEmailSettings } from '../../api/admin';
import { Button } from '../../components/Button';
import { FormError } from '../../components/FormError';
import { QueryState } from '../../components/QueryState';
import { useI18n } from '../../i18n/context';
import styles from './Admin.module.css';
import { EmailComposer } from './EmailComposer';

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

function Settings() {
  const { t, n } = useI18n();
  const query = useEmailSettings();
  const update = useUpdateEmailSettings();
  const test = useTestDigest();
  return (
    <QueryState query={query} failed="admin_failed">
      {(settings) => (
        <section className={styles.emailBox} aria-labelledby="email-settings-title">
          <h2 id="email-settings-title">{t('admin_email_settings')}</h2>
          <p className={settings.configured ? styles.muted : styles.warning} role="status">
            {settings.configured
              ? t('admin_email_from', { sender: settings.sender })
              : t('admin_email_not_configured')}
          </p>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={settings.welcome_enabled}
              onChange={(e) => update.mutate({ welcome_enabled: e.target.checked })}
            />
            {t('admin_email_welcome')}
          </label>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={settings.digest_enabled}
              onChange={(e) => update.mutate({ digest_enabled: e.target.checked })}
            />
            {t('admin_email_digest')}
          </label>
          <label className={styles.inlineField}>
            {t('admin_email_hour')}
            <select
              value={settings.digest_hour}
              onChange={(e) => update.mutate({ digest_hour: Number(e.target.value) })}
            >
              {HOURS.map((hour) => (
                <option key={hour} value={hour}>
                  {`${String(hour).padStart(2, '0')}:00`}
                </option>
              ))}
            </select>
          </label>
          <p className={styles.muted}>
            {t('admin_email_sent_count', { n: n(settings.digests_sent_this_week) })}
          </p>
          <div>
            <Button
              icon={Send}
              variant="ghost"
              disabled={test.isPending}
              onClick={() => test.mutate()}
            >
              {t('admin_email_test')}
            </Button>
            {test.data && (
              <p className={styles.muted} role="status">
                {t(test.data.sent ? 'admin_email_test_sent' : 'admin_email_test_failed')}
              </p>
            )}
          </div>
          <FormError error={update.error ?? test.error} />
        </section>
      )}
    </QueryState>
  );
}

/** The welcome email and weekly digest settings, and a box to write to members. */
export function EmailTab() {
  return (
    <div className="stagger">
      <Settings />
      <EmailComposer />
    </div>
  );
}
