import { useQuery } from '@tanstack/react-query';

type EmojiData = { emoji: string; label: string; skins?: { emoji: string; label: string }[] }[];

const VARIATION_SELECTOR = /\ufe0f/g;
const key = (emoji: string) => emoji.replace(VARIATION_SELECTOR, '');
const capitalized = (label: string, lang: string) =>
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

/** The name of every emoji, from this site like the picker's data. It's a large file, so it only
 * loads when `enabled`, and then stays for the session. */
export function useEmojiNames(lang: string, enabled: boolean) {
  return useQuery({
    queryKey: ['emoji-names', lang],
    enabled,
    queryFn: async ({ signal }) => {
      const response = await fetch(`/emoji/${lang}/data.json`, { signal });
      if (!response.ok) throw new Error('Emoji names did not load');
      return toNames((await response.json()) as EmojiData, lang);
    },
    staleTime: Infinity,
    retry: false,
  }).data;
}
