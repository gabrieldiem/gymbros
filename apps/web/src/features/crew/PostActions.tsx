import { MessageCircle } from 'lucide-react';
import { useState } from 'react';

import { useReact, type FeedItem } from '../../api/social';
import { useI18n } from '../../i18n/context';
import styles from './Feed.module.css';
import { ReactionBar } from './ReactionBar';
import { Thread } from './Thread';

/** What every post has under it: reactions, and the comments behind a button. */
export function PostActions({ item }: { item: FeedItem }) {
  const { t } = useI18n();
  const react = useReact();
  const [open, setOpen] = useState(false);
  return (
    <>
      <ReactionBar
        reactions={item.reactions.emoji ?? []}
        always={['👊', '🔥']}
        onToggle={(emoji) => react.mutate({ itemId: item.id, kind: emoji })}
      >
        <button
          type="button"
          className={styles.commentsButton}
          aria-expanded={open}
          aria-label={t('comments_n', { n: item.comments.length })}
          onClick={() => setOpen((o) => !o)}
        >
          <MessageCircle size={16} aria-hidden="true" /> <span>{item.comments.length}</span>
        </button>
      </ReactionBar>
      {open && <Thread itemId={item.id} comments={item.comments} />}
    </>
  );
}
