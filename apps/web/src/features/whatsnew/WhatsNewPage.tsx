import { ArrowRight } from 'lucide-react';
import { useWhatsNew } from '../../api/whatsNew';
import { ButtonLink } from '../../components/Button';
import { QueryState } from '../../components/QueryState';
import { useI18n } from '../../i18n/context';
import { formatDay } from '../../i18n/formatDay';
import styles from './WhatsNew.module.css';
import { WHATS_NEW_COPY } from './whatsNewCopy';

/** Every feature members have been told about, newest first. */
export function WhatsNewPage() {
  const { t, lang } = useI18n();
  const query = useWhatsNew();
  return (
    <section aria-labelledby="page-title">
      <h1 id="page-title">{t('whats_new')}</h1>
      <p className={styles.sub}>{t('whats_new_sub')}</p>
      <QueryState query={query} failed="whats_new_failed">
        {(entries) => (
          <ul className={styles.list}>
            {entries.map((entry) => {
              const copy = WHATS_NEW_COPY[entry.id];
              if (!copy) return null; // An old copy of the app, about a feature it doesn't have.
              return (
                <li key={entry.id}>
                  <time dateTime={entry.date}>{formatDay(lang, entry.date)}</time>
                  <h2>{t(copy.title)}</h2>
                  <p>{t(copy.body)}</p>
                  <ButtonLink icon={ArrowRight} variant="ghost" to={entry.link}>
                    {t('whats_new_try')}
                  </ButtonLink>
                </li>
              );
            })}
          </ul>
        )}
      </QueryState>
    </section>
  );
}
