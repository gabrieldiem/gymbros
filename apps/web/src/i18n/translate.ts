import { en, type MessageKey, type Messages } from './en';
import { es } from './es';

export const LANGUAGES = ['en', 'es'] as const;
export type Language = (typeof LANGUAGES)[number];
export type Vars = Record<string, string | number>;

const CATALOGS: Record<Language, Messages> = { en, es };
const LOCALES: Record<Language, string> = { en: 'en-US', es: 'es-ES' };

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

/** `es-AR` → `es`. Anything that is not Spanish falls back to English. */
export function detectLanguage(browserLanguage: string | undefined): Language {
  return browserLanguage?.toLowerCase().startsWith('es') ? 'es' : 'en';
}

export function formatNumber(lang: Language, value: number): string {
  // es-ES skips the grouping separator for 4-digit numbers by default; the spec wants 3.880.
  return new Intl.NumberFormat(LOCALES[lang], { useGrouping: 'always' }).format(value);
}

/** Look up `key` and replace `{name}` placeholders. Numbers use the language's locale format. */
export function translate(lang: Language, key: MessageKey, vars: Vars = {}): string {
  return CATALOGS[lang][key].replace(/\{(\w+)\}/g, (placeholder, name: string) => {
    const value = vars[name];
    if (value === undefined) return placeholder;
    return typeof value === 'number' ? formatNumber(lang, value) : value;
  });
}
