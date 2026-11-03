import { useState } from 'react';

import type { PostedExercise, WorkoutPostVars } from '../../api/social';
import type { Exercise } from '../../api/train';
import { useI18n } from '../../i18n/context';
import { editChanges, type EditChange } from './editChanges';
import styles from './Feed.module.css';
import { formatPostedSet } from './format';

type Props = { post: WorkoutPostVars; exercises: Exercise[] };

/** The Edited chip. Hover or tap it for what changed, since the crew saw the first numbers. */
export function EditedTag({ post, exercises }: Props) {
  const { t, n } = useI18n();
  const [open, setOpen] = useState(false);
  const known = (id: string) => exercises.find((e) => e.id === id);
  const name = (exercise: PostedExercise) =>
    exercise.custom_name ?? known(exercise.exercise_id)?.name ?? exercise.exercise_id;
  const sets = (exercise: PostedExercise) =>
    exercise.sets.map((s) => formatPostedSet(known(exercise.exercise_id), s, n, t)).join(', ');
  const nothing = t('edit_none');

  const line = (change: EditChange): string => {
    switch (change.kind) {
      case 'name':
        return t('edit_name', { from: change.from, to: change.to });
      case 'gym':
        return t('edit_gym', { from: change.from ?? nothing, to: change.to ?? nothing });
      case 'points':
        return t('edit_points', { from: n(change.from), to: n(change.to) });
      case 'added':
        return t('edit_added', { name: name(change.exercise), sets: sets(change.exercise) });
      case 'removed':
        return t('edit_removed', { name: name(change.exercise) });
      case 'sets':
        return t('edit_sets', {
          name: name(change.exercise),
          from: sets(change.before),
          to: sets(change.exercise),
        });
    }
  };

  const changes = editChanges(post);
  return (
    <span className={styles.editedWrap} data-open={open || undefined}>
      <button
        type="button"
        className={styles.edited}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {t('feed_edited')}
      </button>
      <div className={styles.editedInfo} role="group" aria-label={t('edit_what')}>
        {post.original ? (
          changes.length > 0 ? (
            <ul>
              {changes.map((change) => (
                <li key={line(change)}>{line(change)}</li>
              ))}
            </ul>
          ) : (
            <p>{t('edit_same')}</p>
          )
        ) : (
          <p>{t('edit_unknown')}</p>
        )}
      </div>
    </span>
  );
}
