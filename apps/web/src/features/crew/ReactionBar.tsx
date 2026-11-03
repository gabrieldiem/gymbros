import { SmilePlus } from 'lucide-react';
import {
  lazy,
  Suspense,
  useId,
  useState,
  type FocusEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';

import { emojiName, useEmojiNames } from '../../api/emojiNames';
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
  const { t, lang } = useI18n();
  const [picking, setPicking] = useState(false);
  // A mouse or a keyboard, not a finger: a tap shouldn't download every emoji's name.
  const [wantNames, setWantNames] = useState(false);
  const allNames = useEmojiNames(lang, wantNames);
  const tipPrefix = useId();
  const list = new Intl.ListFormat(lang === 'es' ? 'es-ES' : 'en-GB', { type: 'conjunction' });
  const handlePointerEnter = (event: PointerEvent) => {
    if (event.pointerType === 'mouse') setWantNames(true);
  };
  const handleFocus = (event: FocusEvent<HTMLElement>) => {
    if (event.target.matches(':focus-visible')) setWantNames(true);
  };
  const names: Record<string, string> = { '👊': t('fist'), '🔥': t('fire') };
  const shown: EmojiCount[] = [
    ...always.map(
      (emoji) => reactions.find((e) => e.emoji === emoji) ?? { emoji, count: 0, mine: false },
    ),
    ...reactions.filter((e) => !always.includes(e.emoji)),
  ];
  return (
    <div className={cx(styles.bar, small && styles.small)}>
      {shown.map(({ emoji, count, mine, names: others = [] }, index) => {
        const name = names[emoji] ?? emojiName(allNames, emoji);
        const people = [...(mine ? [t('you')] : []), ...others];
        const tipId = `${tipPrefix}-${index}`;
        return (
          <span key={emoji} className={styles.withTip}>
            <button
              type="button"
              className={styles.pill}
              aria-pressed={mine}
              aria-label={`${names[emoji] ?? emoji}, ${count}`}
              aria-describedby={name || people.length ? tipId : undefined}
              onPointerEnter={handlePointerEnter}
              onFocus={handleFocus}
              onClick={() => onToggle(emoji)}
            >
              <i className={styles.emoji}>{emoji}</i>
              {count > 0 && (
                <span key={count} className={styles.count}>
                  {count}
                </span>
              )}
            </button>
            {(name || people.length > 0) && (
              <span id={tipId} role="tooltip" className={styles.tip}>
                {name && <b>{name}</b>} {people.length > 0 && <span>{list.format(people)}</span>}
              </span>
            )}
          </span>
        );
      })}
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
