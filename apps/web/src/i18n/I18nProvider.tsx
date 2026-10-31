import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { I18nContext, type I18n } from './context';
import type { MessageKey } from './en';
import {
  detectLanguage,
  formatNumber,
  isLanguage,
  translate,
  type Language,
  type Vars,
} from './translate';

const STORAGE_KEY = 'gymbros.lang';

function initialLanguage(): Language {
  const stored = localStorage.getItem(STORAGE_KEY);
  return isLanguage(stored) ? stored : detectLanguage(navigator.language);
}

/** Holds the UI language. Phase 1 syncs it with the user profile; until then it lives locally. */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(initialLanguage);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Language) => {
    localStorage.setItem(STORAGE_KEY, next);
    setLangState(next);
  }, []);

  const value = useMemo<I18n>(
    () => ({
      lang,
      setLang,
      t: (key: MessageKey, vars?: Vars) => translate(lang, key, vars),
      n: (num: number) => formatNumber(lang, num),
    }),
    [lang, setLang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
