import Fuse from 'fuse.js';

import type { EmojiEntry } from '../../api/emojiNames';

const MAX_RESULTS = 64;
// Newer ones show as an empty box on many phones. The list without a search handles this itself.
const NEWEST_VERSION = 15;

export type EmojiSearch = Fuse<EmojiEntry>;

/** Tolerates typos and missing accents: "cohte" finds 🚀, "corazon" finds ❤️. */
export function buildEmojiSearch(data: EmojiEntry[]): EmojiSearch {
  const usable = data.filter((e) => e.group !== undefined && (e.version ?? 0) <= NEWEST_VERSION);
  return new Fuse(usable, {
    keys: [
      { name: 'label', weight: 3 },
      { name: 'tags', weight: 1 },
    ],
    threshold: 0.34,
    ignoreLocation: true,
    ignoreDiacritics: true,
    minMatchCharLength: 2,
  });
}

export function searchEmoji(search: EmojiSearch, query: string): EmojiEntry[] {
  return search.search(query.trim(), { limit: MAX_RESULTS }).map((result) => result.item);
}
