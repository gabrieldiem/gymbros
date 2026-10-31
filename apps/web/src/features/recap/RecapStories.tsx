import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { useRecap, type Recap } from '../../api/compete';
import { useMe } from '../../api/me';
import type { Exercise } from '../../api/train';
import { ButtonLink } from '../../components/Button';
import { cx } from '../../components/cx';
import { ErrorBlock, LoadingBlock } from '../../components/QueryState';
import { useI18n } from '../../i18n/context';
import { ordinal } from '../../i18n/ordinal';
import { formatLift } from '../train/format';
import styles from './RecapStories.module.css';

const SLIDE_MS = 5500;
const CREW_HEX = {
  volt: '#FFE600',
  red: '#FF3B1F',
  cyan: '#00D1FF',
  pink: '#FF4FD8',
  violet: '#B48CFF',
};
const reducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

type Slide = { bg: string; fg: string; body: ReactNode };

function useSlides(recap: Recap, exercises: Exercise[], onClose: () => void): Slide[] {
  const { t, n, lang } = useI18n();
  const crewName = useMe().data?.crew?.name ?? '';
  const lift = (pr: NonNullable<Recap['heaviest_pr']>) =>
    `${exercises.find((e) => e.id === pr.exercise_id)?.name ?? pr.exercise_id} ${formatLift(
      exercises.find((e) => e.id === pr.exercise_id),
      pr.load_kg,
      pr.reps,
      t,
      n,
    )}`;
  const slides: Slide[] = [
    {
      bg: '#0D0D0D',
      fg: '#FFE600',
      body: (
        <>
          <p className={styles.kicker}>{t('r_crew_kicker', { crew: crewName })}</p>
          <div className={styles.huge}>{n(recap.crew_total)}</div>
          <p className={styles.mid}>{t('r_crew_mid')}</p>
          <p className={styles.sub} style={{ color: '#F2F2EE' }}>
            {t('r_crew_sub')}
          </p>
        </>
      ),
    },
  ];
  if (recap.biggest_climber) {
    slides.push({
      bg: CREW_HEX[recap.biggest_climber.color],
      fg: '#0D0D0D',
      body: (
        <>
          <p className={styles.kicker}>{t('r_climber_kicker')}</p>
          <div className={styles.huge}>{recap.biggest_climber.display_name}</div>
          <p className={styles.mid}>
            {t('r_climber_mid', {
              n: n(recap.biggest_climber_points),
              w: recap.biggest_climber_workouts,
            })}
          </p>
        </>
      ),
    });
  }
  slides.push({
    bg: '#FF3B1F',
    fg: '#FFFFFF',
    body: recap.heaviest_pr ? (
      <>
        <p className={styles.kicker}>{t('r_pr_kicker')}</p>
        <div className={styles.huge}>{t('kg_n', { n: n(recap.heaviest_pr.load_kg) })}</div>
        <p className={styles.mid}>
          {recap.heaviest_pr.member.display_name}, {lift(recap.heaviest_pr)}
        </p>
      </>
    ) : (
      <>
        <p className={styles.kicker}>{t('r_pr_kicker')}</p>
        <p className={styles.mid}>{t('r_pr_none')}</p>
      </>
    ),
  });
  const moved = recap.position_before !== recap.position_after;
  slides.push({
    bg: '#FFE600',
    fg: '#0D0D0D',
    body: (
      <>
        <p className={styles.kicker}>{t('r_you_kicker')}</p>
        <div className={styles.huge}>
          {recap.my_workouts} / {recap.weekly_target}
        </div>
        <p className={styles.mid}>
          {moved
            ? t('r_you_moved', {
                a: ordinal(lang, recap.position_before),
                b: ordinal(lang, recap.position_after),
              })
            : t('r_you_held', { a: ordinal(lang, recap.position_after) })}
        </p>
        <div className={styles.grid}>
          <div>
            <b>{t('unit_t', { n: n(Math.round(recap.my_volume_kg / 100) / 10) })}</b>
            {t('r_lifted')}
          </div>
          <div>
            <b>+{n(recap.my_points)}</b>
            {t('r_pts')}
          </div>
          {recap.my_best_pr && (
            <div>
              <b>{t('kg_n', { n: n(recap.my_best_pr.load_kg) })}</b>
              {t('r_pr')}
            </div>
          )}
        </div>
      </>
    ),
  });
  if (recap.most_improved && recap.most_improved_pct !== null) {
    slides.push({
      bg: '#B48CFF',
      fg: '#0D0D0D',
      body: (
        <>
          <p className={styles.kicker}>{t('r_improved_kicker')}</p>
          <div className={styles.huge}>
            {recap.most_improved_pct > 0 ? '+' : ''}
            {recap.most_improved_pct}%
          </div>
          <p className={styles.mid}>{recap.most_improved.display_name}</p>
          <p className={styles.sub}>{t('r_improved_sub')}</p>
        </>
      ),
    });
  }
  slides.push({
    bg: '#0D0D0D',
    fg: '#F2F2EE',
    body: (
      <>
        <p className={styles.kicker}>{t('r_event_kicker')}</p>
        {recap.weekly_event && (
          <div className={styles.huge} style={{ color: '#00D1FF' }}>
            {t('leg_event_name')}
          </div>
        )}
        <p className={styles.sub}>
          {recap.weekly_event ? t('weather_desc') : ''}{' '}
          {recap.bounty_target
            ? t('r_bounty', { n: recap.bounty_points, name: recap.bounty_target.display_name })
            : ''}
        </p>
        <ButtonLink to="/train" className={styles.cta} onClick={onClose}>
          {t('start_training')}
        </ButtonLink>
      </>
    ),
  });
  return slides;
}

