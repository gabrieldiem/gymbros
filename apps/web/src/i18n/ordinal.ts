import type { Language } from './translate';

/** [number, suffix] for a rope position: 2 → ["2", "nd"] in English, ["2", "º"] in Spanish. */
export function ordinalParts(lang: Language, n: number): [string, string] {
  if (lang === 'es') return [String(n), 'º'];
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return [String(n), suffixes[(v - 20) % 10] ?? suffixes[v] ?? 'th'];
}

/** "2nd" / "2.º" (the Spanish abbreviation takes a period before the º). */
export function ordinal(lang: Language, n: number): string {
  return lang === 'es' ? `${n}.º` : ordinalParts(lang, n).join('');
}
