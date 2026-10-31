import { useMemo } from 'react';

import type { Standing } from '../../api/climb';
import type { CrewColor } from '../../api/types';
import { cx } from '../../components/cx';
import { useI18n } from '../../i18n/context';
import type { MessageKey } from '../../i18n/en';
import { buildContours, buildTrail, markerOffsets, TRAIL_D, VIEW_H, VIEW_W } from './trail';
import styles from './TrailMap.module.css';
import { useClimbAnimation } from './useClimbAnimation';

const TRAIL = buildTrail();
const CONTOURS = buildContours();
const CAMPS = 7;
const COLORS: Record<CrewColor, string> = {
  volt: '#FFE600',
  red: '#FF3B1F',
  cyan: '#00D1FF',
  pink: '#FF4FD8',
  violet: '#B48CFF',
};

type Props = {
  standings: Standing[];
  summit: number;
  campStep: number;
  /** Your all-time fraction before the workout you just finished, to animate the climb. */
  climbFrom?: number | undefined;
  onClimbDone?: (() => void) | undefined;
};

function Camps({ campStep }: { campStep: number }) {
  const { t, n } = useI18n();
  return (
    <g>
      {Array.from({ length: CAMPS }, (_, i) => {
        const p = TRAIL.pointAt(i / (CAMPS - 1));
        const name = t(`rank_${i}` as MessageKey);
        const pts = t('pts_n', { n: n(campStep * i) });
        if (i === CAMPS - 1) {
          return (
            <g key={i}>
              <path d={`M${p.x} ${p.y + 2}V${p.y - 36}`} stroke="#F2F2EE" strokeWidth="3" />
              <path d={`M${p.x} ${p.y - 36}h26l-7 8 7 8h-26z`} fill="#FF3B1F" />
              <text className={cx(styles.campName, styles.summitName)} x={p.x + 34} y={p.y - 18}>
                {name}
              </text>
              <text className={styles.campPts} x={p.x + 34} y={p.y - 2}>
                {pts}
              </text>
            </g>
          );
        }
        const right = p.x < 330;
        const tx = right ? p.x + 16 : p.x - 16;
        const anchor = right ? 'start' : 'end';
        return (
          <g key={i}>
            <rect
              className={styles.campDot}
              x={p.x - 6}
              y={p.y - 6}
              width="12"
              height="12"
              transform={`rotate(45 ${p.x} ${p.y})`}
            />
            <text className={styles.campName} x={tx} y={p.y - 1} textAnchor={anchor}>
              {name}
            </text>
            <text className={styles.campPts} x={tx} y={p.y + 14} textAnchor={anchor}>
              {pts}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/** The topographic trail map with every member's marker placed by points. */
export function TrailMap({ standings, summit, campStep, climbFrom, onClimbDone }: Props) {
  const { t, n } = useI18n();
  const targets = useMemo(
    () => Object.fromEntries(standings.map((s) => [s.user_id, Math.min(1, s.points / summit)])),
    [standings, summit],
  );
  const me = standings.find((s) => s.is_me);
  const climbing = climbFrom !== undefined && me !== undefined;
  const shown = useClimbAnimation(targets, {
    introFrom: 0,
    startFrom: climbing ? { [me.user_id]: climbFrom } : undefined,
    durationMs: climbing ? 2400 : 1700,
    delayMs: climbing ? 450 : 900,
    onDone: climbing ? onClimbDone : undefined,
  });
  const offsets = markerOffsets(
    TRAIL,
    standings.map((s) => targets[s.user_id] ?? 0),
  );
  const drawOrder = [...standings.keys()].sort(
    (a, b) => Number(standings[a]?.is_me) - Number(standings[b]?.is_me),
  );
  const myFraction = me ? (shown[me.user_id] ?? 0) : 0;
  const summary = standings
    .map((s) => t('map_entry', { name: s.display_name, n: n(s.points) }))
    .join(', ');

  return (
    <div className={styles.wrap}>
      <svg
        className={styles.map}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        role="img"
        aria-label={t('climb_map', { summary })}
      >
        <defs>
          <radialGradient id="climb-glow" cx="55%" cy="8%" r="80%">
            <stop offset="0" stopColor="#1C1C14" />
            <stop offset=".6" stopColor="#0D0D0D" />
            <stop offset="1" stopColor="#080808" />
          </radialGradient>
          <mask
            id="climb-reveal"
            maskUnits="userSpaceOnUse"
            x="0"
            y="0"
            width={VIEW_W}
            height={VIEW_H}
          >
            <path
              className={cx(styles.reveal, styles.revealing)}
              d={TRAIL_D}
              pathLength={1}
              stroke="#fff"
              strokeWidth="16"
              fill="none"
            />
          </mask>
        </defs>
        <rect width={VIEW_W} height={VIEW_H} fill="url(#climb-glow)" />
        <g aria-hidden="true">
          {CONTOURS.map((c, i) => (
            <path key={i} className={cx(styles.contour, c.index && styles.index)} d={c.d} />
          ))}
        </g>
        <g mask="url(#climb-reveal)">
          <path className={styles.trail} d={TRAIL_D} />
        </g>
        {me && (
          <path
            className={styles.trailYou}
            d={TRAIL_D}
            pathLength={1}
            strokeDashoffset={1 - myFraction}
          />
        )}
        <Camps campStep={campStep} />
        <g aria-hidden="true">
          {drawOrder.map((index) => {
            const s = standings[index];
            if (!s) return null;
            const f = shown[s.user_id] ?? 0;
            const target = targets[s.user_id] ?? 0;
            const settled = Math.abs(f - target) < 1e-6 ? 1 : 0;
            const p = TRAIL.pointAt(f);
            const nrm = TRAIL.normalAt(f);
            const o = (offsets[index] ?? 0) * settled;
            return (
              <g
                key={s.user_id}
                className={cx(styles.marker, s.is_me && styles.me)}
                transform={`translate(${(p.x + nrm.x * o).toFixed(1)} ${(p.y + nrm.y * o).toFixed(1)})`}
              >
                {s.is_me && <circle className={styles.halo} r="27" />}
                <circle className={styles.body} r="17" fill={COLORS[s.color]} />
                <text>{s.initials}</text>
                {s.training_now && <circle className={styles.live} cx="13" cy="-13" r="6" />}
                {s.is_me && (
                  <text className={styles.tag} y="-35">
                    {t('you').toUpperCase()}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
      <div className={styles.title} aria-hidden="true">
        {t('climb_title')}
      </div>
    </div>
  );
}
