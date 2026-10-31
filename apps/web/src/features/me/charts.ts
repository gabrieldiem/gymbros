/** Small chart helpers (pure). */

/** A column with a 4px rounded data-end and a square baseline (dataviz mark spec). */
export function columnPath(
  x: number,
  y: number,
  width: number,
  height: number,
  radius = 4,
): string {
  if (height <= 0) return '';
  const r = Math.min(radius, width / 2, height);
  const bottom = y + height;
  return [
    `M${x} ${bottom}`,
    `V${y + r}`,
    `Q${x} ${y} ${x + r} ${y}`,
    `H${x + width - r}`,
    `Q${x + width} ${y} ${x + width} ${y + r}`,
    `V${bottom}`,
    'Z',
  ].join(' ');
}

/** A rounded "nice" ceiling for an axis: 18.6 → 20, 4 → 5, 0 → 1. */
export function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * magnitude >= value) ?? 10;
  return step * magnitude;
}

/** Heatmap level 0..3 for a day's workout count. */
export function heatLevel(workouts: number): 0 | 1 | 2 | 3 {
  if (workouts <= 0) return 0;
  return workouts === 1 ? 2 : 3;
}
