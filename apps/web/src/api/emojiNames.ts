import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

export type EmojiEntry = {
  emoji: string;
  label: string;
  tags?: string[];
  group?: number;
  version?: number;
  skins?: { emoji: string; label: string }[];
};
type EmojiData = EmojiEntry[];

const VARIATION_SELECTOR = /\ufe0f/g;
const key = (emoji: string) => emoji.replace(VARIATION_SELECTOR, '');
export const capitalized = (label: string, lang: string) =>
  label.charAt(0).toLocaleUpperCase(lang) + label.slice(1);

/** Emoji to their names. The same emoji can arrive with or without its invisible selector. */
export function toNames(data: EmojiData, lang: string): Map<string, string> {
  const names = new Map<string, string>();
  for (const { emoji, label, skins } of data) {
    names.set(key(emoji), capitalized(label, lang));
    for (const skin of skins ?? []) names.set(key(skin.emoji), capitalized(skin.label, lang));
  }
  return names;
}

export const emojiName = (names: Map<string, string> | undefined, emoji: string) =>
  names?.get(key(emoji));

/** Every emoji, from this site like the picker's data. It's a large file, so it only loads when
 * `enabled`, and then stays for the session. */
export function useEmojiData(lang: string, enabled: boolean) {
  return useQuery({
    queryKey: ['emoji-data', lang],
    enabled,
    queryFn: async ({ signal }) => {
      const response = await fetch(`/emoji/${lang}/data.json`, { signal });
      if (!response.ok) throw new Error('Emoji data did not load');
      return (await response.json()) as EmojiData;
    },
    staleTime: Infinity,
    retry: false,
  }).data;
}

export function useEmojiNames(lang: string, enabled: boolean) {
  const data = useEmojiData(lang, enabled);
  return useMemo(() => (data ? toNames(data, lang) : undefined), [data, lang]);
}
