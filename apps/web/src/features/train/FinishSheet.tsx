import { useEffect, useState } from 'react';

import type { Exercise, FinishResult } from '../../api/train';
import { Button } from '../../components/Button';
import { cx } from '../../components/cx';
import { Sheet } from '../../components/Sheet';
import { useI18n } from '../../i18n/context';
import styles from './FinishSheet.module.css';
import { lineItemText } from './format';

type Props = {
  result: FinishResult;
  exercises: Exercise[];
  onClimb: () => void;
  onClose: () => void;
};

const reducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** Count up to `target` with an ease-out curve; jump straight there with reduced motion. */
function useCountUp(target: number, durationMs: number): number {
  const [value, setValue] = useState(() => (reducedMotion() ? target : 0));
  useEffect(() => {
    if (reducedMotion()) return;
    let frame = 0;
    const start = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / durationMs);
      setValue(Math.round(target * (1 - Math.pow(1 - k, 3))));
      if (k < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);
  return value;
}

function minutesBetween(start: string, end: string): number {
  return Math.max(1, Math.round((Date.parse(end) - Date.parse(start)) / 60_000));
}

/** The reward moment: every line item from the API and the total. */
export function FinishSheet({ result, exercises, onClimb, onClose }: Props) {
  const { t, n } = useI18n();
  const shown = useCountUp(result.total, 300 + result.line_items.length * 100);
  const vs = result.vs_last_pct;
  const vsText =
    vs === null
      ? null
      : vs > 0
        ? t('vs_up', { n: vs })
        : vs < 0
          ? t('vs_down', { n: -vs })
          : t('vs_same');

  return (
    <Sheet title={result.name} onClose={onClose} hideTitle>
      <div className={styles.summary}>
        <p className={styles.done}>
          {t('sum_done', {
            name: result.name,
            n: minutesBetween(result.started_at, result.finished_at),
          })}
        </p>
        <div className={styles.big} aria-hidden="true">
          {n(shown)}
        </div>
        <p className={styles.label}>
          <span className="sr-only">{n(result.total)} </span>
          {t('to_climb')}
        </p>
        {vsText && (
          <span className={cx(styles.vs, vs !== null && vs > 0 && styles.up)}>{vsText}</span>
        )}
        <ul className={styles.lines}>
          {result.line_items.map((item, i) => (
            <li key={`${item.key}-${i}`} style={{ animationDelay: `${200 + i * 100}ms` }}>
              <span className={cx(item.key === 'ln_pr' && styles.pr)}>
                {lineItemText(item, exercises, t, n)}
              </span>
              <b>+{n(item.points)}</b>
            </li>
          ))}
        </ul>
        <div className={styles.actions}>
          <Button wide onClick={onClimb}>
            {t('see_climb')}
          </Button>
          <Button variant="quiet" wide onClick={onClose}>
            {t('done')}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
