import { Plus } from 'lucide-react';
import { useState } from 'react';

import type { Catalog, SetData } from '../../api/train';
import { Button } from '../../components/Button';
import { useI18n } from '../../i18n/context';
import { ExerciseCard } from './ExerciseCard';
import { ExercisePicker } from './ExercisePicker';
import { PlateCalculator } from './PlateCalculator';
import { StretchCard } from './StretchCard';
import type { DraftExercise } from './useWorkoutDraft';
import styles from './WorkoutLogger.module.css';

type Props = {
  exercises: DraftExercise[];
  onChange: (change: (exercises: DraftExercise[]) => DraftExercise[]) => void;
  catalog: Catalog;
  /** It already happened, so there's nothing to beat. */
  past: boolean;
  legEvent: boolean;
};

/** The exercises of a workout and adding more, in the logger and when editing a finished one. */
export function WorkoutExercises({ exercises, onChange, catalog, past, legEvent }: Props) {
  const { t } = useI18n();
  const [picking, setPicking] = useState(false);
  const [plates, setPlates] = useState<{ disks: number; bar: number } | null>(null);
  const exerciseById = (id: string) => catalog.exercises.find((e) => e.id === id);

  const setSets = (index: number, sets: SetData[]) =>
    onChange((list) => list.map((e, i) => (i === index ? { ...e, sets } : e)));
  const removeExercise = (index: number) => onChange((list) => list.filter((_, i) => i !== index));
  const addExercise = (id: string, customName?: string) => {
    const exercise = exerciseById(id);
    const single = exercise?.type === 'c' || exercise?.type === 's';
    const empty: SetData = {
      load_kg: null,
      reps: null,
      minutes: exercise?.default_minutes ?? null,
      km: null,
      done: false,
    };
    const sets = Array.from({ length: single ? 1 : 3 }, () => ({ ...empty }));
    onChange((list) => [
      ...list,
      {
        exercise_id: id,
        sets,
        previous_sets: [],
        ...(customName ? { custom_name: customName } : {}),
      },
    ]);
    setPicking(false);
  };

  return (
    <>
      {exercises.map((entry, i) => {
        const exercise = exerciseById(entry.exercise_id);
        if (!exercise) return null;
        const firstSet = entry.sets[0];
        if (exercise.type === 's' && firstSet) {
          return (
            <StretchCard
              key={`${entry.exercise_id}-${i}`}
              exercise={exercise}
              set={firstSet}
              onChange={(set) => setSets(i, [set])}
              onRemove={() => removeExercise(i)}
            />
          );
        }
        return (
          <ExerciseCard
            key={`${entry.exercise_id}-${i}`}
            exercise={exercise}
            entry={entry}
            onChange={(sets) => setSets(i, sets)}
            onRemove={() => removeExercise(i)}
            past={past}
            legBonus={legEvent && exercise.group === 'Legs'}
            onPlates={(disks, bar) => setPlates({ disks, bar })}
          />
        );
      })}
      {exercises.length === 0 && <p className={styles.empty}>{t('no_ex')}</p>}
      <Button
        icon={Plus}
        variant="ghost"
        wide
        className={styles.add}
        onClick={() => setPicking(true)}
      >
        {t('add_ex')}
      </Button>
      {picking && (
        <ExercisePicker
          exercises={catalog.exercises}
          legBonus={legEvent}
          onPick={addExercise}
          onPickCustom={(name) => addExercise('custom', name)}
          onClose={() => setPicking(false)}
        />
      )}
      {plates && (
        <PlateCalculator
          initialDisks={plates.disks}
          barKg={plates.bar}
          onClose={() => setPlates(null)}
        />
      )}
    </>
  );
}
