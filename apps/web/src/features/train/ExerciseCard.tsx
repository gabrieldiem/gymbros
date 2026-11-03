import { Disc3, PersonStanding, Plus, Repeat2, Trash2, TrendingUp, X } from 'lucide-react';
import { Fragment } from 'react';

import { useMyStats } from '../../api/compete';
import type { Exercise, SetData } from '../../api/train';
import { cx } from '../../components/cx';
import { useI18n } from '../../i18n/context';
import type { MessageKey } from '../../i18n/en';
import styles from './ExerciseCard.module.css';
import {
  BAR_OPTIONS_KG,
  barOf,
  disksOf,
  editSet,
  hasNoWeight,
  isSuggestion,
  repeatSource,
  repeated,
  withBar,
  withoutWeight,
} from './barbell';
import { formatLift, formatPrevious } from './format';
import type { DraftExercise } from './useWorkoutDraft';

type Props = {
  exercise: Exercise;
  entry: DraftExercise;
  onChange: (sets: SetData[]) => void;
  onRemove: () => void;
  /** A timed event pays extra for this exercise. */
  legBonus?: boolean;
  /** Logging a past day: there's nothing to beat, it already happened. */
  past?: boolean;
  onPlates: (disksKg: number, barKg: number) => void;
};

const COLUMNS: Record<Exercise['type'], [MessageKey, MessageKey]> = {
  w: ['col_kg', 'col_reps'],
  bw: ['col_added_kg', 'col_reps'],
  c: ['col_min', 'col_km'],
  s: ['col_min', 'col_km'], // Never shown: stretching has its own card.
  x: ['col_kg', 'col_reps'],
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
  const { exercise, entry, onChange, onRemove, onPlates, past = false, legBonus = false } = props;
  const { t, n } = useI18n();
  const record = useMyStats().data?.prs.find((pr) => pr.exercise_id === exercise.id);
  const [colA, colB] = COLUMNS[exercise.type];
  const [fieldA, fieldB] = fields(exercise);
  const bar = barOf(entry.sets);
  const name = entry.custom_name ?? exercise.name;
  const timed = (exercise.minute_effort_km ?? 0) > 0;
  // Bodyweight exercises already work this way, and neither does cardio have a weight.
  const canSkipWeight = exercise.type === 'w' || exercise.type === 'x';
  const noWeight = canSkipWeight && hasNoWeight(entry.sets);
  const firstLoad = entry.sets.find((s) => s.load_kg)?.load_kg;
  const number = (set: SetData, field: keyof SetData) =>
    exercise.barbell && field === 'load_kg' && set.load_kg !== null
      ? disksOf(set.load_kg, set.bar_kg ?? bar)
      : (set[field] as number | null);

  const setValue = (index: number, field: keyof SetData, value: string) =>
    onChange(
      entry.sets.map((s, i) => (i === index ? editSet(exercise, s, field, parse(value), bar) : s)),
    );

  const addSet = () => {
    const last = entry.sets[entry.sets.length - 1];
    onChange([...entry.sets, last ? { ...last, done: false, started: false } : EMPTY_SET]);
  };

  const repeat = (index: number, source: SetData) => {
    navigator.vibrate?.(10);
    onChange(entry.sets.map((s, i) => (i === index ? repeated(exercise, s, source, bar) : s)));
  };

  const removeSet = (index: number) => onChange(entry.sets.filter((_, i) => i !== index));

  // The next set to do: its full weight, so nobody does the sum between sets.
  const nextSet = entry.sets.findIndex((s) => !s.done && Boolean(s.load_kg));

  return (
    <article className={styles.card} aria-label={name}>
      <header className={styles.head}>
        <span className={styles.title}>
          <h3>
            {name}
            {legBonus && <span className={styles.bonus}>{t('leg_bonus')}</span>}
            {exercise.type === 'x' && <span className={styles.noPoints}>{t('custom_tag')}</span>}
          </h3>
          {record && (
            <small className={styles.record}>
              {t('pr_current', {
                x: formatLift(exercise, record.load_kg, record.reps, t, n, record.bar_kg),
              })}
            </small>
          )}
        </span>
        <span className={styles.tools}>
          {canSkipWeight && (
            <button
              type="button"
              className={cx(styles.link, noWeight && styles.linkOn)}
              aria-pressed={noWeight}
              onClick={() => onChange(withoutWeight(exercise, entry.sets, !noWeight))}
            >
              <PersonStanding size={16} aria-hidden="true" />
              {t('no_weight')}
            </button>
          )}
          {exercise.barbell && !noWeight && (
            <button
              type="button"
              className={styles.link}
              onClick={() => onPlates(firstLoad ? disksOf(firstLoad, bar) : 0, bar)}
            >
              <Disc3 size={16} aria-hidden="true" />
              {t('plates')}
            </button>
          )}
          <button
            type="button"
            className={styles.link}
            onClick={onRemove}
            aria-label={t('remove_ex', { name })}
          >
            <X size={16} aria-hidden="true" />
            {t('remove')}
          </button>
        </span>
      </header>
      <div className={styles.meta}>
        {!past && entry.previous_sets.length > 0 && (
          <p className={styles.beat}>
            <TrendingUp size={15} aria-hidden="true" /> {t('beat')}
          </p>
        )}
        {exercise.barbell && !noWeight && (
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
        <span>{timed ? '' : t(colB)}</span>
        <span />
      </div>
      {entry.sets.map((set, i) => {
        const source = repeatSource(entry.sets, entry.previous_sets, i);
        const sourceText = formatPrevious(exercise, source, n);
        return (
          <Fragment key={i}>
            <div className={cx(styles.row, set.done && styles.done)}>
              <span className={styles.n}>{i + 1}</span>
              <button
                type="button"
                className={styles.prev}
                disabled={!source}
                aria-label={source ? t('repeat_set', { x: sourceText, n: i + 1 }) : undefined}
                onClick={() => source && repeat(i, source)}
              >
                {source && <Repeat2 size={15} aria-hidden="true" />}
                <span>{sourceText}</span>
              </button>
              {[fieldA, fieldB].map((field, f) =>
                timed && f === 1 ? (
                  <span key={field} />
                ) : (
                  <input
                    key={field}
                    className={styles.input}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={field === 'load_kg' ? 2.5 : field === 'km' ? 0.1 : 1}
                    disabled={field === 'load_kg' && set.load_kg === 0}
                    value={
                      isSuggestion(set) || (field === 'load_kg' && set.load_kg === 0)
                        ? ''
                        : (number(set, field) ?? '')
                    }
                    placeholder={
                      field === 'load_kg' && set.load_kg === 0
                        ? 'BW'
                        : isSuggestion(set)
                          ? String(number(set, field) ?? '')
                          : undefined
                    }
                    onChange={(e) => setValue(i, field, e.target.value)}
                    aria-label={t('set_field', {
                      name,
                      n: i + 1,
                      field: t(f ? colB : exercise.barbell ? 'col_disks' : colA),
                    })}
                  />
                ),
              )}
              {entry.sets.length > 1 ? (
                <button
                  type="button"
                  className={styles.removeSet}
                  aria-label={t('remove_set', { n: i + 1 })}
                  onClick={() => removeSet(i)}
                >
                  <Trash2 size={18} aria-hidden="true" />
                </button>
              ) : (
                <span />
              )}
            </div>
            {exercise.barbell && i === nextSet && Boolean(set.load_kg) && (
              <p className={styles.barDetail}>
                {t('bar_detail', {
                  kg: n(set.load_kg ?? 0),
                  side: n((number(set, 'load_kg') ?? 0) / 2),
                })}
              </p>
            )}
          </Fragment>
        );
      })}
      <button type="button" className={styles.addSet} onClick={addSet}>
        <Plus size={16} aria-hidden="true" />
        {t('add_set')}
      </button>
    </article>
  );
}
