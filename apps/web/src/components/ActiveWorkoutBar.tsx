import { Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router';

import { useActiveWorkout, useDiscardWorkout } from '../api/train';
import { useI18n } from '../i18n/context';
import styles from './ActiveWorkoutBar.module.css';
import { Button } from './Button';
import { FormError } from './FormError';
import { Sheet } from './Sheet';

/** "Back to your workout" while a workout is in progress and you're on another tab. */
export function ActiveWorkoutBar() {
  const { t, n } = useI18n();
  const { pathname } = useLocation();
  const workout = useActiveWorkout().data;
  const discard = useDiscardWorkout();
  const [confirming, setConfirming] = useState(false);
  if (!workout || pathname === '/train') return null;
  return (
    <div className={styles.bar}>
      <Link to="/train" className={styles.back}>
        {!workout.performed_on && <span className={styles.pulse} aria-hidden="true" />}
        <span className={styles.grow}>
          <b>{workout.name}</b>
          <span>
            {n(workout.live_points)} {t('pts_so_far')}
          </span>
        </span>
        <span className={styles.cta}>{t('back_workout')}</span>
      </Link>
      <button
        type="button"
        className={styles.cancel}
        aria-label={t('cancel_workout')}
        title={t('cancel_workout')}
        onClick={() => setConfirming(true)}
      >
        <X size={18} aria-hidden="true" />
      </button>
      {confirming && (
        <Sheet title={t('discard_q')} onClose={() => setConfirming(false)}>
          <div className={styles.confirm}>
            <FormError error={discard.error} />
            <Button
              icon={Trash2}
              className={styles.danger}
              wide
              disabled={discard.isPending}
              onClick={() => discard.mutate(workout.id, { onSuccess: () => setConfirming(false) })}
            >
              {t('discard_yes')}
            </Button>
            <Button icon={X} variant="quiet" wide onClick={() => setConfirming(false)}>
              {t('cancel')}
            </Button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
