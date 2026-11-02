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

/** A moment from the API ("2026-10-29T18:30:00Z") as "Thu 29 Oct, 15:30", on this device's clock. */
export function formatMoment(lang: Language, moment: string): string {
  const format = new Intl.DateTimeFormat(lang === 'es' ? 'es-ES' : 'en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  return format.format(new Date(moment));
}
