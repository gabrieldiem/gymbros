import { useState } from 'react';

import { useReact, type FeedItem, type ReactionKind, type WorkoutPostVars } from '../../api/social';
import type { Exercise } from '../../api/train';
import { Avatar } from '../../components/Avatar';
import { cx } from '../../components/cx';
import { useI18n } from '../../i18n/context';
import { timeAgo } from '../../i18n/timeAgo';
import { formatLift } from '../train/format';
import styles from './Feed.module.css';
import { formatPostedSet } from './format';
import { Thread } from './Thread';

const EMOJI: Record<ReactionKind, string> = { fist: '👊', fire: '🔥' };

/** A finished workout in the feed: stats, PRs, exercises, reactions and comments. */
export function FeedCard({ item, exercises }: { item: FeedItem; exercises: Exercise[] }) {
  const { t, n, lang } = useI18n();
  const react = useReact();
  const [open, setOpen] = useState(false);
  const v = item.vars as unknown as WorkoutPostVars;
  const exercise = (id: string) => exercises.find((e) => e.id === id);

  return (
    <li className={cx(styles.post, item.is_mine && styles.mine)}>
      <div className={styles.top}>
        <Avatar initials={item.actor.initials} color={item.actor.color} size={42} />
        <div className={styles.who}>
          <b>{item.is_mine ? t('you') : item.actor.display_name}</b>
          <span>{timeAgo(lang, item.created_at)}</span>
        </div>
        <span className={styles.pts}>+{n(v.points)}</span>
      </div>
      <h3>{v.name}</h3>
      <div className={styles.chips}>
        <span>{t('min_n', { n: v.duration_min })}</span>
        <span>{v.sets === 1 ? t('sets_1') : t('sets_n', { n: v.sets })}</span>
        {v.volume_kg > 0 && <span>{t('kg_n', { n: n(v.volume_kg) })}</span>}
        {v.cardio_minutes > 0 && <span>{t('cardio_min', { n: v.cardio_minutes })}</span>}
        {v.vs_last_pct !== null && v.vs_last_pct > 0 && (
          <span className={styles.up}>{t('vol_vs', { n: v.vs_last_pct })}</span>
        )}
      </div>
      {v.prs.map((pr) => (
        <p key={pr.exercise_id} className={styles.pr}>
          ★{' '}
          {t('new_pr', {
            x: `${exercise(pr.exercise_id)?.name ?? pr.exercise_id} ${formatLift(exercise(pr.exercise_id), pr.load_kg, pr.reps, t, n)}`,
          })}
        </p>
      ))}
      <details className={styles.details}>
        <summary>{t('show_ex')}</summary>
        <ul className={styles.exercises}>
          {v.exercises.map((e) => (
            <li key={e.exercise_id}>
              <span>{exercise(e.exercise_id)?.name ?? e.exercise_id}</span>
              <span>
                {e.sets.map((s) => formatPostedSet(exercise(e.exercise_id), s, n)).join(', ')}
              </span>
            </li>
          ))}
        </ul>
      </details>
      <div className={styles.reacts}>
        {item.is_mine ? (
          <span className={styles.counts}>
            👊 {item.reactions.fist} &nbsp; 🔥 {item.reactions.fire}
          </span>
        ) : (
          (['fist', 'fire'] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              aria-pressed={item.reactions.mine.includes(kind)}
              aria-label={`${t(kind)}, ${item.reactions[kind]}`}
              onClick={() => react.mutate({ itemId: item.id, kind })}
            >
              {EMOJI[kind]} <span>{item.reactions[kind]}</span>
            </button>
          ))
        )}
        <button
          type="button"
          aria-expanded={open}
          aria-label={t('comments_n', { n: item.comments.length })}
          onClick={() => setOpen((o) => !o)}
        >
          💬 <span>{item.comments.length}</span>
        </button>
      </div>
      {open && <Thread itemId={item.id} comments={item.comments} />}
    </li>
  );
}
