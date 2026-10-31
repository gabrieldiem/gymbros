import type { Exercise } from '../../api/train';

/** Lower-case and strip accents so "jalon" finds "jalón". */
export function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Exercises whose English name or Spanish alias contains the query. Empty query → all. */
export function searchExercises(exercises: Exercise[], query: string): Exercise[] {
  const q = normalize(query);
  if (!q) return exercises;
  return exercises.filter(
    (e) =>
      normalize(e.name).includes(q) || e.aliases_es.some((alias) => normalize(alias).includes(q)),
  );
}
