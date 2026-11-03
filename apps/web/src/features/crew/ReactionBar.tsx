import { SmilePlus } from 'lucide-react';
import { lazy, Suspense, useState, type ReactNode } from 'react';

import type { EmojiCount } from '../../api/social';
import { cx } from '../../components/cx';
import { useI18n } from '../../i18n/context';
import styles from './ReactionBar.module.css';

const EmojiSheet = lazy(() => import('./EmojiSheet'));

type Props = {
  reactions: EmojiCount[];
  onToggle: (emoji: string) => void;
  /** One tap, even before anyone has used them. */
  always?: string[];
  small?: boolean;
  children?: ReactNode;
};

/** Emoji with their counts, and a way to add any other, like in a chat. */
export function ReactionBar({ reactions, onToggle, always = [], small = false, children }: Props) {
  const { t } = useI18n();
  const [picking, setPicking] = useState(false);
  const names: Record<string, string> = { '👊': t('fist'), '🔥': t('fire') };
  const shown: EmojiCount[] = [
    ...always.map(
      (emoji) => reactions.find((e) => e.emoji === emoji) ?? { emoji, count: 0, mine: false },
    ),
    ...reactions.filter((e) => !always.includes(e.emoji)),
  ];
  return (
    <div className={cx(styles.bar, small && styles.small)}>
      {shown.map(({ emoji, count, mine }) => (
        <button
          key={emoji}
          type="button"
          className={styles.pill}
          aria-pressed={mine}
          aria-label={`${names[emoji] ?? emoji}, ${count}`}
          onClick={() => onToggle(emoji)}
        >
          <i className={styles.emoji}>{emoji}</i>
          {count > 0 && (
            <span key={count} className={styles.count}>
              {count}
            </span>
          )}
        </button>
      ))}
      <button
        type="button"
        className={styles.pill}
        aria-label={t('emoji_add')}
        title={t('emoji_add')}
        onClick={() => setPicking(true)}
      >
        <SmilePlus size={small ? 14 : 18} aria-hidden="true" />
      </button>
      {children}
      {picking && (
        <Suspense fallback={null}>
          <EmojiSheet onPick={onToggle} onClose={() => setPicking(false)} />
        </Suspense>
      )}
    </div>
  );
}
