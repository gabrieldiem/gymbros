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

/**
 * A set counts once it has reps (minutes for cardio and stretching). There's no box to tick, so
 * the numbers a routine loads are only suggestions, shown greyed out, until you log them.
 */
export const isLogged = (exercise: Exercise, set: SetData) =>
  exercise.type === 'c' || exercise.type === 's' ? Boolean(set.minutes) : Boolean(set.reps);

/** Loaded for you and not touched yet: shown as a hint, and worth nothing. */
export const isSuggestion = (set: SetData) => !set.done && !set.started && hasValues(set);

/** A number typed into a row. The row's other suggested number comes along with it. */
export function editSet(
  exercise: Exercise,
  set: SetData,
  field: keyof SetData,
  value: number | null,
  barKg: number,
): SetData {
  const next: SetData =
    exercise.barbell && field === 'load_kg'
      ? { ...set, load_kg: value === null ? null : loadOf(value, barKg), bar_kg: barKg }
      : { ...set, [field]: value };
  // Reps with nothing on the bar: that's the empty bar.
  if (exercise.barbell && next.reps && next.load_kg === null && field === 'reps') {
    next.load_kg = barKg;
    next.bar_kg = barKg;
  }
  return { ...next, started: true, done: isLogged(exercise, next) };
}

/** What the repeat button logs in a row: its own suggestion, else the set above, else last time. */
export function repeatSource(
  sets: SetData[],
  previous: SetData[],
  index: number,
): SetData | undefined {
  const own = sets[index];
  if (own && isSuggestion(own)) return own;
  const above = sets[index - 1];
  if (above?.done && hasValues(above)) return above;
  const last = previous[index];
  return hasValues(last) ? last : undefined;
}

/** `row` logged with the values of `source`, on the card's bar. */
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
  const next: SetData = {
    ...row,
    load_kg: load,
    bar_kg: exercise.barbell ? barKg : null,
    reps: source.reps,
    minutes: source.minutes,
    km: source.km,
    started: true,
  };
  return { ...next, done: isLogged(exercise, next) };
}

/** What the server takes: `started` only matters on this screen. */
export const forServer = (sets: SetData[]): SetData[] =>
  sets.map((set) => {
    const { load_kg, reps, minutes, km, done, bar_kg } = set;
    return { load_kg, reps, minutes, km, done, ...(bar_kg === undefined ? {} : { bar_kg }) };
  });
