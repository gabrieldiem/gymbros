import { useI18n } from '../i18n/context';
import { cx } from './cx';
import styles from './Pips.module.css';

type Props = { done: number; target: number; large?: boolean };

/** Weekly goal pips: target circles, filled volt as workouts land, plus a red pip per extra. */
export function Pips({ done, target, large }: Props) {
  const { t } = useI18n();
  const count = Math.max(target, done);
  return (
    <span
      className={cx(styles.pips, large && styles.large)}
      role="img"
      aria-label={t('pips_label', { n: done, target })}
    >
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={cx(
            styles.pip,
            i < Math.min(done, target) && styles.on,
            i >= target && styles.over,
          )}
        />
      ))}
    </span>
  );
}
