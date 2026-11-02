import { MapPin } from 'lucide-react';
import { useWorkoutDetail } from '../../api/compete';
import { useCatalog } from '../../api/train';
import { QueryState } from '../../components/QueryState';
import { Sheet } from '../../components/Sheet';
import { useI18n } from '../../i18n/context';
import { formatDay, formatMoment } from '../../i18n/formatDay';
import { formatPostedSet } from '../crew/format';
import { lineItemText } from '../train/format';
import { WorkoutPhoto } from '../train/WorkoutPhoto';
import styles from './WorkoutDetail.module.css';

type Props = { workoutId: string; title: string; onClose: () => void };

/** One of your finished workouts: what you did and what it paid. */
export function WorkoutDetailSheet({ workoutId, title, onClose }: Props) {
  const { t, n, lang } = useI18n();
  const query = useWorkoutDetail(workoutId);
  const exercises = useCatalog().data?.exercises ?? [];
  const exercise = (id: string) => exercises.find((e) => e.id === id);

  return (
    <Sheet title={title} onClose={onClose}>
      <QueryState query={query} failed="workout_detail_failed">
        {(workout) => (
          <>
            <p className={styles.when}>
              {workout.performed_on
                ? t('past_for', { day: formatDay(lang, workout.performed_on) })
                : formatMoment(lang, workout.finished_at)}
            </p>
            <div className={styles.chips}>
              {workout.gym && (
                <span>
                  <MapPin size={13} aria-hidden="true" />
                  {t('at_gym', { gym: workout.gym })}
                </span>
              )}
              {workout.duration_min > 0 && <span>{t('min_n', { n: workout.duration_min })}</span>}
              <span>{workout.sets === 1 ? t('sets_1') : t('sets_n', { n: workout.sets })}</span>
              {workout.volume_kg > 0 && <span>{t('kg_n', { n: n(workout.volume_kg) })}</span>}
            </div>
            <WorkoutPhoto workoutId={workout.id} url={workout.photo_url} />
            {workout.exercises.length > 0 && (
              <>
                <h3>{t('detail_exercises')}</h3>
                <ul className={styles.rows}>
                  {workout.exercises.map((e, i) => (
                    <li key={`${e.exercise_id}-${i}`}>
                      <span>{exercise(e.exercise_id)?.name ?? e.exercise_id}</span>
                      <span className={styles.sets}>
                        {e.sets
                          .map((s) => formatPostedSet(exercise(e.exercise_id), s, n, t))
                          .join(', ')}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <h3>{t('detail_points')}</h3>
            <ul className={styles.rows}>
              {workout.line_items.map((item, i) => (
                <li key={`${item.key}-${i}`}>
                  <span>{lineItemText(item, exercises, t, n)}</span>
                  <b>+{n(item.points)}</b>
                </li>
              ))}
              <li className={styles.total}>
                <span>{t('detail_total')}</span>
                <b>+{n(workout.points)}</b>
              </li>
            </ul>
          </>
        )}
      </QueryState>
    </Sheet>
  );
}
