import type { FeedItem } from '../../api/social';
import { Avatar } from '../../components/Avatar';
import { useI18n } from '../../i18n/context';
import type { MessageKey } from '../../i18n/en';
import { timeAgo } from '../../i18n/timeAgo';
import styles from './Feed.module.css';

/** A one-line event: rank-up or badge. */
export function EventRow({ item }: { item: FeedItem }) {
  const { t, lang } = useI18n();
  const text =
    item.kind === 'rank_up'
      ? t('ev_rank', { rank: t(`rank_${Number(item.vars.camp)}` as MessageKey) })
      : t('ev_badge_named', { b: t(`badge_${String(item.vars.badge)}` as MessageKey) });
  return (
    <li className={styles.event}>
      <Avatar initials={item.actor.initials} color={item.actor.color} size={38} />
      <p>
        <b>{item.is_mine ? t('you') : item.actor.display_name}</b> {text}{' '}
        <span className={styles.muted}>{timeAgo(lang, item.created_at)}</span>
      </p>
    </li>
  );
}
