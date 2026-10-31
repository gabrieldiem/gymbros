import type { QuestBoard } from '../../api/compete';
import { Avatar } from '../../components/Avatar';
import { useI18n } from '../../i18n/context';
import styles from './Quests.module.css';

const COLOR_VARS: Record<string, string> = {
  volt: 'var(--crew-volt)',
  red: 'var(--crew-red)',
  cyan: 'var(--crew-cyan)',
  pink: 'var(--crew-pink)',
  violet: 'var(--crew-violet)',
};

/**
 * The crew quest as one segmented bar (each member's share of the goal) with a legend.
 * Segments are split by 2px gaps; identity also comes from the legend (avatar + name + points),
 * never from colour alone (the crew palette's pink/violet pair is close for deutan vision).
 */
export function CrewQuest({ crew }: { crew: QuestBoard['crew_quest'] }) {
  const { t, n } = useI18n();
  const scale = Math.max(crew.goal, crew.total);
  const status =
    crew.claimed || crew.total >= crew.goal
      ? t('crew_done')
      : t('to_go', { n: n(crew.goal - crew.total) });
  return (
    <section className={`${styles.panel} ${styles.crew}`} aria-labelledby="crew-quest-title">
      <h2 id="crew-quest-title">{t('crew_quest_title', { n: n(crew.goal) })}</h2>
      <p className={styles.muted}>
        {t('crew_quest_body', { b: crew.bonus })} {status}
      </p>
      <div className={styles.stack} role="img" aria-label={`${n(crew.total)} / ${n(crew.goal)}`}>
        {crew.shares
          .filter((s) => s.points > 0)
          .map((s) => (
            <i
              key={s.member.user_id}
              title={`${s.member.display_name}: ${n(s.points)}`}
              style={{
                ['--c' as string]: COLOR_VARS[s.member.color],
                width: `${(s.points / scale) * 100}%`,
              }}
            />
          ))}
      </div>
      <ul className={styles.legend}>
        {crew.shares.map((s) => (
          <li key={s.member.user_id}>
            <span
              className={styles.swatch}
              style={{ ['--c' as string]: COLOR_VARS[s.member.color] }}
              aria-hidden="true"
            />
            <Avatar initials={s.member.initials} color={s.member.color} size={20} />
            {s.member.display_name} {n(s.points)}
          </li>
        ))}
      </ul>
    </section>
  );
}
