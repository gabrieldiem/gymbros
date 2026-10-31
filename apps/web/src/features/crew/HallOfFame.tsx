import { useMe } from '../../api/me';
import { useHallOfFame, type HallOfFame as Hof } from '../../api/social';
import type { Exercise } from '../../api/train';
import { Avatar } from '../../components/Avatar';
import { cx } from '../../components/cx';
import { useI18n } from '../../i18n/context';
import { formatLift } from '../train/format';
import styles from './HallOfFame.module.css';

const PLACES = ['first', 'second', 'third'] as const;

function Podium({ improved }: { improved: Hof['most_improved'] }) {
  const { t } = useI18n();
  // Visual order: 2nd, 1st, 3rd.
  const order = [1, 0, 2].filter((i) => improved[i]);
  return (
    <ol className={styles.podium}>
      {order.map((i) => {
        const entry = improved[i];
        if (!entry) return null;
        const sign = entry.pct > 0 ? '+' : '';
        return (
          <li
            key={entry.member.user_id}
            className={styles[PLACES[i] ?? 'third']}
            aria-label={`${i + 1}`}
          >
            <Avatar
              initials={entry.member.initials}
              color={entry.member.color}
              size={i === 0 ? 60 : 46}
            />
            <b>{entry.member.display_name}</b>
            <span className={styles.val}>
              {sign}
              {entry.pct}%
            </span>
            <div className={styles.step} aria-hidden="true">
              {i + 1}
            </div>
          </li>
        );
      })}
      {improved.length === 0 && <li className={styles.empty}>{t('most_improved_empty')}</li>}
    </ol>
  );
}

function RecordValue({ record, exercises }: { record: Hof['records'][0]; exercises: Exercise[] }) {
  const { t, n } = useI18n();
  const v = record.vars;
  if (record.key === 'rec_heaviest') {
    const exercise = exercises.find((e) => e.id === v.exercise_id);
    return <>{formatLift(exercise, Number(v.load_kg), Number(v.reps), t, n)}</>;
  }
  if (record.key === 'rec_streak') return <>{t('weeks_n', { n: Number(v.n) })}</>;
  return <>{t('pts_n', { n: n(Number(v.n)) })}</>;
}

function recordTitle(
  record: Hof['records'][0],
  exercises: Exercise[],
  t: ReturnType<typeof useI18n>['t'],
) {
  if (record.key === 'rec_heaviest') {
    const name =
      exercises.find((e) => e.id === record.vars.exercise_id)?.name ??
      String(record.vars.exercise_id);
    return t('rec_heaviest', { exercise: name });
  }
  return record.key === 'rec_streak' ? t('rec_streak') : t('rec_session');
}

/** Most improved (podium) and crew records. */
export function HallOfFame({ exercises }: { exercises: Exercise[] }) {
  const { t } = useI18n();
  const hof = useHallOfFame();
  const myId = useMe().data?.id;
  if (!hof.data) return <p role="status">{t('loading')}</p>;
  return (
    <div className={styles.hof}>
      <section className={cx(styles.panel)} aria-labelledby="improved-title">
        <h2 id="improved-title">{t('most_improved')}</h2>
        <p className={styles.sub}>{t('most_improved_sub')}</p>
        <Podium improved={hof.data.most_improved} />
      </section>
      <section className={styles.panel} aria-labelledby="records-title">
        <h2 id="records-title">{t('records')}</h2>
        <p className={styles.sub}>{t('records_sub')}</p>
        {hof.data.records.length === 0 && <p className={styles.empty}>{t('records_empty')}</p>}
        <ul className={styles.records}>
          {hof.data.records.map((record) => (
            <li key={`${record.key}-${String(record.vars.exercise_id ?? '')}`}>
              <span>{recordTitle(record, exercises, t)}</span>
              <b>
                <RecordValue record={record} exercises={exercises} />
              </b>
              <span className={styles.holder}>
                <Avatar initials={record.holder.initials} color={record.holder.color} size={24} />
                {record.holder.user_id === myId ? t('you_hold') : record.holder.display_name}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
