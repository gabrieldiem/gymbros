import { useI18n } from '../i18n/context';
import { LANGUAGES } from '../i18n/translate';
import { useChangeLanguage } from '../i18n/useLanguage';
import styles from './LanguageToggle.module.css';

export function LanguageToggle() {
  const { lang, t } = useI18n();
  const changeLanguage = useChangeLanguage();
  return (
    <div className={styles.toggle} role="group" aria-label={t('language')}>
      {LANGUAGES.map((code) => (
        <button
          key={code}
          type="button"
          aria-pressed={lang === code}
          onClick={() => changeLanguage(code)}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
