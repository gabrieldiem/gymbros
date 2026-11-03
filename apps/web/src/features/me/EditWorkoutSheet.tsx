import { Check, X } from 'lucide-react';
import { useState } from 'react';

import type { WorkoutDetail } from '../../api/compete';
import { useCatalog, useEditWorkout, type SetData } from '../../api/train';
import { Button } from '../../components/Button';
import { FormError } from '../../components/FormError';
import { LoadingBlock } from '../../components/QueryState';
import { Sheet } from '../../components/Sheet';
import { TextField } from '../../components/TextField';
import { useI18n } from '../../i18n/context';
import { forServer } from '../train/barbell';
import { GymSelect } from '../train/GymSelect';
import type { Draft } from '../train/useWorkoutDraft';
import { WorkoutExercises } from '../train/WorkoutExercises';
import styles from './WorkoutDetail.module.css';

type Props = { workout: WorkoutDetail; onClose: () => void };

function toDraft(workout: WorkoutDetail): Draft {
  return {
    name: workout.name,
    gym: workout.gym,
    exercises: workout.exercises.map((e) => ({
      exercise_id: e.exercise_id,
      // They're what you logged, not suggestions.
      sets: e.sets.map((s): SetData => ({ ...s, done: true, started: true })),
      previous_sets: [],
    })),
  };
}

/** The same cards as the logger, but nothing is saved until you say so. */
export function EditWorkoutSheet({ workout, onClose }: Props) {
  const { t } = useI18n();
  const catalog = useCatalog().data;
  const edit = useEditWorkout(workout.id);
  const [draft, setDraft] = useState(() => toDraft(workout));

  const handleSave = () => {
    const exercises = draft.exercises.map(({ exercise_id, sets }) => ({
      exercise_id,
      sets: forServer(sets),
    }));
    const name = draft.name.trim();
    edit.mutate(name ? { name, gym: draft.gym, exercises } : { gym: draft.gym, exercises }, {
      onSuccess: onClose,
    });
  };

  return (
    <Sheet title={t('edit_workout')} onClose={onClose}>
      {catalog ? (
        <div className={styles.editor}>
          <TextField
            label={t('workout_name')}
            maxLength={60}
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          />
          <GymSelect value={draft.gym} onChange={(gym) => setDraft((d) => ({ ...d, gym }))} />
          <WorkoutExercises
            exercises={draft.exercises}
            onChange={(change) => setDraft((d) => ({ ...d, exercises: change(d.exercises) }))}
            catalog={catalog}
            past
            legEvent={catalog.weekly_event === 'leg_day_x2'}
          />
          <p className={styles.note}>{t('edit_hint')}</p>
          <FormError error={edit.error} />
          <Button icon={Check} wide disabled={edit.isPending} onClick={handleSave}>
            {t('edit_save')}
          </Button>
          <Button icon={X} variant="quiet" wide onClick={onClose}>
            {t('cancel')}
          </Button>
        </div>
      ) : (
        <LoadingBlock rows={3} />
      )}
    </Sheet>
  );
}
