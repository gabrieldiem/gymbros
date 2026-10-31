import { translate, type Language } from './translate';

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
];

/** "5 min ago", "yesterday", "hace 2 h"... from an ISO timestamp. Under a minute: "just now". */
export function timeAgo(lang: Language, iso: string, now = Date.now()): string {
  const elapsed = now - Date.parse(iso);
  if (elapsed < 60_000) return translate(lang, 'just_now');
  const format = new Intl.RelativeTimeFormat(lang === 'es' ? 'es-ES' : 'en-US', {
    numeric: 'auto',
    style: 'long',
  });
  for (const [unit, ms] of UNITS) {
    if (Math.abs(elapsed) >= ms) return format.format(-Math.round(elapsed / ms), unit);
  }
  return translate(lang, 'just_now');
}
