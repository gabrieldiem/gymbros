import type { Exercise, SetData } from '../../api/train';

/**
 * On a barbell lift the logger shows the disks, with the bar beside them. The API keeps the whole
 * weight in `load_kg`, bar included, because points, PRs and badges read it.
 */
export const DEFAULT_BAR_KG = 20;
export const BAR_OPTIONS_KG = [20, 15, 10] as const;

const round = (kg: number) => Math.round(kg * 100) / 100;

export const disksOf = (loadKg: number, barKg: number) => round(Math.max(0, loadKg - barKg));

export const loadOf = (disksKg: number, barKg: number) => round(disksKg + barKg);

/** The bar a card uses: the one on its sets, else the standard bar. */
export const barOf = (sets: SetData[]) =>
  sets.find((s) => s.bar_kg !== null && s.bar_kg !== undefined)?.bar_kg ?? DEFAULT_BAR_KG;

/** A different bar on every set: the disks stay, the whole weight changes. */
export function withBar(sets: SetData[], barKg: number): SetData[] {
  const current = barOf(sets);
  return sets.map((s) => ({
    ...s,
    bar_kg: barKg,
    load_kg: s.load_kg === null ? null : loadOf(disksOf(s.load_kg, current), barKg),
  }));
}

const hasValues = (set: SetData | undefined): set is SetData =>
  Boolean(set && (set.load_kg || set.reps || set.minutes || set.km));

/** What "repeat" copies into a row: the set above it, else that set last time. */
export function repeatSource(
  sets: SetData[],
  previous: SetData[],
  index: number,
): SetData | undefined {
  const above = sets[index - 1];
  if (hasValues(above)) return above;
  const last = previous[index];
  return hasValues(last) ? last : undefined;
}

/** `row` with the values of `source`, on the card's bar. Whether it's checked doesn't change. */
export function repeated(
  exercise: Exercise,
  row: SetData,
  source: SetData,
  barKg: number,
): SetData {
  const load =
    exercise.barbell && source.load_kg !== null
      ? loadOf(disksOf(source.load_kg, source.bar_kg ?? DEFAULT_BAR_KG), barKg)
      : source.load_kg;
  return {
    ...row,
    load_kg: load,
    bar_kg: exercise.barbell ? barKg : null,
    reps: source.reps,
    minutes: source.minutes,
    km: source.km,
  };
}
