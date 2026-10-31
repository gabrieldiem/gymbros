import type { Standing } from '../../api/climb';
import { Avatar } from '../../components/Avatar';
import { cx } from '../../components/cx';
import { Pips } from '../../components/Pips';
import { useI18n } from '../../i18n/context';
import type { MessageKey } from '../../i18n/en';
import styles from './RopeOrder.module.css';

/** The ranked list under the map: position, avatar, pips, status and points. */
export function RopeOrder({ standings, target }: { standings: Standing[]; target: number }) {
  const { t, n } = useI18n();
  return (
    <section aria-labelledby="rope-title">
      <h2 id="rope-title">{t('rope_order')}</h2>
      <ol className={styles.rope}>
        {standings.map((s, i) => (
          <li
            key={s.user_id}
            className={cx(styles.item, i === 0 && styles.first, s.is_me && styles.me)}
          >
            <span className={styles.rk}>{s.position}</span>
            <span className={styles.avatar}>
              <Avatar initials={s.initials} color={s.color} size={40} />
            </span>
            <span className={styles.who}>
              <b>{s.is_me ? `${s.display_name} (${t('you')})` : s.display_name}</b>
              <span>
                <Pips done={s.workouts_this_week} target={target} />
                {s.training_now ? (
                  <span className={styles.live}>{t('training_now')}</span>
                ) : (
                  <span>{t(`rank_${s.camp}` as MessageKey)}</span>
                )}
              </span>
            </span>
            <span className={styles.p}>{n(s.points)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
