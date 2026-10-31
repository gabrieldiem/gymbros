import { useState } from 'react';

import type { Exercise, MuscleGroup } from '../../api/train';
import { Sheet } from '../../components/Sheet';
import { useI18n } from '../../i18n/context';
import styles from './ExercisePicker.module.css';
import { searchExercises } from './exerciseSearch';

type Props = { exercises: Exercise[]; onPick: (id: string) => void; onClose: () => void };

const GROUPS: MuscleGroup[] = ['Chest', 'Legs', 'Back', 'Shoulders', 'Arms', 'Cardio'];

/** Search the catalog by English name or Spanish alias ("sentadilla" finds Back squat). */
export function ExercisePicker({ exercises, onPick, onClose }: Props) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const matches = searchExercises(exercises, query);

  return (
    <Sheet title={t('add_ex')} onClose={onClose}>
      <input
        className={styles.search}
        type="search"
        placeholder={t('search_ex')}
        aria-label={t('search_ex')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {matches.length === 0 && <p className={styles.empty}>{t('no_match')}</p>}
      {GROUPS.map((group) => {
        const inGroup = matches.filter((e) => e.group === group);
        if (!inGroup.length) return null;
        return (
          <section key={group} aria-label={t(`group_${group}`)}>
            <h3 className={styles.group}>{t(`group_${group}`)}</h3>
            {inGroup.map((exercise) => (
              <button
                key={exercise.id}
                type="button"
                className={styles.pick}
                onClick={() => onPick(exercise.id)}
              >
                {exercise.name}
              </button>
            ))}
          </section>
        );
      })}
    </Sheet>
  );
}
