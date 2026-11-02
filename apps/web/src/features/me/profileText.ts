const MAX_CHARACTERS = 2;

/** The first two characters as a person counts them: 👨‍👩‍👧‍👦 is one, however it's encoded. */
export function firstCharacters(text: string): string {
  const segments = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)];
  return segments
    .slice(0, MAX_CHARACTERS)
    .map((s) => s.segment)
    .join('');
}
