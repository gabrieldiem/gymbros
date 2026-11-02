import { Fragment } from 'react';

import { useMyStats } from '../../api/compete';
import type { Exercise, SetData } from '../../api/train';
import { cx } from '../../components/cx';
import { useI18n } from '../../i18n/context';
import type { MessageKey } from '../../i18n/en';
import styles from './ExerciseCard.module.css';
import { BAR_OPTIONS_KG, barOf, disksOf, loadOf, repeatSource, repeated, withBar } from './barbell';
import { formatLift, formatPrevious } from './format';
import type { DraftExercise } from './useWorkoutDraft';

type Props = {
  exercise: Exercise;
  entry: DraftExercise;
  onChange: (sets: SetData[]) => void;
  onRemove: () => void;
  onSetDone: () => void;
  /** Logging a past day: there's nothing to beat, it already happened. */
  past?: boolean;
  onPlates: (disksKg: number, barKg: number) => void;
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

/** The usual bars, plus an unusual one a set already has. */
const barChoices = (current: number) =>
  (BAR_OPTIONS_KG as readonly number[]).includes(current)
    ? [...BAR_OPTIONS_KG]
    : [...BAR_OPTIONS_KG, current];

export function ExerciseCard(props: Props) {
  const { exercise, entry, onChange, onRemove, onSetDone, onPlates, past = false } = props;
  const { t, n } = useI18n();
  const record = useMyStats().data?.prs.find((pr) => pr.exercise_id === exercise.id);
  const [colA, colB] = COLUMNS[exercise.type];
  const [fieldA, fieldB] = fields(exercise);
  const bar = barOf(entry.sets);
  const firstLoad = entry.sets.find((s) => s.load_kg)?.load_kg;
  const disksShown = (set: SetData) =>
    set.load_kg === null ? null : disksOf(set.load_kg, set.bar_kg ?? bar);

  const shownValue = (set: SetData, field: keyof SetData) =>
    exercise.barbell && field === 'load_kg' ? disksShown(set) : (set[field] as number | null);

  const setValue = (index: number, field: keyof SetData, value: string) => {
    const parsed = parse(value);
    const change: Partial<SetData> =
      exercise.barbell && field === 'load_kg'
        ? { load_kg: parsed === null ? null : loadOf(parsed, bar), bar_kg: bar }
        : { [field]: parsed };
    onChange(entry.sets.map((s, i) => (i === index ? { ...s, ...change } : s)));
  };

  const toggle = (index: number) => {
    navigator.vibrate?.(10);
    const next = entry.sets.map((s, i) => {
      if (i !== index) return s;
      // Reps with no disks typed: that's the empty bar.
      const emptyBar = exercise.barbell && !s.done && s.load_kg === null && s.reps;
      return { ...s, done: !s.done, ...(emptyBar ? { load_kg: bar, bar_kg: bar } : {}) };
    });
    onChange(next);
    if (next[index]?.done) onSetDone();
  };

  const addSet = () => {
    const last = entry.sets[entry.sets.length - 1];
    onChange([...entry.sets, last ? { ...last, done: false } : EMPTY_SET]);
  };

  const repeat = (index: number, source: SetData) =>
    onChange(entry.sets.map((s, i) => (i === index ? repeated(exercise, s, source, bar) : s)));

  const removeSet = (index: number) => onChange(entry.sets.filter((_, i) => i !== index));

  // The next set to do: its full weight, so nobody does the sum between sets.
  const nextSet = entry.sets.findIndex((s) => !s.done && s.load_kg !== null);

  return (
    <article className={styles.card} aria-label={exercise.name}>
      <header className={styles.head}>
        <span className={styles.title}>
          <h3>{exercise.name}</h3>
          {record && (
            <small className={styles.record}>
              {t('pr_current', {
                x: formatLift(exercise, record.load_kg, record.reps, t, n, record.bar_kg),
              })}
            </small>
          )}
        </span>
        <span className={styles.tools}>
          {exercise.barbell && (
            <button
              type="button"
              className={styles.link}
              onClick={() => onPlates(firstLoad ? disksOf(firstLoad, bar) : 0, bar)}
            >
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
      <div className={styles.meta}>
        {!past && entry.previous_sets.length > 0 && <p className={styles.beat}>↑ {t('beat')}</p>}
        {exercise.barbell && (
          <label className={styles.bar}>
            {t('bar_label')}
            <select
              value={bar}
              onChange={(e) => onChange(withBar(entry.sets, Number(e.target.value)))}
            >
              {barChoices(bar).map((kg) => (
                <option key={kg} value={kg}>
                  {t('bar_option', { n: n(kg) })}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className={cx(styles.row, styles.headRow)} aria-hidden="true">
        <span>{t('col_set')}</span>
        <span>{t('col_repeat')}</span>
        <span>{t(exercise.barbell ? 'col_disks' : colA)}</span>
        <span>{t(colB)}</span>
        <span />
      </div>
      {entry.sets.map((set, i) => {
        const source = repeatSource(entry.sets, entry.previous_sets, i);
        const sourceText = formatPrevious(exercise, source, n);
        return (
          <Fragment key={i}>
            <div className={cx(styles.row, set.done && styles.done)}>
              <button
                type="button"
                className={styles.n}
                disabled={entry.sets.length === 1}
                aria-label={t('remove_set', { n: i + 1 })}
                onClick={() => removeSet(i)}
              >
                <b>{i + 1}</b>
                {entry.sets.length > 1 && <i aria-hidden="true">×</i>}
              </button>
              <button
                type="button"
                className={styles.prev}
                disabled={!source}
                aria-label={source ? t('repeat_set', { x: sourceText, n: i + 1 }) : undefined}
                onClick={() => source && repeat(i, source)}
              >
                {source && <span aria-hidden="true">↻ </span>}
                {sourceText}
              </button>
              {[fieldA, fieldB].map((field, f) => (
                <input
                  key={field}
                  className={styles.input}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={field === 'load_kg' ? 2.5 : field === 'km' ? 0.1 : 1}
                  value={shownValue(set, field) ?? ''}
                  onChange={(e) => setValue(i, field, e.target.value)}
                  aria-label={t('set_field', {
                    name: exercise.name,
                    n: i + 1,
                    field: t(f ? colB : exercise.barbell ? 'col_disks' : colA),
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
            {exercise.barbell && i === nextSet && set.load_kg !== null && (
              <p className={styles.barDetail}>
                {t('bar_detail', {
                  kg: n(set.load_kg),
                  side: n((disksShown(set) ?? 0) / 2),
                })}
              </p>
            )}
          </Fragment>
        );
      })}
      <button type="button" className={styles.addSet} onClick={addSet}>
        + {t('add_set')}
      </button>
    </article>
  );
}
