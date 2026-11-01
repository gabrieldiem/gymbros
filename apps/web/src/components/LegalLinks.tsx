import { Link } from 'react-router';

import { useI18n } from '../i18n/context';
import styles from './LegalLinks.module.css';

/** The terms and privacy links shown wherever someone can sign in. */
export function LegalLinks() {
  const { t } = useI18n();
  return (
    <p className={styles.links}>
      <span>{t('legal_notice')}</span>
      <Link to="/terms">{t('legal_terms')}</Link>
      <Link to="/privacy">{t('legal_privacy')}</Link>
    </p>
  );
}
