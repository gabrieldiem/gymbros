import { SkipForward, Timer as TimerIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { useI18n } from '../../i18n/context';
import styles from './RestTimer.module.css';
import type { Rest } from './useRestTimer';

type Props = {
  rest: Rest;
  leftMs: number;
  /** What the button offers when no rest is running. */
  defaultSeconds: number;
  onStart: () => void;
  onAdjust: (seconds: number) => void;
  onSkip: () => void;
};

const CIRCUMFERENCE = 94.25;
const FLASH_MS = 1800;

const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/**
 * The rest timer you start when you want. At zero the whole screen flashes, because a phone on a
 * bench is seen from a distance. That's three slow pulses, under the limit of three a second that
 * keeps flashing safe; with reduced motion it's one still screen instead.
 */
export function RestTimer({ rest, leftMs, defaultSeconds, onStart, onAdjust, onSkip }: Props) {
  const { t } = useI18n();
  const [announcement, setAnnouncement] = useState('');
  const [flashing, setFlashing] = useState(false);
  const ended = useRef(false);

  useEffect(() => {
    if (rest && leftMs > 0) ended.current = false;
    if (!rest || leftMs > 0 || ended.current) return;
    ended.current = true;
    setAnnouncement(t('rest_over'));
    setFlashing(true);
    navigator.vibrate?.([80, 60, 80, 60, 80]);
    onSkip();
  }, [rest, leftMs, onSkip, t]);

  useEffect(() => {
    if (!flashing) return;
    const id = setTimeout(() => setFlashing(false), FLASH_MS);
    return () => clearTimeout(id);
  }, [flashing]);

  const seconds = Math.ceil(leftMs / 1000);
  const label = clock(seconds);
  const offset = rest ? CIRCUMFERENCE * (1 - leftMs / rest.totalMs) : 0;

  return (
    <>
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
      {flashing && (
        <div className={styles.flash} aria-hidden="true" data-testid="rest-flash">
          <b>{t('rest_over')}</b>
        </div>
      )}
      {!rest && (
        <button type="button" className={styles.start} onClick={onStart}>
          <TimerIcon size={20} aria-hidden="true" />
          {t('rest_start', { x: clock(defaultSeconds) })}
        </button>
      )}
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
            <SkipForward size={16} aria-hidden="true" />
            {t('skip')}
          </button>
        </div>
      )}
    </>
  );
}
