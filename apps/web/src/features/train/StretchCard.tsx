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
  const toggle = () => {
    navigator.vibrate?.(10);
    onChange({ ...set, done: !set.done });
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
              aria-pressed={set.minutes === minutes}
              onClick={() => onChange({ ...set, minutes })}
            >
              {t('stretch_for', { n: minutes })}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={styles.check}
          aria-pressed={set.done}
          aria-label={t('complete_set', { n: 1 })}
          onClick={toggle}
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
    </article>
  );
}
