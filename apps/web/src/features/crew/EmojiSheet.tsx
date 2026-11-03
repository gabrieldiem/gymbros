import { EmojiPicker } from 'frimousse';

import { Sheet } from '../../components/Sheet';
import { useI18n } from '../../i18n/context';
import styles from './EmojiSheet.module.css';

type Props = { onPick: (emoji: string) => void; onClose: () => void };

/** Every emoji, searchable in the member's language. Its data comes from this server, so nobody
 * else hears about it. Only loaded when someone opens it. */
export default function EmojiSheet({ onPick, onClose }: Props) {
  const { t, lang } = useI18n();
  return (
    <Sheet title={t('emoji_pick')} onClose={onClose}>
      <EmojiPicker.Root
        className={styles.picker}
        locale={lang}
        emojibaseUrl="/emoji"
        columns={8}
        onEmojiSelect={({ emoji }) => {
          onPick(emoji);
          onClose();
        }}
      >
        <EmojiPicker.Search
          className={styles.search}
          placeholder={t('emoji_search')}
          aria-label={t('emoji_search')}
          autoFocus
        />
        <EmojiPicker.Viewport className={styles.viewport}>
          <EmojiPicker.Loading className={styles.note}>{t('loading')}</EmojiPicker.Loading>
          <EmojiPicker.Empty className={styles.note}>{t('emoji_none')}</EmojiPicker.Empty>
          <EmojiPicker.List
            components={{
              CategoryHeader: ({ category, ...props }) => (
                <div className={styles.category} {...props}>
                  {category.label}
                </div>
              ),
              Row: ({ children, ...props }) => (
                <div className={styles.row} {...props}>
                  {children}
                </div>
              ),
              Emoji: ({ emoji, ...props }) => (
                <button type="button" className={styles.emoji} title={emoji.label} {...props}>
                  {emoji.emoji}
                </button>
              ),
            }}
          />
        </EmojiPicker.Viewport>
        <div className={styles.active} aria-hidden="true">
          <EmojiPicker.ActiveEmoji>
            {({ emoji }) =>
              emoji ? (
                <>
                  <span className={styles.activeEmoji}>{emoji.emoji}</span>
                  <span className={styles.activeName}>{emoji.label}</span>
                </>
              ) : null
            }
          </EmojiPicker.ActiveEmoji>
        </div>
      </EmojiPicker.Root>
    </Sheet>
  );
}
