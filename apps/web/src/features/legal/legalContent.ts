import type { MessageKey } from '../../i18n/en';

/** Where people write about their data. It has to be an address that really receives mail. */
export const CONTACT_EMAIL = 'hola@contact.gabrieldiem.com';

type Section = { heading: MessageKey; body: MessageKey };
export type LegalContent = { title: MessageKey; intro: MessageKey; sections: Section[] };

export const PRIVACY_PAGE: LegalContent = {
  title: 'legal_privacy',
  intro: 'privacy_intro',
  sections: [
    { heading: 'privacy_collect_h', body: 'privacy_collect' },
    { heading: 'privacy_google_h', body: 'privacy_google' },
    { heading: 'privacy_use_h', body: 'privacy_use' },
    { heading: 'privacy_who_h', body: 'privacy_who' },
    { heading: 'privacy_cookies_h', body: 'privacy_cookies' },
    { heading: 'privacy_keep_h', body: 'privacy_keep' },
    { heading: 'privacy_rights_h', body: 'privacy_rights' },
    { heading: 'privacy_kids_h', body: 'privacy_kids' },
    { heading: 'privacy_changes_h', body: 'privacy_changes' },
  ],
};

export const TERMS_PAGE: LegalContent = {
  title: 'legal_terms',
  intro: 'terms_intro',
  sections: [
    { heading: 'terms_service_h', body: 'terms_service' },
    { heading: 'terms_account_h', body: 'terms_account' },
    { heading: 'terms_safety_h', body: 'terms_safety' },
    { heading: 'terms_fair_h', body: 'terms_fair' },
    { heading: 'terms_content_h', body: 'terms_content' },
    { heading: 'terms_warranty_h', body: 'terms_warranty' },
    { heading: 'terms_changes_h', body: 'terms_changes' },
  ],
};
