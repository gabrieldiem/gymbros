import { useState, type FormEvent } from 'react';

import { useSendFeedback, type FeedbackKind } from '../../api/feedback';
import { Button } from '../../components/Button';
import { FormError } from '../../components/FormError';
import { Segmented } from '../../components/Segmented';
import { Sheet } from '../../components/Sheet';
import { useToast } from '../../components/toast';
import { useI18n } from '../../i18n/context';
import styles from './Me.module.css';

const MAX_LENGTH = 2000;

/** Tell the people running the app about an idea or a bug. They read it in the backoffice. */
export function FeedbackSheet({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const send = useSendFeedback();
  const showToast = useToast();
  const [kind, setKind] = useState<FeedbackKind>('idea');
  const [body, setBody] = useState('');

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    send.mutate(
      { kind, body: body.trim() },
      {
        onSuccess: () => {
          showToast(t('feedback_thanks'));
          onClose();
        },
      },
    );
  };

  return (
    <Sheet title={t('feedback_title')} onClose={onClose}>
      <form className={styles.settings} onSubmit={handleSubmit}>
        <p>{t('feedback_hint')}</p>
        <Segmented
          label={t('feedback_kind')}
          value={kind}
          onChange={setKind}
          options={[
            { value: 'idea', label: t('feedback_idea') },
            { value: 'bug', label: t('feedback_bug') },
            { value: 'other', label: t('feedback_other') },
          ]}
        />
        <label className={styles.feedbackBody}>
          {t('feedback_body')}
          <textarea
            required
            rows={5}
            maxLength={MAX_LENGTH}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </label>
        <FormError error={send.error} />
        <Button type="submit" wide disabled={!body.trim() || send.isPending}>
          {t('feedback_send')}
        </Button>
      </form>
    </Sheet>
  );
}
