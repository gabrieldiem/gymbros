import type { Language } from './translate';

/** A calendar day from the API ("2026-10-29") as "Thu 29 Oct". It has no time zone to convert. */
export function formatDay(lang: Language, day: string): string {
  const format = new Intl.DateTimeFormat(lang === 'es' ? 'es-ES' : 'en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
  return format.format(new Date(`${day}T12:00:00Z`));
}
