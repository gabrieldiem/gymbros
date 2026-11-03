import type { Rules, SampleSession } from '../../api/rules';
import { BadgePatch } from '../../components/BadgePatch';
import { cx } from '../../components/cx';
import { useReveal } from '../../components/useReveal';
import { useI18n } from '../../i18n/context';
import type { MessageKey } from '../../i18n/en';
import styles from './LandingPage.module.css';

const SPORT_NAME: Record<SampleSession['id'], MessageKey> = {
  lift: 'landing_sport_lift',
  run: 'landing_sport_run',
  swim: 'landing_sport_swim',
};

function sessionDetail(
  session: SampleSession,
  t: ReturnType<typeof useI18n>['t'],
  n: (v: number) => string,
) {
  if (session.tonnes !== null) {
    const sets = Number(session.line_items.find((i) => i.key === 'ln_sets')?.vars.n ?? 0);
    return t('landing_lift_detail', { t: n(session.tonnes), sets });
  }
  return t('unit_km', { n: n(session.km ?? 0) });
}

/** One hour of each sport, scored by the server. The bars make the point before the numbers do. */
export function SportsCompare({
  sessions,
  embedded = false,
}: {
  sessions: SampleSession[];
  embedded?: boolean;
}) {
  const { t, n } = useI18n();
  const reveal = useReveal<HTMLElement>();
  const max = Math.max(...sessions.map((s) => s.total), 1);
  return (
    <section
      ref={reveal}
      id="sports"
      className={cx(styles.section, embedded && styles.embedded)}
      aria-labelledby="sports-title"
    >
      <h2 id="sports-title" className={styles.sectionTitle}>
        {t('landing_equal_title')}
      </h2>
      <p className={styles.sectionSub}>{t('landing_equal_sub')}</p>
      <ul className={styles.sports}>
        {sessions.map((session) => (
          <li key={session.id}>
            <h3>{t(SPORT_NAME[session.id])}</h3>
            <p className={styles.muted}>
              {t('unit_min', { n: session.minutes })}, {sessionDetail(session, t, n)}
            </p>
            <div className={styles.sportBar} aria-hidden="true">
              <i style={{ width: `${(session.total / max) * 100}%` }} />
            </div>
            <b className={styles.sportTotal}>{t('pts_n', { n: n(session.total) })}</b>
          </li>
        ))}
      </ul>
    </section>
  );
}

type Row = [label: string, value: string];

function RowGroup({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <div className={styles.group}>
      <h3>{title}</h3>
      <ul>
        {rows.map(([label, value]) => (
          <li key={label}>
            <span>{label}</span>
            <b>{value}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Every task and what it pays. All numbers come from the API. */
export function PointsList({ rules, embedded = false }: { rules: Rules; embedded?: boolean }) {
  const { t, n } = useI18n();
  const reveal = useReveal<HTMLElement>();
  const p = rules.points;
  const plus = (value: number) => `+${n(value)}`;
  return (
    <section
      ref={reveal}
      id="points"
      className={cx(styles.section, embedded && styles.embedded)}
      aria-labelledby="points-title"
    >
      <h2 id="points-title" className={embedded ? 'sr-only' : styles.sectionTitle}>
        {t('landing_points_title')}
      </h2>
      {!embedded && <p className={styles.sectionSub}>{t('landing_points_sub')}</p>}
      <div className={styles.groups}>
        <RowGroup
          title={t('landing_group_workout')}
          rows={[
            [t('e_log'), plus(p.showed_up)],
            [t('e_set'), plus(p.completed_set)],
            [t('e_vol', { kg: p.volume_kg_per_point }), plus(1)],
            [t('e_cardio'), plus(p.cardio_minute)],
            [t('e_distance', { n: rules.swim_km_factor }), plus(p.cardio_effort_km)],
          ]}
        />
        <RowGroup
          title={t('landing_group_self')}
          rows={[
            [t('e_pr'), plus(p.pr)],
            [t('e_better'), plus(p.better_than_last_time)],
            [t('e_stretch'), plus(p.stretching)],
            [t('e_steps', { n: n(p.steps_per_point), cap: n(p.steps_daily_cap) }), plus(1)],
            [t('e_goal', { n: p.weekly_target }), plus(p.weekly_goal)],
            [t('e_over', { n: p.weekly_target }), plus(p.over_target)],
            [t('e_streak'), t('up_to', { per: p.goal_streak_per_week, max: p.goal_streak_max })],
          ]}
        />
        <RowGroup
          title={t('weekly_quests')}
          rows={rules.quests.map((quest) => [
            t(`quest_${quest.id}` as MessageKey),
            plus(quest.bonus),
          ])}
        />
        <RowGroup
          title={t('landing_group_crew')}
          rows={[
            [t('landing_crew_quest', { n: n(rules.crew_quest_goal) }), plus(rules.crew_quest)],
            [t('landing_bounty'), plus(rules.bounty)],
            [t('landing_duel'), plus(rules.duel_win)],
          ]}
        />
      </div>
    </section>
  );
}

/** Every achievement, what it takes and what it pays. */
export function AchievementList({ rules }: { rules: Rules }) {
  const { t, n } = useI18n();
  const reveal = useReveal<HTMLElement>();
  return (
    <section
      ref={reveal}
      id="achievements"
      className={styles.section}
      aria-labelledby="achievements-title"
    >
      <h2 id="achievements-title" className={styles.sectionTitle}>
        {t('landing_badges_title', { n: rules.badges.length })}
      </h2>
      <p className={styles.sectionSub}>{t('landing_badges_sub')}</p>
      <ul className={styles.badges}>
        {rules.badges.map((badge) => (
          <li key={badge.id}>
            <span className={styles.patch}>
              <BadgePatch icon={badge.icon} color={badge.color} locked={false} size={64} />
            </span>
            <span>
              <b>{t(`badge_${badge.id}` as MessageKey)}</b>
              <small>{t(`badge_${badge.id}_d` as MessageKey)}</small>
            </span>
            <b className={styles.badgePoints}>+{n(badge.points)}</b>
          </li>
        ))}
      </ul>
    </section>
  );
}
