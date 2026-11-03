import type { PostedExercise, WorkoutPostVars } from '../../api/social';

export type EditChange =
  | { kind: 'name'; from: string; to: string }
  | { kind: 'gym'; from: string | null; to: string | null }
  | { kind: 'points'; from: number; to: number }
  | { kind: 'added' | 'removed'; exercise: PostedExercise }
  | { kind: 'sets'; exercise: PostedExercise; before: PostedExercise };

const key = (exercise: PostedExercise) => exercise.custom_name ?? exercise.exercise_id;

/** What changed between how a post first went up and how it is now, biggest thing last. */
export function editChanges(post: WorkoutPostVars): EditChange[] {
  const was = post.original;
  if (!was) return [];
  const changes: EditChange[] = [];
  if (was.name !== post.name) changes.push({ kind: 'name', from: was.name, to: post.name });
  if ((was.gym ?? null) !== (post.gym ?? null)) {
    changes.push({ kind: 'gym', from: was.gym ?? null, to: post.gym ?? null });
  }
  const before = new Map(was.exercises.map((e) => [key(e), e]));
  const after = new Map(post.exercises.map((e) => [key(e), e]));
  for (const exercise of post.exercises) {
    const old = before.get(key(exercise));
    if (!old) changes.push({ kind: 'added', exercise });
    else if (JSON.stringify(old.sets) !== JSON.stringify(exercise.sets)) {
      changes.push({ kind: 'sets', exercise, before: old });
    }
  }
  for (const exercise of was.exercises) {
    if (!after.has(key(exercise))) changes.push({ kind: 'removed', exercise });
  }
  if (was.points !== post.points) {
    changes.push({ kind: 'points', from: was.points, to: post.points });
  }
  return changes;
}
