import { Eye, Send, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import {
  useAdminCrews,
  useEmailSettings,
  useSendEmailMessage,
  useTestDigest,
  useUpdateEmailSettings,
  type EmailAudience,
} from '../../api/admin';
import { Button } from '../../components/Button';
import { FormError } from '../../components/FormError';
import { QueryState } from '../../components/QueryState';
import { TextField } from '../../components/TextField';
import { useI18n } from '../../i18n/context';
import styles from './Admin.module.css';

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const EVERYONE = 'everyone';
const PERSON = 'person';

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

function Compose() {
  const { t } = useI18n();
  const crews = useAdminCrews().data ?? [];
  const send = useSendEmailMessage();
  const [target, setTarget] = useState(EVERYONE);
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [reach, setReach] = useState<number | null>(null);
  const [result, setResult] = useState<{ recipients: number; sent: number } | null>(null);

  const audience: EmailAudience =
    target === EVERYONE ? {} : target === PERSON ? { email: email.trim() } : { crew_id: target };
  const message = { ...audience, subject: subject.trim(), body: body.trim() };
  const ready = Boolean(message.subject && message.body && (target !== PERSON || email.trim()));

  // Anything changed: the count on the confirm button no longer holds.
  const changed =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      setReach(null);
      setResult(null);
    };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (reach === null) {
      send.mutate({ ...message, dry_run: true }, { onSuccess: (r) => setReach(r.recipients) });
      return;
    }
    send.mutate(message, {
      onSuccess: (r) => {
        setResult(r);
        setReach(null);
        setSubject('');
        setBody('');
      },
    });
  };

  return (
    <section className={styles.emailBox} aria-labelledby="email-compose-title">
      <h2 id="email-compose-title">{t('admin_email_compose')}</h2>
      <p className={styles.muted}>{t('admin_email_compose_hint')}</p>
      <form className={styles.emailForm} onSubmit={handleSubmit}>
        <label className={styles.inlineField}>
          {t('admin_email_to')}
          <select value={target} onChange={(e) => changed(setTarget)(e.target.value)}>
            <option value={EVERYONE}>{t('admin_email_everyone')}</option>
            {crews.map((crew) => (
              <option key={crew.id} value={crew.id}>
                {crew.name}
              </option>
            ))}
            <option value={PERSON}>{t('admin_email_person')}</option>
          </select>
        </label>
        {target === PERSON && (
          <TextField
            label={t('admin_email_address')}
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => changed(setEmail)(e.target.value)}
          />
        )}
        <TextField
          label={t('admin_email_subject')}
          maxLength={120}
          value={subject}
          onChange={(e) => changed(setSubject)(e.target.value)}
        />
        <label className={styles.bodyField}>
          {t('admin_email_body')}
          <textarea
            rows={7}
            maxLength={5000}
            value={body}
            onChange={(e) => changed(setBody)(e.target.value)}
          />
        </label>
        <FormError error={send.error} />
        {result && (
          <p
            role="status"
            className={result.sent === result.recipients ? undefined : styles.warning}
          >
            {t('admin_email_result', { sent: result.sent, n: result.recipients })}
          </p>
        )}
        <div className={styles.toolbar}>
          <Button
            type="submit"
            icon={reach === null ? Eye : Send}
            disabled={!ready || send.isPending || reach === 0}
          >
            {reach === null ? t('admin_email_review') : t('admin_email_send', { n: reach })}
          </Button>
          {reach !== null && (
            <Button icon={X} type="button" variant="quiet" onClick={() => setReach(null)}>
              {t('cancel')}
            </Button>
          )}
        </div>
        {reach === 0 && <p className={styles.warning}>{t('admin_email_nobody')}</p>}
      </form>
    </section>
  );
}

/** The welcome email and weekly digest settings, and a box to write to members. */
export function EmailTab() {
  return (
    <div className="stagger">
      <Settings />
      <Compose />
    </div>
  );
}
