import { Link } from 'react-router';

import { useI18n } from '../../i18n/context';
import styles from './LegalPages.module.css';
import { CONTACT_EMAIL, PRIVACY_PAGE, TERMS_PAGE, type LegalContent } from './legalContent';

function LegalPage({ title, intro, sections }: LegalContent) {
  const { t } = useI18n();
  return (
    <article className={styles.page} aria-labelledby="page-title">
      <h1 id="page-title">{t(title)}</h1>
      <p className={styles.updated}>{t('legal_updated')}</p>
      <p>{t(intro)}</p>
      {sections.map(({ heading, body }) => (
        <section key={heading}>
          <h2>{t(heading)}</h2>
          <p>{t(body, { email: CONTACT_EMAIL })}</p>
        </section>
      ))}
      <Link className={styles.back} to="/">
        {t('legal_back')}
      </Link>
    </article>
  );
}

export function PrivacyPage() {
  return <LegalPage {...PRIVACY_PAGE} />;
}

export function TermsPage() {
  return <LegalPage {...TERMS_PAGE} />;
}
