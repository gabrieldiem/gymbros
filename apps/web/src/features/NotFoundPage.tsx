import { Link } from 'react-router';

import { useI18n } from '../i18n/context';

export function NotFoundPage() {
  const { t } = useI18n();
  return (
    <section aria-labelledby="page-title">
      <h1 id="page-title">{t('not_found_title')}</h1>
      <p>{t('not_found_body')}</p>
      <p>
        <Link to="/climb">{t('not_found_cta')}</Link>
      </p>
    </section>
  );
}
