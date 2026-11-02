import { useEffect, useState } from 'react';

import { useI18n } from '../i18n/context';
import { cx } from './cx';
import styles from './TimedEvent.module.css';
import { timeLeftParts } from './timeLeft';

const WEEK_MS = 7 * 24 * 3_600_000;

function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function ClockIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2M9.5 2.5h5" />
    </svg>
  );
}

function useLeftText(endsAt: string | null | undefined): { text: string | null; elapsed: number } {
  const { t } = useI18n();
  const now = useNow();
  if (!endsAt) return { text: null, elapsed: 0 };
  const ms = Date.parse(endsAt) - now;
  if (ms <= 0) return { text: null, elapsed: 1 };
  const { d, h, m } = timeLeftParts(ms);
  const left = d ? t('dur_dh', { d, h }) : h ? t('dur_hm', { h, m }) : t('dur_m', { m });
  return { text: t('event_left', { x: left }), elapsed: Math.min(1, 1 - ms / WEEK_MS) };
}

/** A timed event as a small chip: its name and how long it has left. */
export function TimedEventChip({ endsAt }: { endsAt: string | null | undefined }) {
  const { t } = useI18n();
  const { text } = useLeftText(endsAt);
  return (
    <span className={styles.chip}>
      <ClockIcon />
      <b>{t('leg_event_name')}</b>
      {text && <span>{text}</span>}
    </span>
  );
}

/** A timed event as a card: what it pays, and a bar of the week running out. */
export function TimedEventCard({
  endsAt,
  className,
  children,
}: {
  endsAt: string | null | undefined;
  className?: string;
  children?: React.ReactNode;
}) {
  const { t } = useI18n();
  const { text, elapsed } = useLeftText(endsAt);
  return (
    <article className={cx(styles.card, className)}>
      <p className={styles.kicker}>
        <ClockIcon />
        {t('event_kicker')}
      </p>
      <h3>{t('leg_event_name')}</h3>
      <p>{t('weather_desc')}</p>
      {text && (
        <div className={styles.time}>
          <span className={styles.left}>{text}</span>
          <span className={styles.track} aria-hidden="true">
            <i style={{ width: `${Math.round((1 - elapsed) * 100)}%` }} />
          </span>
        </div>
      )}
      {children}
    </article>
  );
}
