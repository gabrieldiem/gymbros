import { useEffect, useRef, useState } from 'react';

import { useMe } from '../../api/me';
import type { Catalog, SetData, Week, Workout } from '../../api/train';
import { Button } from '../../components/Button';
import { FormError } from '../../components/FormError';
import { Sheet } from '../../components/Sheet';
import { useI18n } from '../../i18n/context';
import { ExerciseCard } from './ExerciseCard';
import { ExercisePicker } from './ExercisePicker';
import { formatElapsed } from './format';
import { PlateCalculator } from './PlateCalculator';
import { RestTimer } from './RestTimer';
import { useRestTimer } from './useRestTimer';
import { useWorkoutDraft } from './useWorkoutDraft';
import styles from './WorkoutLogger.module.css';

type Props = {
  workout: Workout;
  catalog: Catalog;
  week: Week | undefined;
  finishing: boolean;
  finishError: unknown;
  discarding: boolean;
  onFinish: (flush: () => Promise<void>) => void;
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
  const { t, n } = useI18n();
  const { draft, update, livePoints, status, flush } = useWorkoutDraft(workout);
  const elapsed = useElapsed(workout.started_at);
  const gain = usePointsGain(livePoints);
  const rest = useRestTimer();
  const restSeconds = useMe().data?.rest_seconds;
  const [picking, setPicking] = useState(false);
  const [platesKg, setPlatesKg] = useState<number | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const exerciseById = (id: string) => catalog.exercises.find((e) => e.id === id);

  const setSets = (index: number, sets: SetData[]) =>
    update((d) => ({
      ...d,
      exercises: d.exercises.map((e, i) => (i === index ? { ...e, sets } : e)),
    }));
  const removeExercise = (index: number) =>
    update((d) => ({ ...d, exercises: d.exercises.filter((_, i) => i !== index) }));
  const addExercise = (id: string) => {
    const cardio = exerciseById(id)?.type === 'c';
    const empty: SetData = { load_kg: null, reps: null, minutes: null, km: null, done: false };
    const sets = Array.from({ length: cardio ? 1 : 3 }, () => ({ ...empty }));
    update((d) => ({
      ...d,
      exercises: [...d.exercises, { exercise_id: id, sets, previous_sets: [] }],
    }));
    setPicking(false);
  };

  return (
    <section aria-label={draft.name}>
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
            <span role="timer">{elapsed}</span>
            {nthText(t, week)}
          </span>
        </div>
        <div className={styles.live} aria-live="polite">
          {gain.gain > 0 && (
            <span key={gain.key} className={styles.float} aria-hidden="true">
              +{n(gain.gain)}
            </span>
          )}
          <b data-testid="live-points">{n(livePoints)}</b>
          <span>{t('pts_so_far')}</span>
        </div>
      </div>

      {draft.exercises.map((entry, i) => {
        const exercise = exerciseById(entry.exercise_id);
        if (!exercise) return null;
        return (
          <ExerciseCard
            key={`${entry.exercise_id}-${i}`}
            exercise={exercise}
            entry={entry}
            onChange={(sets) => setSets(i, sets)}
            onRemove={() => removeExercise(i)}
            onSetDone={() => rest.start(restSeconds)}
            onPlates={setPlatesKg}
          />
        );
      })}
      {draft.exercises.length === 0 && <p className={styles.empty}>{t('no_ex')}</p>}
      <Button variant="ghost" wide className={styles.add} onClick={() => setPicking(true)}>
        + {t('add_ex')}
      </Button>

      <p className={styles.status} role="status">
        {status === 'saving' ? t('saving') : status === 'error' ? t('save_failed') : ''}
      </p>
      <FormError error={finishError} />
      <div className={styles.actions}>
        <Button onClick={() => onFinish(flush)} disabled={finishing}>
          {finishing ? t('finishing') : t('finish')}
        </Button>
        <Button variant="quiet" onClick={() => setConfirmDiscard(true)}>
          {t('discard')}
        </Button>
      </div>

      <RestTimer rest={rest.rest} leftMs={rest.leftMs} onAdjust={rest.adjust} onSkip={rest.skip} />
      {picking && (
        <ExercisePicker
          exercises={catalog.exercises}
          onPick={addExercise}
          onClose={() => setPicking(false)}
        />
      )}
      {platesKg !== null && (
        <PlateCalculator initialKg={platesKg} onClose={() => setPlatesKg(null)} />
      )}
      {confirmDiscard && (
        <Sheet title={t('discard_q')} onClose={() => setConfirmDiscard(false)}>
          <div className={styles.confirm}>
            <Button className={styles.danger} wide disabled={discarding} onClick={onDiscard}>
              {t('discard_yes')}
            </Button>
            <Button variant="quiet" wide onClick={() => setConfirmDiscard(false)}>
              {t('cancel')}
            </Button>
          </div>
        </Sheet>
      )}
    </section>
  );
}
