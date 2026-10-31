import { useI18n } from '../i18n/context';
import type { MessageKey } from '../i18n/en';
import styles from './PlaceholderPage.module.css';

type Props = { title: MessageKey; sub: MessageKey };

/** Empty tab page used until the tab's feature is ported from the prototype. */
export function PlaceholderPage({ title, sub }: Props) {
  const { t } = useI18n();
  return (
    <section className={styles.page} aria-labelledby="page-title">
      <h1 id="page-title">{t(title)}</h1>
      <p className={styles.sub}>{t(sub)}</p>
      <p className={styles.card}>{t('coming_soon')}</p>
    </section>
  );
}
