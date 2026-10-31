import type { Exercise, SetData } from '../../api/train';
import { cx } from '../../components/cx';
import { useI18n } from '../../i18n/context';
import type { MessageKey } from '../../i18n/en';
import styles from './ExerciseCard.module.css';
import { formatPrevious } from './format';
import type { DraftExercise } from './useWorkoutDraft';

type Props = {
  exercise: Exercise;
  entry: DraftExercise;
  onChange: (sets: SetData[]) => void;
  onRemove: () => void;
  onSetDone: () => void;
  onPlates: (kg: number) => void;
};

const COLUMNS: Record<Exercise['type'], [MessageKey, MessageKey]> = {
  w: ['col_kg', 'col_reps'],
  bw: ['col_added_kg', 'col_reps'],
  c: ['col_min', 'col_km'],
};

const EMPTY_SET: SetData = { load_kg: null, reps: null, minutes: null, km: null, done: false };

function parse(value: string): number | null {
  if (value.trim() === '') return null;
  const number = Number(value.replace(',', '.'));
  return Number.isFinite(number) && number >= 0 ? number : null;
}

/** The two editable numbers of a set, by exercise type. */
function fields(exercise: Exercise): [keyof SetData, keyof SetData] {
  return exercise.type === 'c' ? ['minutes', 'km'] : ['load_kg', 'reps'];
}

export function ExerciseCard({ exercise, entry, onChange, onRemove, onSetDone, onPlates }: Props) {
  const { t, n } = useI18n();
  const [colA, colB] = COLUMNS[exercise.type];
  const [fieldA, fieldB] = fields(exercise);
  const firstLoad = entry.sets.find((s) => s.load_kg)?.load_kg ?? 20;

  const setValue = (index: number, field: keyof SetData, value: string) =>
    onChange(entry.sets.map((s, i) => (i === index ? { ...s, [field]: parse(value) } : s)));

  const toggle = (index: number) => {
    const next = entry.sets.map((s, i) => (i === index ? { ...s, done: !s.done } : s));
    onChange(next);
    if (next[index]?.done) onSetDone();
  };

  const addSet = () => {
    const last = entry.sets[entry.sets.length - 1];
    onChange([...entry.sets, last ? { ...last, done: false } : EMPTY_SET]);
  };

  return (
    <article className={styles.card} aria-label={exercise.name}>
      <header className={styles.head}>
        <h3>{exercise.name}</h3>
        <span className={styles.tools}>
          {exercise.barbell && (
            <button type="button" className={styles.link} onClick={() => onPlates(firstLoad)}>
              {t('plates')}
            </button>
          )}
          <button
            type="button"
            className={styles.link}
            onClick={onRemove}
            aria-label={t('remove_ex', { name: exercise.name })}
          >
            {t('remove')}
          </button>
        </span>
      </header>
      {entry.previous_sets.length > 0 && <p className={styles.beat}>↑ {t('beat')}</p>}
      <div className={cx(styles.row, styles.headRow)} aria-hidden="true">
        <span>{t('col_set')}</span>
        <span>{t('col_last')}</span>
        <span>{t(colA)}</span>
        <span>{t(colB)}</span>
        <span />
      </div>
      {entry.sets.map((set, i) => (
        <div key={i} className={cx(styles.row, set.done && styles.done)}>
          <span className={styles.n}>{i + 1}</span>
          <span className={styles.prev}>{formatPrevious(exercise, entry.previous_sets[i], n)}</span>
          {[fieldA, fieldB].map((field, f) => (
            <input
              key={field}
              className={styles.input}
              type="number"
              inputMode="decimal"
              min={0}
              step={field === 'load_kg' ? 2.5 : field === 'km' ? 0.1 : 1}
              value={(set[field] as number | null) ?? ''}
              onChange={(e) => setValue(i, field, e.target.value)}
              aria-label={t('set_field', {
                name: exercise.name,
                n: i + 1,
                field: t(f ? colB : colA),
              })}
            />
          ))}
          <button
            type="button"
            className={styles.check}
            aria-pressed={set.done}
            aria-label={t('complete_set', { n: i + 1 })}
            onClick={() => toggle(i)}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m5 12.5 4.5 4.5L19 7.5" />
            </svg>
          </button>
        </div>
      ))}
      <button type="button" className={styles.addSet} onClick={addSet}>
        + {t('add_set')}
      </button>
    </article>
  );
}
