import { useEffect, useRef } from 'react';

import { useMe, useUpdateMe } from '../api/me';
import type { Language } from '../api/types';
import { useI18n } from './context';

/** Switch the UI language and, when signed in, store it on the profile. */
export function useChangeLanguage(): (lang: Language) => void {
  const { setLang } = useI18n();
  const me = useMe().data;
  const updateMe = useUpdateMe();
  return (lang) => {
    setLang(lang);
    if (me && me.language !== lang) updateMe.mutate({ language: lang });
  };
}

/** Follow the profile's language whenever it changes (sign-in, another device, settings). */
export function useProfileLanguage(): void {
  const { setLang } = useI18n();
  const language = useMe().data?.language;
  const applied = useRef<Language | undefined>(undefined);
  useEffect(() => {
    if (!language || language === applied.current) return;
    applied.current = language;
    setLang(language);
  }, [language, setLang]);
}
