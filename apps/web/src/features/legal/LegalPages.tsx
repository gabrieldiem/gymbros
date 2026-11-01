import { Link } from 'react-router';

import { useI18n } from '../../i18n/context';
import type { MessageKey } from '../../i18n/en';
import styles from './LegalPages.module.css';

/** Where people write about their data. It has to be an address that really receives mail. */
const CONTACT_EMAIL = 'hola@contact.gabrieldiem.com';

type Section = { heading: MessageKey; body: MessageKey };
type Props = { title: MessageKey; intro: MessageKey; sections: Section[] };

const PRIVACY: Section[] = [
  { heading: 'privacy_collect_h', body: 'privacy_collect' },
  { heading: 'privacy_use_h', body: 'privacy_use' },
  { heading: 'privacy_who_h', body: 'privacy_who' },
  { heading: 'privacy_cookies_h', body: 'privacy_cookies' },
  { heading: 'privacy_keep_h', body: 'privacy_keep' },
  { heading: 'privacy_rights_h', body: 'privacy_rights' },
  { heading: 'privacy_kids_h', body: 'privacy_kids' },
  { heading: 'privacy_changes_h', body: 'privacy_changes' },
];

const TERMS: Section[] = [
  { heading: 'terms_service_h', body: 'terms_service' },
  { heading: 'terms_account_h', body: 'terms_account' },
  { heading: 'terms_safety_h', body: 'terms_safety' },
  { heading: 'terms_fair_h', body: 'terms_fair' },
  { heading: 'terms_content_h', body: 'terms_content' },
  { heading: 'terms_warranty_h', body: 'terms_warranty' },
  { heading: 'terms_changes_h', body: 'terms_changes' },
];

function LegalPage({ title, intro, sections }: Props) {
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
  return <LegalPage title="legal_privacy" intro="privacy_intro" sections={PRIVACY} />;
}

export function TermsPage() {
  return <LegalPage title="legal_terms" intro="terms_intro" sections={TERMS} />;
}
