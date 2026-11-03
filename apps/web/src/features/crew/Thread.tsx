import { ImagePlus, Send } from 'lucide-react';
import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';

import {
  QUICK_REPLIES,
  useComment,
  useCommentPhoto,
  useReactToComment,
  type Comment,
} from '../../api/social';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { FormError } from '../../components/FormError';
import { resizeImage } from '../../components/resizeImage';
import { useI18n } from '../../i18n/context';
import { timeAgo } from '../../i18n/timeAgo';
import { ReactionBar } from './ReactionBar';
import styles from './Thread.module.css';

const PHOTO_SIDE = 1280;

/** Comments on a feed item, quick replies and a reply box. */
export function Thread({ itemId, comments }: { itemId: string; comments: Comment[] }) {
  const { t, lang } = useI18n();
  const comment = useComment();
  const photo = useCommentPhoto();
  const reactTo = useReactToComment();
  const [text, setText] = useState('');
  const [preparing, setPreparing] = useState(false);
  const [unreadable, setUnreadable] = useState(false);
  const picker = useRef<HTMLInputElement>(null);

  // Made small here for the connection, and cleaned on the server whatever a phone sends.
  async function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setPreparing(true);
    setUnreadable(false);
    try {
      const small = await resizeImage(file, { maxSide: PHOTO_SIDE });
      const caption = text.trim();
      photo.mutate(
        { itemId, file: small, ...(caption ? { caption } : {}) },
        { onSuccess: () => setText('') },
      );
    } catch {
      setUnreadable(true); // A file that says it's a picture, and isn't one this phone can open.
    } finally {
      setPreparing(false);
    }
  }

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
              <Avatar
                initials={c.author.initials}
                color={c.author.color}
                image={c.author.avatar_url}
                size={28}
              />
              <span>
                <b>{c.author.display_name}</b>
                {c.quick_key ? t(c.quick_key) : c.body}{' '}
                <span className={styles.time}>{timeAgo(lang, c.created_at)}</span>
                {c.photo_url && (
                  <img
                    className={styles.photo}
                    src={c.photo_url}
                    alt={t('comment_photo_of', { name: c.author.display_name })}
                    loading="lazy"
                  />
                )}
                <ReactionBar
                  small
                  reactions={c.reactions?.emoji ?? []}
                  onToggle={(emoji) => reactTo.mutate({ itemId, commentId: c.id, emoji })}
                />
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
        <input
          ref={picker}
          type="file"
          accept="image/*"
          hidden
          aria-label={t('comment_photo')}
          onChange={(event) => void handlePhoto(event)}
        />
        <button
          type="button"
          className={styles.attach}
          aria-label={t('comment_photo')}
          title={t('comment_photo')}
          disabled={preparing || photo.isPending}
          onClick={() => picker.current?.click()}
        >
          <ImagePlus size={20} aria-hidden="true" />
        </button>
        <Button icon={Send} type="submit" disabled={comment.isPending || !text.trim()}>
          {t('send')}
        </Button>
      </form>
      {unreadable && (
        <p className={styles.unreadable} role="alert">
          {t('comment_photo_unreadable')}
        </p>
      )}
      <FormError error={comment.error ?? photo.error ?? reactTo.error} />
    </div>
  );
}
