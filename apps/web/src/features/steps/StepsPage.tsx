import { CalendarDays, Footprints, Infinity as AllTime, Trash2 } from 'lucide-react';
import { lazy, Suspense, useState, type FormEvent } from 'react';

import type { Standing } from '../../api/climb';
import {
  useLogSteps,
  useRemoveSteps,
  useSteps,
  type StepsMode,
  type StepsPage as StepsData,
} from '../../api/steps';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { cx } from '../../components/cx';
import { FormError } from '../../components/FormError';
import { LoadingBlock, QueryState } from '../../components/QueryState';
import { Segmented } from '../../components/Segmented';
import { TextField } from '../../components/TextField';
import { useToast } from '../../components/toast';
import { useI18n } from '../../i18n/context';
import { formatDay } from '../../i18n/formatDay';
import { ClimbNav } from '../climb/ClimbNav';
import { TrailMap } from '../climb/TrailMap';
import { addDays, rangeIsFree, type DayRange } from './stepDates';
import styles from './Steps.module.css';
import { StepsChart } from './StepsChart';

const StepsCalendar = lazy(() => import('./StepsCalendar'));

/** The steps climb is the same mountain, with steps where the points go. */
const onTheMap = (data: StepsData): Standing[] =>
  data.standings.map((s) => ({
    ...s,
    points: s.steps,
    camp: 0,
    workouts_this_week: 0,
    goal_streak: 0,
    training_now: false,
  }));

function LogSteps({ data }: { data: StepsData }) {
  const { t, n, lang } = useI18n();
  const log = useLogSteps();
  const showToast = useToast();
  const [range, setRange] = useState<DayRange | null>(null);
  const [steps, setSteps] = useState('');
  const { today, taken_days: taken } = data;

  const presets: { label: string; range: DayRange }[] = [
    { label: t('steps_today'), range: { start: today, end: today } },
    { label: t('steps_yesterday'), range: { start: addDays(today, -1), end: addDays(today, -1) } },
    { label: t('steps_last_3'), range: { start: addDays(today, -2), end: today } },
  ];
  const count = Number(steps);
  const ready = range && Number.isInteger(count) && count > 0;
  const days = range
    ? Math.round((Date.parse(range.end) - Date.parse(range.start)) / 864e5) + 1
    : 0;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!range || !ready) return;
    log.mutate(
      { start_date: range.start, end_date: range.end, steps: count },
      {
        onSuccess: (entry) => {
          showToast(t('steps_logged', { n: n(entry.points) }));
          setRange(null);
          setSteps('');
        },
      },
    );
  };

  return (
    <section className={styles.log} aria-labelledby="log-steps-title">
      <h2 id="log-steps-title">{t('steps_log_title')}</h2>
      <div className={styles.presets} role="group" aria-label={t('steps_quick')}>
        {presets.map((preset) => {
          const on = range?.start === preset.range.start && range.end === preset.range.end;
          return (
            <button
              key={preset.label}
              type="button"
              aria-pressed={on}
              disabled={!rangeIsFree(preset.range, taken) || preset.range.start < data.earliest}
              onClick={() => setRange(preset.range)}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
      <Suspense fallback={<LoadingBlock rows={3} />}>
        <StepsCalendar
          value={range}
          onChange={setRange}
          today={today}
          earliest={data.earliest}
          taken={taken}
        />
      </Suspense>
      <p className={styles.chosen} role="status">
        {range
          ? days === 1
            ? formatDay(lang, range.start)
            : t('steps_period', {
                from: formatDay(lang, range.start),
                to: formatDay(lang, range.end),
                n: days,
              })
          : t('steps_pick_days')}
      </p>
      <form className={styles.form} onSubmit={handleSubmit}>
        <TextField
          label={days > 1 ? t('steps_total_label') : t('steps_label')}
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          value={steps}
          onChange={(e) => setSteps(e.target.value)}
        />
        <Button type="submit" icon={Footprints} disabled={!ready || log.isPending}>
          {t('steps_save')}
        </Button>
      </form>
      <p className={styles.rule}>
        {t('steps_rule', { per: n(data.steps_per_point), cap: n(data.daily_cap) })}
      </p>
      <FormError error={log.error} />
    </section>
  );
}

function Entries({ data }: { data: StepsData }) {
  const { t, n, lang } = useI18n();
  const remove = useRemoveSteps();
  if (data.entries.length === 0) return null;
  return (
    <section aria-labelledby="step-entries-title">
      <h2 id="step-entries-title">{t('steps_logged_title')}</h2>
      <ul className={styles.entries}>
        {data.entries.map((entry) => (
          <li key={entry.id}>
            <span>
              <b>{n(entry.steps)}</b>
              <small>
                {entry.start_date === entry.end_date
                  ? formatDay(lang, entry.start_date)
                  : `${formatDay(lang, entry.start_date)} – ${formatDay(lang, entry.end_date)}`}
              </small>
            </span>
            <span className={styles.entryPoints}>+{n(entry.points)}</span>
            {entry.removable ? (
              <button
                type="button"
                className={styles.remove}
                aria-label={t('steps_remove', { n: n(entry.steps) })}
                disabled={remove.isPending}
                onClick={() => remove.mutate(entry.id)}
              >
                <Trash2 size={18} aria-hidden="true" />
              </button>
            ) : (
              <span />
            )}
          </li>
        ))}
      </ul>
      <FormError error={remove.error} />
    </section>
  );
}

/** Steps for a day or a period, and the crew climbing by them. */
export function StepsPage() {
  const { t, n } = useI18n();
  const [mode, setMode] = useState<StepsMode>('week');
  const query = useSteps(mode);
  return (
    <section aria-labelledby="page-title">
      <ClimbNav />
      <div className={styles.head}>
        <h1 id="page-title">{t('steps_title')}</h1>
        <Segmented
          label={t('mode_label')}
          value={mode}
          onChange={setMode}
          options={[
            { value: 'week', label: t('mode_week'), icon: CalendarDays },
            { value: 'all', label: t('mode_all'), icon: AllTime },
          ]}
        />
      </div>
      <QueryState query={query} failed="steps_failed">
        {(data) => (
          <div className={styles.grid}>
            <div>
              <TrailMap
                key={mode}
                standings={onTheMap(data)}
                summit={data.summit}
                campStep={data.camp_step}
                campValue={(value) => t('steps_n', { n: n(value) })}
              />
              <ol className={styles.rope} aria-label={t('rope_order')}>
                {data.standings.map((s) => (
                  <li key={s.user_id} className={cx(s.is_me && styles.me)}>
                    <span className={styles.rank}>{s.position}</span>
                    <Avatar initials={s.initials} color={s.color} image={s.avatar_url} size={36} />
                    <b>{s.is_me ? `${s.display_name} (${t('you')})` : s.display_name}</b>
                    <span className={styles.total}>{n(s.steps)}</span>
                  </li>
                ))}
              </ol>
            </div>
            <aside className={styles.side}>
              <dl className={styles.stats}>
                <div>
                  <dd>{n(data.my_week)}</dd>
                  <dt>{t('steps_my_week')}</dt>
                </div>
                <div>
                  <dd>{n(data.my_best_day)}</dd>
                  <dt>{t('steps_best_day')}</dt>
                </div>
                <div>
                  <dd>{n(data.my_total)}</dd>
                  <dt>{t('steps_my_total')}</dt>
                </div>
              </dl>
              <LogSteps data={data} />
              <StepsChart days={data.last_days} dailyCap={data.daily_cap} />
              <Entries data={data} />
            </aside>
          </div>
        )}
      </QueryState>
    </section>
  );
}
