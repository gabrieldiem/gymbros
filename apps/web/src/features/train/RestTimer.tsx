import { useEffect, useRef, useState } from 'react';

import { useI18n } from '../../i18n/context';
import styles from './RestTimer.module.css';
import type { Rest } from './useRestTimer';

type Props = {
  rest: Rest;
  leftMs: number;
  onAdjust: (seconds: number) => void;
  onSkip: () => void;
};

const CIRCUMFERENCE = 94.25;

/** Floating rest countdown. Announces the end once, then hides itself via onSkip. */
export function RestTimer({ rest, leftMs, onAdjust, onSkip }: Props) {
  const { t } = useI18n();
  const [announcement, setAnnouncement] = useState('');
  const ended = useRef(false);

  useEffect(() => {
    if (rest && leftMs > 0) ended.current = false;
    if (!rest || leftMs > 0 || ended.current) return;
    ended.current = true;
    setAnnouncement(t('rest_over'));
    navigator.vibrate?.([80, 60, 80]);
    onSkip();
  }, [rest, leftMs, onSkip, t]);

  const seconds = Math.ceil(leftMs / 1000);
  const label = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  const offset = rest ? CIRCUMFERENCE * (1 - leftMs / rest.totalMs) : 0;

  return (
    <>
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
      {rest && (
        <div className={styles.rest} role="timer" aria-label={t('rest')}>
          <svg className={styles.ring} viewBox="0 0 36 36" aria-hidden="true">
            <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(0,0,0,.2)" strokeWidth="5" />
            <circle
              cx="18"
              cy="18"
              r="15"
              fill="none"
              stroke="#0D0D0D"
              strokeWidth="5"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={offset}
            />
          </svg>
          <b className={styles.time}>{label}</b>
          <button type="button" aria-label={t('rest_minus')} onClick={() => onAdjust(-15)}>
            −15
          </button>
          <button type="button" aria-label={t('rest_plus')} onClick={() => onAdjust(15)}>
            +15
          </button>
          <button type="button" className={styles.skip} onClick={onSkip}>
            {t('skip')}
          </button>
        </div>
      )}
    </>
  );
}
