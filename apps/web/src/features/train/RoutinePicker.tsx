import {
  BicepsFlexed,
  CalendarDays,
  CalendarPlus,
  Dumbbell,
  Footprints,
  HeartPulse,
  PersonStanding,
  Plus,
  Waves,
  Weight,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router';
import type { Catalog, Week } from '../../api/train';
import { FormError } from '../../components/FormError';
import { Pips } from '../../components/Pips';
import { useI18n } from '../../i18n/context';
import { formatDay } from '../../i18n/formatDay';
import { goalText } from './goalText';
import { GymSelect } from './GymSelect';
import styles from './RoutinePicker.module.css';

type Props = {
  catalog: Catalog;
  week: Week | undefined;
  starting: boolean;
  error: unknown;
  /** The past day being logged, or null to log today. */
  pastDay: string | null;
  /** Where this workout is, while you haven't started it. */
  gym: string | null;
  onGym: (gym: string | null) => void;
  onStart: (routineId: string | null) => void;
  onPickPastDay: () => void;
  onClearPastDay: () => void;
};

/** The Train start screen: routines, the week's pips and how points are earned. */
const ROUTINE_ICONS: Record<string, LucideIcon> = {
  push: Dumbbell,
  pull: BicepsFlexed,
  legs: Weight,
  cardio: HeartPulse,
  run: Footprints,
  swim: Waves,
  stretch: PersonStanding,
};

export function RoutinePicker(props: Props) {
  const { catalog, week, starting, error, pastDay, gym, onGym } = props;
  const { onStart, onPickPastDay, onClearPastDay } = props;
  const { t, lang } = useI18n();
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
        <div className={styles.gym}>
          <GymSelect value={gym} onChange={onGym} />
        </div>
        {pastDay ? (
          <div className={styles.past}>
            <p>{t('past_notice', { day: formatDay(lang, pastDay) })}</p>
            <button type="button" onClick={onPickPastDay}>
              <CalendarDays size={16} aria-hidden="true" />
              {t('past_change')}
            </button>
            <button type="button" onClick={onClearPastDay}>
              {t('past_today')}
            </button>
          </div>
        ) : (
          Boolean(week?.past_days.length) && (
            <button type="button" className={styles.pastOpen} onClick={onPickPastDay}>
              <CalendarPlus size={16} aria-hidden="true" />
              {t('past_open')}
            </button>
          )
        )}
      </div>
      <div className={styles.error}>
        <FormError error={error} />
      </div>
      <div className={styles.routines}>
        {catalog.routines.map((routine) => {
          const RoutineIcon = ROUTINE_ICONS[routine.id] ?? Dumbbell;
          return (
            <button
              key={routine.id}
              type="button"
              className={styles.routine}
              disabled={starting}
              onClick={() => onStart(routine.id)}
            >
              <h3 className={styles.routineTitle}>
                <RoutineIcon size={20} aria-hidden="true" />
                {routine.name}
              </h3>
              <p>{routine.exercise_ids.map(exerciseName).join(', ')}</p>
              {legEvent && hasLegs(routine.exercise_ids) && (
                <span className={styles.tag}>{t('leg_event_tag')}</span>
              )}
            </button>
          );
        })}
        <button
          type="button"
          className={`${styles.routine} ${styles.empty}`}
          disabled={starting}
          onClick={() => onStart(null)}
        >
          <h3 className={styles.routineTitle}>
            <Plus size={20} aria-hidden="true" />
            {t('empty_title')}
          </h3>
          <p>{t('empty_sub')}</p>
        </button>
        <Link to="/climb/steps" className={`${styles.routine} ${styles.empty}`}>
          <h3 className={styles.routineTitle}>
            <Footprints size={20} aria-hidden="true" />
            {t('steps_title')}
          </h3>
          <p>{t('steps_card')}</p>
        </Link>
      </div>
      <EarnList catalog={catalog} legEvent={legEvent} />
    </section>
  );
}

function EarnList({ catalog, legEvent }: { catalog: Catalog; legEvent: boolean }) {
  const { t, n } = useI18n();
  const p = catalog.points;
  const swimFactor = catalog.exercises.find((e) => e.id === 'swim')?.km_factor ?? 1;
  const rows: [string, string][] = [
    [t('e_log'), n(p.showed_up)],
    [t('e_set'), n(p.completed_set)],
    [t('e_goal', { n: p.weekly_target }), n(p.weekly_goal)],
    [t('e_over', { n: p.weekly_target }), `+${n(p.over_target)}`],
    [t('e_streak'), t('up_to', { per: p.goal_streak_per_week, max: p.goal_streak_max })],
    [t('e_better'), `+${n(p.better_than_last_time)}`],
    [t('e_stretch'), `+${n(p.stretching)}`],
    [t('e_steps', { n: n(p.steps_per_point), cap: n(p.steps_daily_cap) }), '1'],
    [t('e_pr'), n(p.pr)],
    [t('e_vol', { kg: p.volume_kg_per_point }), '1'],
    [t('e_cardio'), n(p.cardio_minute)],
    [t('e_distance', { n: swimFactor }), n(p.cardio_effort_km)],
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
