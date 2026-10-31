import { useState } from 'react';

import type { MeStats } from '../../api/compete';
import { useI18n } from '../../i18n/context';
import { columnPath, niceMax } from './charts';
import styles from './Me.module.css';

const W = 360;
const H = 180;
const TOP = 24;
const BOTTOM = 26;
const BAR = 24;

/**
 * Weekly tonnage: one series, so no legend (the heading names it). Bars ≤24px with a rounded
 * data-end; only this week is labelled and accented; every bar has a hover/focus tooltip and the
 * numbers are also in a screen-reader table.
 */
export function TonnageChart({ weeks }: { weeks: MeStats['weekly_volume'] }) {
  const { t, n, lang } = useI18n();
  const [active, setActive] = useState<number | null>(null);
  const tonnes = weeks.map((w) => w.volume_kg / 1000);
  const max = niceMax(Math.max(...tonnes, 0));
  const slot = W / weeks.length;
  const plotH = H - TOP - BOTTOM;
  const label = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', {
      month: 'short',
      day: 'numeric',
    });
  const value = (tn: number) => n(Math.round(tn * 10) / 10);

  return (
    <div className={styles.chart}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('tonnage_title')}>
        <line className={styles.axis} x1="0" x2={W} y1={H - BOTTOM} y2={H - BOTTOM} />
        {weeks.map((week, i) => {
          const tn = tonnes[i] ?? 0;
          const h = (tn / max) * plotH;
          const x = i * slot + (slot - BAR) / 2;
          const y = H - BOTTOM - h;
          const current = i === weeks.length - 1;
          return (
            <g key={week.week_start}>
              <path
                className={current ? styles.current : styles.bar}
                d={columnPath(x, y, BAR, h)}
              />
              {current && tn > 0 && (
                <text className={styles.value} x={x + BAR / 2} y={y - 6} textAnchor="middle">
                  {value(tn)}
                </text>
              )}
              <text className={styles.tick} x={x + BAR / 2} y={H - 8} textAnchor="middle">
                {current ? t('this_wk') : label(week.week_start)}
              </text>
              <rect
                className={styles.hit}
                x={i * slot}
                y={TOP - 10}
                width={slot}
                height={plotH + 10}
                tabIndex={0}
                aria-label={t('tonnage_bar', { date: label(week.week_start), n: value(tn) })}
                onPointerEnter={() => setActive(i)}
                onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
              />
            </g>
          );
        })}
      </svg>
      {active !== null && weeks[active] && (
        <div
          className={styles.tooltip}
          style={{ left: `${((active + 0.5) / weeks.length) * 100}%` }}
          role="tooltip"
        >
          {t('tonnage_bar', {
            date: label(weeks[active].week_start),
            n: value(tonnes[active] ?? 0),
          })}
        </div>
      )}
      <table className="sr-only">
        <caption>{t('tonnage_title')}</caption>
        <tbody>
          {weeks.map((week, i) => (
            <tr key={week.week_start}>
              <th scope="row">{label(week.week_start)}</th>
              <td>{t('unit_t', { n: value(tonnes[i] ?? 0) })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
