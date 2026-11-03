import { Plus } from 'lucide-react';
import { useState } from 'react';

import type { Exercise, MuscleGroup } from '../../api/train';
import { Button } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { TextField } from '../../components/TextField';
import { useI18n } from '../../i18n/context';
import styles from './ExercisePicker.module.css';
import { searchExercises } from './exerciseSearch';

type Props = {
  exercises: Exercise[];
  onPick: (id: string) => void;
  onClose: () => void;
  /** A timed event pays extra for leg exercises. */
  legBonus?: boolean;
  onPickCustom: (name: string) => void;
};

const GROUPS: MuscleGroup[] = [
  'Chest',
  'Legs',
  'Back',
  'Shoulders',
  'Arms',
  'Core',
  'Cardio',
  'Mobility',
];

/** Search the catalog by English name or Spanish alias ("sentadilla" finds Back squat). */
export function ExercisePicker({
  exercises,
  legBonus = false,
  onPick,
  onClose,
  onPickCustom,
}: Props) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [customName, setCustomName] = useState('');
  const matches = searchExercises(
    exercises.filter((e) => e.type !== 'x'),
    query,
  );
  // Nothing found: whatever they searched for is probably what they'd call it.
  const typedName = customName || (matches.length === 0 ? query : '');

  return (
    <Sheet title={t('add_ex')} onClose={onClose}>
      <input
        className={styles.search}
        type="search"
        placeholder={t('search_ex')}
        aria-label={t('search_ex')}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          // The best matches are at the top, right under the search box.
          e.target.closest('[role="dialog"]')?.scrollTo?.({ top: 0 });
        }}
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
                {legBonus && exercise.group === 'Legs' && (
                  <span className={styles.bonus}>{t('leg_bonus')}</span>
                )}
              </button>
            ))}
          </section>
        );
      })}
      <form
        className={styles.custom}
        onSubmit={(event) => {
          event.preventDefault();
          if (typedName.trim()) onPickCustom(typedName.trim());
        }}
      >
        <TextField
          label={t('custom_ex_label')}
          hint={t('custom_ex_hint')}
          maxLength={60}
          autoComplete="off"
          value={typedName}
          onChange={(e) => setCustomName(e.target.value)}
        />
        <Button type="submit" variant="ghost" icon={Plus} disabled={!typedName.trim()}>
          {t('custom_ex_add')}
        </Button>
      </form>
    </Sheet>
  );
}
