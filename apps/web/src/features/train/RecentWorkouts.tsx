import { RotateCcw } from 'lucide-react';

import type { Catalog, RecentWorkout } from '../../api/train';
import { useI18n } from '../../i18n/context';
import { formatDay } from '../../i18n/formatDay';
import styles from './RoutinePicker.module.css';

type Props = {
  recent: RecentWorkout[];
  catalog: Catalog;
  starting: boolean;
  onRepeat: (workout: RecentWorkout) => void;
};

/** A moment's calendar day on this device ("2026-11-21"), for formatDay. */
const localDay = (moment: string) => new Date(moment).toLocaleDateString('en-CA');

/** Your last few workouts, each a tap away from starting again. */
export function RecentWorkouts({ recent, catalog, starting, onRepeat }: Props) {
  const { t, lang } = useI18n();
  if (recent.length === 0) return null;
  const names = (workout: RecentWorkout) => {
    const custom = [...workout.custom_names];
    return workout.exercise_ids
      .map((id) =>
        id === 'custom' ? custom.shift() : catalog.exercises.find((e) => e.id === id)?.name,
      )
      .filter(Boolean)
      .join(', ');
  };
  return (
    <section className={styles.recent} aria-labelledby="recent-title">
      <h2 id="recent-title">{t('repeat_title')}</h2>
      <ul>
        {recent.slice(0, 3).map((workout) => {
          const day = formatDay(lang, workout.performed_on ?? localDay(workout.finished_at));
          const meta = `${day} · ${names(workout)}`;
          return (
            <li key={workout.id}>
              <button type="button" disabled={starting} onClick={() => onRepeat(workout)}>
                <RotateCcw size={18} aria-hidden="true" />
                <span>
                  {/* Heard first, so the name starts with what the button does. */}
                  <span className="sr-only">{t('repeat_verb')}</span> <b>{workout.name}</b>{' '}
                  <small>{meta}</small>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
