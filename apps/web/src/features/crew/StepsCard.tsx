import { Footprints } from 'lucide-react';

import type { FeedItem, StepsPostVars } from '../../api/social';
import { Avatar } from '../../components/Avatar';
import { cx } from '../../components/cx';
import { useI18n } from '../../i18n/context';
import { formatDay } from '../../i18n/formatDay';
import { timeAgo } from '../../i18n/timeAgo';
import styles from './Feed.module.css';
import { PostActions } from './PostActions';

/** Steps someone logged, for a day or a period. */
export function StepsCard({ item }: { item: FeedItem }) {
  const { t, n, lang } = useI18n();
  const v = item.vars as unknown as StepsPostVars;
  return (
    <li className={cx(styles.post, item.is_mine && styles.mine)}>
      <div className={styles.top}>
        <Avatar
          initials={item.actor.initials}
          color={item.actor.color}
          image={item.actor.avatar_url}
          size={42}
        />
        <div className={styles.who}>
          <b>{item.is_mine ? t('you') : item.actor.display_name}</b>
          <span>{timeAgo(lang, item.created_at)}</span>
        </div>
        {v.points > 0 && <span className={styles.pts}>+{n(v.points)}</span>}
      </div>
      <h3 className={styles.stepsTitle}>
        <Footprints size={20} aria-hidden="true" />
        {t('steps_n', { n: n(v.steps) })}
      </h3>
      <div className={styles.chips}>
        <span>
          {v.days === 1
            ? formatDay(lang, v.start_date)
            : t('steps_period', {
                from: formatDay(lang, v.start_date),
                to: formatDay(lang, v.end_date),
                n: v.days,
              })}
        </span>
      </div>
      <PostActions item={item} />
    </li>
  );
}
