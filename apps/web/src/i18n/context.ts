import { createContext, useContext } from 'react';

import type { MessageKey } from './en';
import type { Language, Vars } from './translate';

export type I18n = {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: MessageKey, vars?: Vars) => string;
  n: (value: number) => string;
};

export const I18nContext = createContext<I18n | null>(null);

export function useI18n(): I18n {
  const i18n = useContext(I18nContext);
  if (!i18n) throw new Error('useI18n must be used inside <I18nProvider>');
  return i18n;
}
