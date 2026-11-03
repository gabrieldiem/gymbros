import {
  Code,
  Eye,
  FileText,
  Hand,
  Megaphone,
  Pencil,
  PencilLine,
  Send,
  Sparkles,
  TrendingUp,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { lazy, Suspense, useState, type FormEvent } from 'react';

import {
  emailTemplatesOptions,
  useAdminCrews,
  useEmailPreview,
  useSendEmailMessage,
  type EmailAudience,
  type EmailTemplate,
} from '../../api/admin';
import { Button } from '../../components/Button';
import { cx } from '../../components/cx';
import { FormError } from '../../components/FormError';
import { LoadingBlock, QueryState } from '../../components/QueryState';
import { Segmented } from '../../components/Segmented';
import { TextField } from '../../components/TextField';
import { useI18n } from '../../i18n/context';
import type { MessageKey } from '../../i18n/en';
import styles from './EmailComposer.module.css';

const RichTextEditor = lazy(() => import('./RichTextEditor'));

const EVERYONE = 'everyone';
const PERSON = 'person';
const BLANK = 'blank';
const TAGS = { name: '{{name}}', app: '{{app_url}}', stop: '{{unsubscribe_url}}' };

type Mode = 'write' | 'html' | 'preview';
type Language = 'en' | 'es';

const CHOICES: { id: string; icon: LucideIcon; title: MessageKey; hint: MessageKey }[] = [
  { id: BLANK, icon: PencilLine, title: 'admin_tpl_blank', hint: 'admin_tpl_blank_hint' },
  {
    id: 'announcement',
    icon: Megaphone,
    title: 'admin_tpl_announcement',
    hint: 'admin_tpl_announcement_hint',
  },
  { id: 'welcome', icon: Sparkles, title: 'admin_tpl_welcome', hint: 'admin_tpl_welcome_hint' },
  { id: 'digest', icon: TrendingUp, title: 'admin_tpl_digest', hint: 'admin_tpl_digest_hint' },
  { id: 'invite', icon: Hand, title: 'admin_tpl_invite', hint: 'admin_tpl_invite_hint' },
];

/** Nothing but tags isn't a message, like the empty paragraph the editor starts with. */
const hasContent = (html: string) => /<img\b/i.test(html) || html.replace(/<[^>]*>/g, '').trim();

function Preview({ html, full }: { html: string; full: boolean }) {
  const { t } = useI18n();
  const query = useEmailPreview(html, full);
  return (
    <QueryState query={query} failed="admin_failed">
      {(result) => (
        // No scripts and no access to this page: it's an email, whatever it says.
        <iframe
          className={styles.frame}
          title={t('admin_email_preview')}
          sandbox=""
          srcDoc={result.html}
        />
      )}
    </QueryState>
  );
}

/** Write to members: from a blank page, from any email GYMBROS sends, or send one as it is. */
export function EmailComposer() {
  const { t, lang } = useI18n();
  const crews = useAdminCrews().data ?? [];
  const send = useSendEmailMessage();
  const queryClient = useQueryClient();
  const [language, setLanguage] = useState<Language>(lang);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [choice, setChoice] = useState(BLANK);
  // A template sent as it is: each person gets their own copy. Null when you're writing.
  const [live, setLive] = useState<EmailTemplate | null>(null);
  const [mode, setMode] = useState<Mode>('write');
  const [full, setFull] = useState(false);
  const [edited, setEdited] = useState(false);
  const [target, setTarget] = useState(EVERYONE);
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [html, setHtml] = useState('');
  const [reach, setReach] = useState<number | null>(null);
  const [result, setResult] = useState<{ recipients: number; sent: number } | null>(null);
  // Remounts the editor when something else replaces what's in it.
  const [editorKey, setEditorKey] = useState(0);

  const resetOutcome = () => {
    setReach(null);
    setResult(null);
  };

  const startFrom = (template: EmailTemplate) => {
    setSubject(template.subject);
    setHtml(template.html);
    setFull(true);
    setLive(null);
    setMode('html');
  };

  const choose = async (id: string, inLanguage: Language = language) => {
    resetOutcome();
    setChoice(id);
    setEdited(false);
    setLoadError(null);
    if (id === BLANK) {
      setLive(null);
      setFull(false);
      setSubject('');
      setHtml('');
      setMode('write');
      setEditorKey((key) => key + 1);
      return;
    }
    let list: EmailTemplate[];
    try {
      list = await queryClient.fetchQuery(emailTemplatesOptions(inLanguage));
    } catch (error) {
      setLoadError(error);
      return;
    }
    const template = list.find((item) => item.id === id);
    if (!template) return;
    if (template.live) {
      setLive(template);
      setMode('preview');
    } else {
      startFrom(template);
    }
  };

  const audience: EmailAudience =
    target === EVERYONE ? {} : target === PERSON ? { email: email.trim() } : { crew_id: target };
  const message = live
    ? { ...audience, template: live.id }
    : { ...audience, subject: subject.trim(), html, full_document: full };
  const ready = Boolean(
    (live || (subject.trim() && hasContent(html))) && (target !== PERSON || email.trim()),
  );

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (reach === null) {
      send.mutate({ ...message, dry_run: true }, { onSuccess: (r) => setReach(r.recipients) });
      return;
    }
    send.mutate(message, {
      onSuccess: (r) => {
        void choose(BLANK); // First: it clears the last outcome.
        setResult(r);
      },
    });
  };

  const modes = [
    ...(full ? [] : [{ value: 'write' as const, label: t('admin_mode_write'), icon: Pencil }]),
    { value: 'html' as const, label: t('admin_mode_html'), icon: Code },
    { value: 'preview' as const, label: t('admin_mode_preview'), icon: Eye },
  ];

  return (
    <section className={styles.box} aria-labelledby="email-compose-title">
      <h2 id="email-compose-title">{t('admin_email_compose')}</h2>
      <p className={styles.muted}>{t('admin_email_compose_hint')}</p>

      <fieldset className={styles.choices}>
        <legend>{t('admin_tpl_title')}</legend>
        <div className={styles.cards}>
          {CHOICES.map(({ id, icon: Icon, title, hint }) => (
            <label key={id} className={cx(styles.card, choice === id && styles.cardOn)}>
              <input
                type="radio"
                name="email-template"
                checked={choice === id}
                onChange={() => void choose(id)}
              />
              <Icon size={20} aria-hidden="true" />
              <b>{t(title)}</b>
              <small>{t(hint)}</small>
            </label>
          ))}
        </div>
      </fieldset>
      <FormError error={loadError} />
      {/* Once it's yours, another language would throw your changes away. */}
      {choice !== BLANK && !edited && (
        <Segmented
          label={t('admin_tpl_language')}
          value={language}
          onChange={(next) => {
            setLanguage(next);
            void choose(choice, next);
          }}
          options={[
            { value: 'en', label: 'English' },
            { value: 'es', label: 'Español' },
          ]}
        />
      )}

      <form className={styles.form} onSubmit={handleSubmit}>
        <label className={styles.inline}>
          {t('admin_email_to')}
          <select
            value={target}
            onChange={(e) => {
              setTarget(e.target.value);
              resetOutcome();
            }}
          >
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
            onChange={(e) => {
              setEmail(e.target.value);
              resetOutcome();
            }}
          />
        )}

        {live ? (
          <>
            <p className={styles.note}>{t('admin_tpl_live_note')}</p>
            <Preview html={live.html} full />
            <div>
              <Button
                type="button"
                variant="ghost"
                icon={FileText}
                onClick={() => {
                  setEdited(true);
                  resetOutcome();
                  startFrom(live);
                }}
              >
                {t('admin_tpl_edit_copy')}
              </Button>
            </div>
          </>
        ) : (
          <>
            <TextField
              label={t('admin_email_subject')}
              maxLength={120}
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                setEdited(true);
                resetOutcome();
              }}
            />
            <Segmented
              label={t('admin_email_mode')}
              value={mode}
              onChange={(next) => {
                // What was typed as HTML has to reach the editor when you go back to it.
                if (next === 'write') setEditorKey((key) => key + 1);
                setMode(next);
              }}
              options={modes}
            />
            {mode === 'write' && (
              <Suspense fallback={<LoadingBlock rows={3} />}>
                <RichTextEditor
                  key={editorKey}
                  value={html}
                  label={t('admin_email_body')}
                  onChange={(value) => {
                    setHtml(value);
                    setEdited(true);
                    resetOutcome();
                  }}
                />
              </Suspense>
            )}
            {mode === 'html' && (
              <label className={styles.code}>
                {t('admin_mode_html')}
                <textarea
                  rows={16}
                  maxLength={200_000}
                  spellCheck={false}
                  value={html}
                  onChange={(e) => {
                    setHtml(e.target.value);
                    setEdited(true);
                    resetOutcome();
                  }}
                />
              </label>
            )}
            {mode === 'preview' &&
              (hasContent(html) ? (
                <Preview html={html} full={full} />
              ) : (
                <p className={styles.muted}>{t('admin_email_preview_empty')}</p>
              ))}
            <p className={styles.note}>{t('admin_email_tags', TAGS)}</p>
            {full && choice === 'digest' && (
              <p className={styles.warning}>{t('admin_tpl_digest_example')}</p>
            )}
          </>
        )}

        <FormError error={send.error} />
        {result && (
          <p role="status" className={result.sent === result.recipients ? '' : styles.warning}>
            {t('admin_email_result', { sent: result.sent, n: result.recipients })}
          </p>
        )}
        <div className={styles.actions}>
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