/** Last week as story slides. The one place the loud display style is allowed. */
export function RecapStories({
  exercises,
  onClose,
}: {
  exercises: Exercise[];
  onClose: () => void;
}) {
  const { t } = useI18n();
  const recapQuery = useRecap(true);
  const recap = recapQuery.data;
  const [index, setIndex] = useState(0);
  const slides = useSlides(recap ?? EMPTY, exercises, onClose);
  const count = recap ? slides.length : 0;

  const step = useCallback(
    (delta: number) =>
      setIndex((i) => {
        const next = i + delta;
        if (next >= count) {
          onClose();
          return i;
        }
        return Math.max(0, next);
      }),
    [count, onClose],
  );

  useEffect(() => {
    if (!count || reducedMotion()) return;
    const id = setTimeout(() => step(1), SLIDE_MS);
    return () => clearTimeout(id);
  }, [index, count, step]);

  useEffect(() => {
    const root = document.getElementById('root');
    root?.setAttribute('inert', '');
    return () => root?.removeAttribute('inert');
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight') step(1);
      if (event.key === 'ArrowLeft') step(-1);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose, step]);

  const slide = recap ? slides[Math.min(index, slides.length - 1)] : undefined;
  const style = {
    '--bg': slide?.bg ?? '#0D0D0D',
    '--fg': slide?.fg ?? '#F2F2EE',
  } as CSSProperties;
  return createPortal(
    <div
      className={styles.story}
      style={style}
      role="dialog"
      aria-modal="true"
      aria-label={t('recap_head')}
    >
      <div className={styles.bars} aria-hidden="true">
        {slides.map((_, i) => (
          <i
            key={`${index}-${i}`}
            className={cx(i < index && styles.done, i === index && styles.current)}
          >
            <b />
          </i>
        ))}
      </div>
      <div className={styles.top}>
        <b>{t('recap_head')}</b>
        <button type="button" aria-label={t('close')} onClick={onClose} autoFocus>
          ×
        </button>
      </div>
      <div className={styles.slide} aria-live="polite">
        <div className={styles.zones}>
          <button type="button" aria-label={t('recap_prev')} onClick={() => step(-1)} />
          <button type="button" aria-label={t('recap_next')} onClick={() => step(1)} />
        </div>
        {slide ? (
          slide.body
        ) : recapQuery.isError ? (
          <ErrorBlock message="load_failed_generic" onRetry={() => void recapQuery.refetch()} />
        ) : (
          <LoadingBlock rows={2} />
        )}
      </div>
    </div>,
    document.body,
  );
}

const EMPTY: Recap = {
  week_start: '',
  crew_total: 0,
  biggest_climber: null,
  biggest_climber_points: 0,
  biggest_climber_workouts: 0,
  heaviest_pr: null,
  my_points: 0,
  my_workouts: 0,
  weekly_target: 3,
  my_volume_kg: 0,
  position_before: 1,
  position_after: 1,
  my_best_pr: null,
  most_improved: null,
  most_improved_pct: null,
  bounty_target: null,
  bounty_points: 0,
  weekly_event: null,
};
