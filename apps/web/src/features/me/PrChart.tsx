import { useState } from 'react';

import { useLiftHistory } from '../../api/compete';
import { ErrorBlock, LoadingBlock } from '../../components/QueryState';
import { useI18n } from '../../i18n/context';
import { niceMax } from './charts';
import styles from './Me.module.css';

const W = 360;
const H = 180;
const PAD = { top: 16, right: 40, bottom: 24, left: 8 };

/** Best e1RM per week for one lift: a 2px line with a 10% wash, end-labelled, crosshair tooltip. */
export function PrChart({ exerciseId }: { exerciseId: string }) {
  const { t, n, lang } = useI18n();
  const history = useLiftHistory(exerciseId);
  const points = history.data;
  const [active, setActive] = useState<number | null>(null);
  if (!points) {
    return history.isError ? (
      <ErrorBlock message="load_failed_generic" onRetry={() => void history.refetch()} />
    ) : (
      <LoadingBlock rows={1} />
    );
  }
  if (points.length < 2) return <p className={styles.muted}>{t('pr_chart_empty')}</p>;

  const values = points.map((p) => p.e1rm);
  const lo = Math.floor(Math.min(...values) * 0.95);
  const hi = niceMax(Math.max(...values));
  const x = (i: number) => PAD.left + (i / (points.length - 1)) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo || 1)) * (H - PAD.top - PAD.bottom);
  const line = points
    .map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.e1rm).toFixed(1)}`)
    .join(' ');
  const area = `${line} L${x(points.length - 1)} ${H - PAD.bottom} L${x(0)} ${H - PAD.bottom} Z`;
  const last = points[points.length - 1];
  const date = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', {
      month: 'short',
      day: 'numeric',
    });
  const nearest = (clientX: number, rect: DOMRect) => {
    const ratio = (clientX - rect.left) / rect.width;
    return Math.max(
      0,
      Math.min(
        points.length - 1,
        Math.round(((ratio * W - PAD.left) / (W - PAD.left - PAD.right)) * (points.length - 1)),
      ),
    );
  };
  const focus = active !== null ? points[active] : undefined;

  return (
    <div className={styles.chart}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={t('pr_chart_sub')}
        onPointerMove={(e) =>
          setActive(nearest(e.clientX, e.currentTarget.getBoundingClientRect()))
        }
        onPointerLeave={() => setActive(null)}
      >
        <line
          className={styles.axis}
          x1={PAD.left}
          x2={W - PAD.right}
          y1={H - PAD.bottom}
          y2={H - PAD.bottom}
        />
        <path className={styles.area} d={area} />
        <path className={styles.line} d={line} />
        {focus && active !== null && (
          <>
            <line
              className={styles.axis}
              x1={x(active)}
              x2={x(active)}
              y1={PAD.top}
              y2={H - PAD.bottom}
            />
            <circle className={styles.dot} cx={x(active)} cy={y(focus.e1rm)} r="5" />
          </>
        )}
        {last && (
          <>
            <circle className={styles.dot} cx={x(points.length - 1)} cy={y(last.e1rm)} r="5" />
            <text className={styles.value} x={x(points.length - 1) + 8} y={y(last.e1rm) + 4}>
              {n(last.e1rm)}
            </text>
          </>
        )}
        <text className={styles.tick} x={PAD.left} y={H - 6}>
          {date(points[0]?.week_start ?? '')}
        </text>
        <text className={styles.tick} x={W - PAD.right} y={H - 6} textAnchor="end">
          {date(last?.week_start ?? '')}
        </text>
      </svg>
      {focus && active !== null && (
        <div
          className={styles.tooltip}
          style={{ left: `${(x(active) / W) * 100}%` }}
          role="tooltip"
        >
          {date(focus.week_start)}: {t('e1rm', { n: n(focus.e1rm) })}
        </div>
      )}
      <table className="sr-only">
        <caption>{t('pr_chart_sub')}</caption>
        <tbody>
          {points.map((p) => (
            <tr key={p.week_start}>
              <th scope="row">{date(p.week_start)}</th>
              <td>{t('e1rm', { n: n(p.e1rm) })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
