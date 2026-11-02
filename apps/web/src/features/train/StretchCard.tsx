import { X } from 'lucide-react';
import type { Exercise, SetData } from '../../api/train';
import { cx } from '../../components/cx';
import { useI18n } from '../../i18n/context';
import styles from './ExerciseCard.module.css';

const CHOICES = [5, 10];

type Props = {
  exercise: Exercise;
  set: SetData;
  onChange: (set: SetData) => void;
  onRemove: () => void;
};

/** Stretching pays fixed points, so there's only how long, and whether you did it. */
export function StretchCard({ exercise, set, onChange, onRemove }: Props) {
  const { t } = useI18n();
  const choose = (minutes: number) => {
    navigator.vibrate?.(10);
    // The one you already chose, again: you didn't stretch after all.
    onChange(
      set.done && set.minutes === minutes
        ? { ...set, done: false }
        : { ...set, minutes, done: true },
    );
  };
  return (
    <article className={styles.card} aria-label={exercise.name}>
      <header className={styles.head}>
        <span className={styles.title}>
          <h3>{exercise.name}</h3>
          <small className={styles.record}>{t('stretch_pays')}</small>
        </span>
        <span className={styles.tools}>
          <button
            type="button"
            className={styles.link}
            onClick={onRemove}
            aria-label={t('remove_ex', { name: exercise.name })}
          >
            <X size={16} aria-hidden="true" />
            {t('remove')}
          </button>
        </span>
      </header>
      <div className={cx(styles.stretch, set.done && styles.done)}>
        <div className={styles.choices} role="group" aria-label={t('stretch_minutes')}>
          {CHOICES.map((minutes) => (
            <button
              key={minutes}
              type="button"
              aria-pressed={set.done && set.minutes === minutes}
              onClick={() => choose(minutes)}
            >
              {t('stretch_for', { n: minutes })}
            </button>
          ))}
        </div>
      </div>
    </article>
  );
}
