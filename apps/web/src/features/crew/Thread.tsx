import { useState, type FormEvent } from 'react';

import { QUICK_REPLIES, useComment, type Comment } from '../../api/social';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { FormError } from '../../components/FormError';
import { useI18n } from '../../i18n/context';
import { timeAgo } from '../../i18n/timeAgo';
import styles from './Thread.module.css';

/** Comments on a feed item, quick replies and a reply box. */
export function Thread({ itemId, comments }: { itemId: string; comments: Comment[] }) {
  const { t, lang } = useI18n();
  const comment = useComment();
  const [text, setText] = useState('');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const body = text.trim();
    if (!body) return;
    comment.mutate({ itemId, body }, { onSuccess: () => setText('') });
  }

  return (
    <div className={styles.thread}>
      {comments.length ? (
        <ul className={styles.list}>
          {comments.map((c) => (
            <li key={c.id}>
              <Avatar initials={c.author.initials} color={c.author.color} size={28} />
              <span>
                <b>{c.author.display_name}</b>
                {c.quick_key ? t(c.quick_key) : c.body}{' '}
                <span className={styles.time}>{timeAgo(lang, c.created_at)}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>{t('no_comments')}</p>
      )}
      <div className={styles.quick} role="group" aria-label={t('quick_replies')}>
        {QUICK_REPLIES.map((key) => (
          <button
            key={key}
            type="button"
            disabled={comment.isPending}
            onClick={() => comment.mutate({ itemId, quick_key: key })}
          >
            {t(key)}
          </button>
        ))}
      </div>
      <form className={styles.reply} onSubmit={handleSubmit}>
        <input
          value={text}
          maxLength={140}
          placeholder={t('comment_ph')}
          aria-label={t('comment_ph')}
          autoComplete="off"
          onChange={(e) => setText(e.target.value)}
        />
        <Button type="submit" disabled={comment.isPending || !text.trim()}>
          {t('send')}
        </Button>
      </form>
      <FormError error={comment.error} />
    </div>
  );
}
