/** How far a pull has to travel, after resistance, before letting go refreshes. */
export const PULL_TRIGGER = 64;
const PULL_MAX = 96;
const RESISTANCE = 0.5;

/** The indicator's travel for a finger that has moved `dy` px down: slower than the finger, and
 * capped, so it feels like pulling against something. */
export function pullOffset(dy: number): number {
  return dy <= 0 ? 0 : Math.min(PULL_MAX, dy * RESISTANCE);
}

/** A pull only starts at the very top of the page, outside sheets, maps and inert content. */
export function canStartPull(target: EventTarget | null, scrollY: number): boolean {
  if (scrollY > 0 || !(target instanceof Element)) return false;
  if (target.closest('[inert], [role="dialog"], .leaflet-container')) return false;
  return Boolean(target.closest('#root'));
}
