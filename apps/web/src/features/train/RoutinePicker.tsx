import type { Catalog, Week } from '../../api/train';
import { FormError } from '../../components/FormError';
import { Pips } from '../../components/Pips';
import { useI18n } from '../../i18n/context';
import { goalText } from './goalText';
import styles from './RoutinePicker.module.css';

type Props = {
  catalog: Catalog;
  week: Week | undefined;
  starting: boolean;
  error: unknown;
  onStart: (routineId: string | null) => void;
};

/** The Train start screen: routines, the week's pips and how points are earned. */
export function RoutinePicker({ catalog, week, starting, error, onStart }: Props) {
  const { t } = useI18n();
  const legEvent = week?.leg_event_active ?? catalog.weekly_event === 'leg_day_x2';
  const exerciseName = (id: string) => catalog.exercises.find((e) => e.id === id)?.name ?? id;
  const hasLegs = (ids: string[]) =>
    ids.some((id) => catalog.exercises.find((e) => e.id === id)?.group === 'Legs');

  return (
    <section aria-labelledby="page-title">
      <div className={styles.head}>
        <h1 id="page-title">{t('train_title')}</h1>
        <p className={styles.sub}>{t('train_sub')}</p>
        {week && (
          <p className={styles.goal}>
            <Pips done={week.workouts} target={week.target} large />
            <span>{goalText(t, week.workouts, week.target)}</span>
          </p>
        )}
      </div>
      <div className={styles.error}>
        <FormError error={error} />
      </div>
      <div className={styles.routines}>
        {catalog.routines.map((routine) => (
          <button
            key={routine.id}
            type="button"
            className={styles.routine}
            disabled={starting}
            onClick={() => onStart(routine.id)}
          >
            <h3>{routine.name}</h3>
            <p>{routine.exercise_ids.map(exerciseName).join(', ')}</p>
            {legEvent && hasLegs(routine.exercise_ids) && (
              <span className={styles.tag}>{t('leg_event_tag', { w: t('leg_event_name') })}</span>
            )}
          </button>
        ))}
        <button
          type="button"
          className={`${styles.routine} ${styles.empty}`}
          disabled={starting}
          onClick={() => onStart(null)}
        >
          <h3>{t('empty_title')}</h3>
          <p>{t('empty_sub')}</p>
        </button>
      </div>
      <EarnList catalog={catalog} legEvent={legEvent} />
    </section>
  );
}

function EarnList({ catalog, legEvent }: { catalog: Catalog; legEvent: boolean }) {
  const { t, n } = useI18n();
  const p = catalog.points;
  const rows: [string, string][] = [
    [t('e_log'), n(p.showed_up)],
    [t('e_set'), n(p.completed_set)],
    [t('e_goal', { n: p.weekly_target }), n(p.weekly_goal)],
    [t('e_over', { n: p.weekly_target }), `+${n(p.over_target)}`],
    [t('e_streak'), t('up_to', { per: p.goal_streak_per_week, max: p.goal_streak_max })],
    [t('e_better'), `+${n(p.better_than_last_time)}`],
    [t('e_pr'), n(p.pr)],
    [t('e_vol', { kg: p.volume_kg_per_point }), '1'],
    [t('e_cardio'), n(p.cardio_minute)],
  ];
  if (legEvent) rows.push([t('e_leg', { w: t('leg_event_name') }), `+${n(p.leg_event_set_bonus)}`]);
  return (
    <>
      <h2>{t('earn_title')}</h2>
      <ul className={styles.earn}>
        {rows.map(([label, value]) => (
          <li key={label}>
            <span>{label}</span>
            <b>{value}</b>
          </li>
        ))}
      </ul>
    </>
  );
}
