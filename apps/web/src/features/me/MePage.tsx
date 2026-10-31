import { useState } from 'react';

import { useMyStats, type MeStats } from '../../api/compete';
import { useMe } from '../../api/me';
import { useCatalog } from '../../api/train';
import { Avatar } from '../../components/Avatar';
import { cx } from '../../components/cx';
import { Pips } from '../../components/Pips';
import { ErrorBlock, LoadingBlock } from '../../components/QueryState';
import { Sheet } from '../../components/Sheet';
import { useI18n } from '../../i18n/context';
import type { MessageKey } from '../../i18n/en';
import { ordinal } from '../../i18n/ordinal';
import { timeAgo } from '../../i18n/timeAgo';
import { formatLift } from '../train/format';
import { heatLevel } from './charts';
import styles from './Me.module.css';
import { PrChart } from './PrChart';
import { SettingsSheet } from './SettingsSheet';
import { TonnageChart } from './TonnageChart';

const signed = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v);

function Heatmap({ days }: { days: MeStats['heatmap'] }) {
  const { t, lang } = useI18n();
  const label = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US');
  return (
    <div className={styles.heat} role="img" aria-label={t('heatmap_title')}>
      {days.map((d) => (
        <i
          key={d.day}
          className={cx(styles[`l${heatLevel(d.workouts)}`])}
          title={t('heatmap_day', { date: label(d.day), n: d.workouts })}
        />
      ))}
    </div>
  );
}

function RankLadder({ climb }: { climb: MeStats['climb'] }) {
  const { t, n } = useI18n();
  const camps = Math.round(climb.summit / climb.camp_step) + 1;
  const here = climb.me.camp;
  const next = climb.me.next_camp;
  return (
    <ol className={styles.ladder} reversed>
      {Array.from({ length: camps }, (_, i) => camps - 1 - i).map((camp) => (
        <li
          key={camp}
          className={cx(
            camp <= here && styles.got,
            camp === here && styles.here,
            camp === next?.camp && styles.next,
          )}
        >
          <i aria-hidden="true" />
          <span>{t(`rank_${camp}` as MessageKey)}</span>
          <span>
            {camp === here
              ? t('ladder_here')
              : camp === next?.camp
                ? t('ladder_next', { n: n(next.points_needed) })
                : t('pts_n', { n: n(camp * climb.camp_step) })}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function MePage() {
  const { t, n, lang } = useI18n();
  const me = useMe().data;
  const stats = useMyStats();
  const exercises = useCatalog().data?.exercises ?? [];
  const [settings, setSettings] = useState(false);
  const [chart, setChart] = useState<string | null>(null);
  const data = stats.data;
  if (!me || !data) {
    return stats.isError ? (
      <ErrorBlock message="stats_failed" onRetry={() => void stats.refetch()} />
    ) : (
      <LoadingBlock />
    );
  }
  const climb = data.climb;
  const exercise = (id: string) => exercises.find((e) => e.id === id);
  const imp = climb.improvement;
  const vsRows: [string, string, MessageKey][] = [
    [
      t('vs_strength'),
      imp.strength_pct === null ? '–' : `${signed(imp.strength_pct)}%`,
      'vs_detail_s',
    ],
    [t('vs_volume'), imp.volume_pct === null ? '–' : `${signed(imp.volume_pct)}%`, 'vs_detail_v'],
    [t('vs_workouts'), signed(imp.workouts_change), 'vs_detail_w'],
  ];

  return (
    <section aria-labelledby="page-title">
      <div className={styles.head}>
        <Avatar initials={me.initials} color={me.color} size={88} />
        <div className={styles.grow}>
          <h1 id="page-title">{me.display_name}</h1>
          <p className={styles.muted}>
            {t('me_rank', { o: ordinal(lang, climb.me.position) })},{' '}
            {t(`rank_${climb.me.camp}` as MessageKey)}
          </p>
          <p className={styles.weekRow}>
            <Pips done={climb.me.workouts_this_week} target={climb.weekly_target} />
            {t('pips_label', { n: climb.me.workouts_this_week, target: climb.weekly_target })}
          </p>
        </div>
        <button
          type="button"
          className={styles.gear}
          aria-label={t('settings')}
          onClick={() => setSettings(true)}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
          </svg>
        </button>
      </div>

      <div className={styles.stats}>
        <div>
          <b>{n(climb.me.points)}</b>
          <span>{t('total_pts')}</span>
        </div>
        <div>
          <b>{climb.me.goal_streak}</b>
          <span>{t('goal_streak')}</span>
        </div>
        <div>
          <b>{n(data.workouts_total)}</b>
          <span>{t('total_workouts')}</span>
        </div>
        <div>
          <b>{data.badges_unlocked}</b>
          <span>{t('badges_n')}</span>
        </div>
      </div>

      <div className={styles.grid}>
        <section aria-labelledby="vs-title">
          <h2 id="vs-title">{t('vs_title')}</h2>
          <ul className={styles.vsList}>
            {vsRows.map(([label, value, detail]) => (
              <li key={label}>
                <span>{label}</span>
                <b>{value}</b>
                <small>{t(detail)}</small>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="heat-title">
          <h2 id="heat-title">{t('heatmap_title')}</h2>
          <Heatmap days={data.heatmap} />
        </section>
        <section aria-labelledby="tonnage-title">
          <h2 id="tonnage-title">{t('tonnage_title')}</h2>
          <p className={styles.muted}>{t('tonnage_sub')}</p>
          <TonnageChart weeks={data.weekly_volume} />
        </section>
        <section aria-labelledby="prs-title">
          <h2 id="prs-title">{t('prs_title')}</h2>
          {data.prs.length === 0 && <p className={styles.muted}>{t('prs_empty')}</p>}
          <ul className={styles.prs}>
            {data.prs.slice(0, 8).map((pr) => (
              <li key={pr.exercise_id}>
                <button type="button" onClick={() => setChart(pr.exercise_id)}>
                  <span>
                    {exercise(pr.exercise_id)?.name ?? pr.exercise_id}
                    <small>{t('e1rm', { n: n(pr.e1rm) })}</small>
                  </span>
                  <b>{formatLift(exercise(pr.exercise_id), pr.load_kg, pr.reps, t, n)}</b>
                </button>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="ladder-title">
          <h2 id="ladder-title">{t('ladder_title')}</h2>
          <RankLadder climb={climb} />
        </section>
        <section aria-labelledby="history-title">
          <h2 id="history-title">{t('history_title')}</h2>
          {data.history.length === 0 && <p className={styles.muted}>{t('history_empty')}</p>}
          <ul className={styles.history}>
            {data.history.map((h) => (
              <li key={h.id}>
                <span>
                  {h.name}
                  <small>
                    {timeAgo(lang, h.finished_at)} ·{' '}
                    {t('history_row', { sets: h.sets, kg: n(h.volume_kg), min: h.duration_min })}
                  </small>
                </span>
                <b>+{n(h.points)}</b>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {settings && <SettingsSheet onClose={() => setSettings(false)} />}
      {chart && (
        <Sheet title={exercise(chart)?.name ?? chart} onClose={() => setChart(null)}>
          <p className={styles.muted}>{t('pr_chart_sub')}</p>
          <PrChart exerciseId={chart} />
        </Sheet>
      )}
    </section>
  );
}
