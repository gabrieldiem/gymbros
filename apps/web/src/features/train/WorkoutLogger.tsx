import { Flag, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { useMe } from '../../api/me';
import type { Catalog, Week, Workout } from '../../api/train';
import { CountUp } from '../../components/CountUp';
import { Button } from '../../components/Button';
import { FormError } from '../../components/FormError';
import { Sheet } from '../../components/Sheet';
import { useI18n } from '../../i18n/context';
import { formatDay } from '../../i18n/formatDay';
import { formatElapsed } from './format';
import { GymSelect } from './GymSelect';
import { RestTimer } from './RestTimer';
import { DEFAULT_REST_S, useRestTimer } from './useRestTimer';
import { useWorkoutDraft, type Draft } from './useWorkoutDraft';
import { WorkoutExercises } from './WorkoutExercises';
import { WorkoutPhoto } from './WorkoutPhoto';
import styles from './WorkoutLogger.module.css';

type Props = {
  workout: Workout;
  catalog: Catalog;
  week: Week | undefined;
  finishing: boolean;
  finishError: unknown;
  discarding: boolean;
  onFinish: (flush: () => Promise<void>, draft: Draft) => void;
  onDiscard: () => void;
};

function useElapsed(startedAt: string): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return formatElapsed(now - Date.parse(startedAt));
}

/** Shows "+N" next to the live points whenever the server's total goes up. */
function usePointsGain(points: number): { gain: number; key: number } {
  const previous = useRef(points);
  const [state, setState] = useState({ gain: 0, key: 0 });
  useEffect(() => {
    const gain = points - previous.current;
    previous.current = points;
    if (gain > 0) setState((s) => ({ gain, key: s.key + 1 }));
  }, [points]);
  return state;
}

function nthText(t: ReturnType<typeof useI18n>['t'], week: Week | undefined): string {
  if (!week) return '';
  const nth = week.workouts + 1;
  const tag = nth === week.target ? t('goal_tag') : nth > week.target ? t('over_tag') : '';
  return `, ${t('workout_n', { n: nth })}${tag}`;
}

export function WorkoutLogger(props: Props) {
  const { workout, catalog, week, finishing, finishError, discarding, onFinish, onDiscard } = props;
  const { t, n, lang } = useI18n();
  const past = workout.performed_on;
  const { draft, update, livePoints, status, flush } = useWorkoutDraft(workout);
  const elapsed = useElapsed(workout.started_at);
  const gain = usePointsGain(livePoints);
  const rest = useRestTimer();
  const restSeconds = useMe().data?.rest_seconds;
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const exerciseById = (id: string) => catalog.exercises.find((e) => e.id === id);
  const legEvent = week?.leg_event_active ?? catalog.weekly_event === 'leg_day_x2';
  const stretchOnly =
    draft.exercises.length > 0 &&
    draft.exercises.every((e) => exerciseById(e.exercise_id)?.type === 's');

  return (
    <section aria-labelledby="logger-title">
      <h1 id="logger-title" className="sr-only">
        {draft.name || t('wk_default')}
      </h1>
      <div className={styles.head}>
        <div className={styles.grow}>
          <input
            className={styles.name}
            value={draft.name}
            maxLength={60}
            aria-label={t('workout_name')}
            onChange={(e) => update((d) => ({ ...d, name: e.target.value }))}
          />
          <span className={styles.meta}>
            {past ? (
              t('past_for', { day: formatDay(lang, past) })
            ) : (
              <>
                <span role="timer">{elapsed}</span>
                {stretchOnly ? `, ${t('stretch_only')}` : nthText(t, week)}
              </>
            )}
          </span>
          <GymSelect value={draft.gym} onChange={(gym) => update((d) => ({ ...d, gym }))} />
        </div>
        <div className={styles.live} aria-live="polite">
          {gain.gain > 0 && (
            <span key={gain.key} className={styles.float} aria-hidden="true">
              +{n(gain.gain)}
            </span>
          )}
          {workout.local ? (
            <span className={styles.localPoints}>{t('offline_points')}</span>
          ) : (
            <>
              <b data-testid="live-points">
                <CountUp value={livePoints} format={n} durationMs={500} />
              </b>
              <span>{t('pts_so_far')}</span>
            </>
          )}
        </div>
      </div>

      <WorkoutExercises
        exercises={draft.exercises}
        onChange={(change) => update((d) => ({ ...d, exercises: change(d.exercises) }))}
        catalog={catalog}
        past={past !== null}
        legEvent={legEvent}
      />

      {!workout.local && <WorkoutPhoto workoutId={workout.id} url={workout.photo_url} />}

      <p className={styles.status} role="status">
        {status === 'saving' ? t('saving') : status === 'error' ? t('save_failed') : ''}
      </p>
      <FormError error={finishError} />
      <div className={styles.actions}>
        <Button icon={Flag} onClick={() => onFinish(flush, draft)} disabled={finishing}>
          {finishing ? t('finishing') : t('finish')}
        </Button>
        <Button icon={Trash2} variant="quiet" onClick={() => setConfirmDiscard(true)}>
          {t('discard')}
        </Button>
      </div>

      {!past && !stretchOnly && (
        <RestTimer
          rest={rest.rest}
          leftMs={rest.leftMs}
          defaultSeconds={restSeconds ?? DEFAULT_REST_S}
          onStart={() => rest.start(restSeconds)}
          onAdjust={rest.adjust}
          onSkip={rest.skip}
        />
      )}
      {confirmDiscard && (
        <Sheet title={t('discard_q')} onClose={() => setConfirmDiscard(false)}>
          <div className={styles.confirm}>
            <Button
              icon={Trash2}
              className={styles.danger}
              wide
              disabled={discarding}
              onClick={onDiscard}
            >
              {t('discard_yes')}
            </Button>
            <Button icon={X} variant="quiet" wide onClick={() => setConfirmDiscard(false)}>
              {t('cancel')}
            </Button>
          </div>
        </Sheet>
      )}
    </section>
  );
}
