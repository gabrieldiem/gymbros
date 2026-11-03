import { EmojiPicker } from 'frimousse';
import { useMemo, useState } from 'react';

import { capitalized, useEmojiData } from '../../api/emojiNames';
import { LoadingBlock } from '../../components/QueryState';
import { Sheet } from '../../components/Sheet';
import { useI18n } from '../../i18n/context';
import { buildEmojiSearch, searchEmoji } from './emojiSearch';
import styles from './EmojiSheet.module.css';

type Props = { onPick: (emoji: string) => void; onClose: () => void };

function ActiveName({ emoji, label }: { emoji?: string | undefined; label?: string | undefined }) {
  return (
    <div className={styles.active} aria-hidden="true">
      {emoji && (
        <>
          <span className={styles.activeEmoji}>{emoji}</span>
          <span className={styles.activeName}>{label}</span>
        </>
      )}
    </div>
  );
}

/** Every emoji, by category or by a search that forgives typos, in the member's language. The
 * data comes from this server, so nobody else hears about it. Only loaded when someone opens it. */
export default function EmojiSheet({ onPick, onClose }: Props) {
  const { t, lang } = useI18n();
  const [query, setQuery] = useState('');
  const [hovered, setHovered] = useState<{ emoji: string; label: string } | null>(null);
  const searching = query.trim().length > 0;
  const data = useEmojiData(lang, searching);
  const search = useMemo(() => (data ? buildEmojiSearch(data) : null), [data]);
  const results = useMemo(
    () => (search && searching ? searchEmoji(search, query) : []),
    [search, searching, query],
  );
  const pick = (emoji: string) => {
    onPick(emoji);
    onClose();
  };

  return (
    <Sheet title={t('emoji_pick')} onClose={onClose}>
      <div className={styles.picker}>
        <input
          className={styles.search}
          type="search"
          placeholder={t('emoji_search')}
          aria-label={t('emoji_search')}
          autoComplete="off"
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setHovered(null);
          }}
        />
        {searching ? (
          <>
            <div className={styles.viewport}>
              {!search ? (
                <LoadingBlock rows={2} />
              ) : results.length === 0 ? (
                <p className={styles.note}>{t('emoji_none')}</p>
              ) : (
                <ul className={styles.results}>
                  {results.map(({ emoji, label }) => (
                    <li key={emoji}>
                      <button
                        type="button"
                        className={styles.emoji}
                        title={label}
                        aria-label={label}
                        onPointerEnter={() => setHovered({ emoji, label })}
                        onFocus={() => setHovered({ emoji, label })}
                        onClick={() => pick(emoji)}
                      >
                        {emoji}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <ActiveName
              emoji={hovered?.emoji}
              label={hovered ? capitalized(hovered.label, lang) : undefined}
            />
          </>
        ) : (
          <EmojiPicker.Root
            className={styles.browse}
            locale={lang}
            emojibaseUrl="/emoji"
            columns={8}
            onEmojiSelect={({ emoji }) => pick(emoji)}
          >
            <EmojiPicker.Viewport className={styles.viewport}>
              <EmojiPicker.Loading className={styles.note}>{t('loading')}</EmojiPicker.Loading>
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
            <EmojiPicker.ActiveEmoji>
              {({ emoji }) => <ActiveName emoji={emoji?.emoji} label={emoji?.label} />}
            </EmojiPicker.ActiveEmoji>
          </EmojiPicker.Root>
        )}
      </div>
    </Sheet>
  );
}
