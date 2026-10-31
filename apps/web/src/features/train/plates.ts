/** Plates per side for a barbell load. Pure UI math, not a game rule. */

export const BAR_KG = 20;
export const PLATE_KG = [25, 20, 15, 10, 5, 2.5, 1.25] as const;

export type PlateLoad = {
  /** Plates on one side, heaviest first. */
  perSide: number[];
  /** Total kg that standard plates can't make (both sides together). */
  leftoverKg: number;
};

export function platesPerSide(totalKg: number, barKg = BAR_KG): PlateLoad {
  let side = Math.max(0, (totalKg - barKg) / 2);
  const perSide: number[] = [];
  for (const plate of PLATE_KG) {
    while (side >= plate - 1e-9) {
      perSide.push(plate);
      side -= plate;
    }
  }
  return { perSide, leftoverKg: Math.round(side * 2 * 100) / 100 };
}

/** `[25, 25, 5]` → `[[25, 2], [5, 1]]` */
export function countPlates(perSide: number[]): [number, number][] {
  const counts = new Map<number, number>();
  for (const plate of perSide) counts.set(plate, (counts.get(plate) ?? 0) + 1);
  return [...counts.entries()];
}
