import { Link, useLocation } from 'react-router';

import { useActiveWorkout } from '../api/train';
import { useI18n } from '../i18n/context';
import styles from './ActiveWorkoutBar.module.css';

/** "Back to your workout" while a workout is in progress and you're on another tab. */
export function ActiveWorkoutBar() {
  const { t, n } = useI18n();
  const { pathname } = useLocation();
  const workout = useActiveWorkout().data;
  if (!workout || pathname === '/train') return null;
  return (
    <Link to="/train" className={styles.bar}>
      <span className={styles.pulse} aria-hidden="true" />
      <span className={styles.grow}>
        <b>{workout.name}</b>
        <span>
          {n(workout.live_points)} {t('pts_so_far')}
        </span>
      </span>
      <span className={styles.cta}>{t('back_workout')}</span>
    </Link>
  );
}
