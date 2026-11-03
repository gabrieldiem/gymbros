import { useState } from 'react';

import { useI18n } from '../../i18n/context';
import { formatDay } from '../../i18n/formatDay';
import { niceMax } from '../me/charts';
import styles from './Steps.module.css';

type Props = { days: { day: string; steps: number }[]; dailyCap: number };

const W = 360;
const H = 150;
const BOTTOM = 18;
const GAP = 4;

/** Your last two weeks, one column a day. The line is where more steps stop paying. */
export function StepsChart({ days, dailyCap }: Props) {
  const { t, n, lang } = useI18n();
  const [active, setActive] = useState<number | null>(null);
  const top = niceMax(Math.max(dailyCap, ...days.map((d) => d.steps)));
  const width = (W - GAP * (days.length - 1)) / days.length;
  const y = (steps: number) => (1 - steps / top) * (H - BOTTOM);
  const focus = active !== null ? days[active] : undefined;
  return (
    <div className={styles.chart}>
      <p className={styles.chartNote} aria-live="polite">
        {focus
          ? t('steps_on_day', { day: formatDay(lang, focus.day), n: n(focus.steps) })
          : t('steps_last_days')}
      </p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={t('steps_last_days')}
        onPointerLeave={() => setActive(null)}
      >
        <line className={styles.axis} x1="0" x2={W} y1={H - BOTTOM} y2={H - BOTTOM} />
        <line className={styles.cap} x1="0" x2={W} y1={y(dailyCap)} y2={y(dailyCap)} />
        {days.map((d, i) => {
          const x = i * (width + GAP);
          const height = Math.max(d.steps ? 4 : 0, H - BOTTOM - y(d.steps));
          const radius = Math.min(4, height / 2);
          const isToday = i === days.length - 1;
          return (
            <g key={d.day} onPointerEnter={() => setActive(i)}>
              {/* Bigger than the mark, so a finger finds it. */}
              <rect x={x} y="0" width={width + GAP} height={H} fill="transparent" />
              {height > 0 && (
                <path
                  className={isToday ? styles.barToday : styles.bar}
                  d={`M${x} ${H - BOTTOM}V${H - BOTTOM - height + radius}q0 -${radius} ${radius} -${radius}h${width - radius * 2}q${radius} 0 ${radius} ${radius}V${H - BOTTOM}z`}
                />
              )}
              <text className={styles.tick} x={x + width / 2} y={H - 5} textAnchor="middle">
                {Number(d.day.slice(-2))}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="sr-only">
        <table>
          <caption>{t('steps_last_days')}</caption>
          <tbody>
            {days.map((d) => (
              <tr key={d.day}>
                <th scope="row">{formatDay(lang, d.day)}</th>
                <td>{n(d.steps)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
