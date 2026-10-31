import { useI18n } from '../i18n/context';
import { LANGUAGES } from '../i18n/translate';
import styles from './LanguageToggle.module.css';

export function LanguageToggle() {
  const { lang, setLang, t } = useI18n();
  return (
    <div className={styles.toggle} role="group" aria-label={t('language')}>
      {LANGUAGES.map((code) => (
        <button key={code} type="button" aria-pressed={lang === code} onClick={() => setLang(code)}>
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
