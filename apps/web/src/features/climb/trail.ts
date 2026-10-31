/**
 * ATUS Climb map geometry, ported from the prototype. Pure TypeScript (no DOM measuring) so
 * marker placement is deterministic and testable: the trail is sampled into an arc-length table.
 */

export type Point = { x: number; y: number };

export const VIEW_W = 600;
export const VIEW_H = 800;
export const TRAIL_D =
  'M 90 770 C 250 765, 470 735, 470 668 S 170 615, 155 548 S 430 488, 452 425 S 255 355, 235 305 S 395 245, 400 198 S 315 140, 330 82';

type Cubic = [Point, Point, Point, Point];

/** Parse an absolute M/C/S path into cubic segments (S reflects the previous control point). */
export function parseCubicPath(d: string): Cubic[] {
  const tokens = d.match(/[MCS]|-?\d*\.?\d+/g) ?? [];
  const segments: Cubic[] = [];
  let i = 0;
  let current: Point = { x: 0, y: 0 };
  let lastControl: Point = current;
  const point = (): Point => ({ x: Number(tokens[i++]), y: Number(tokens[i++]) });
  while (i < tokens.length) {
    const command = tokens[i++];
    if (command === 'M') {
      current = point();
      lastControl = current;
    } else if (command === 'C' || command === 'S') {
      const c1 =
        command === 'C'
          ? point()
          : { x: 2 * current.x - lastControl.x, y: 2 * current.y - lastControl.y };
      const c2 = point();
      const end = point();
      segments.push([current, c1, c2, end]);
      lastControl = c2;
      current = end;
    }
  }
  return segments;
}

function cubicAt([p0, p1, p2, p3]: Cubic, t: number): Point {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const e = t * t * t;
  return {
    x: a * p0.x + b * p1.x + c * p2.x + e * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + e * p3.y,
  };
}

export type Trail = {
  pointAt: (fraction: number) => Point;
  normalAt: (fraction: number) => Point;
  length: number;
};

/** Sample the path densely and look points up by fraction of arc length. */
export function buildTrail(d: string = TRAIL_D, samplesPerSegment = 120): Trail {
  const points: Point[] = [];
  for (const segment of parseCubicPath(d)) {
    for (let s = points.length ? 1 : 0; s <= samplesPerSegment; s++) {
      points.push(cubicAt(segment, s / samplesPerSegment));
    }
  }
  const lengths = [0];
  for (let k = 1; k < points.length; k++) {
    const a = points[k - 1] as Point;
    const b = points[k] as Point;
    lengths.push((lengths[k - 1] as number) + Math.hypot(b.x - a.x, b.y - a.y));
  }
  const total = lengths[lengths.length - 1] as number;

  const pointAt = (fraction: number): Point => {
    const target = Math.max(0, Math.min(1, fraction)) * total;
    let lo = 0;
    let hi = lengths.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if ((lengths[mid] as number) < target) lo = mid;
      else hi = mid;
    }
    const span = (lengths[hi] as number) - (lengths[lo] as number) || 1;
    const k = (target - (lengths[lo] as number)) / span;
    const a = points[lo] as Point;
    const b = points[hi] as Point;
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
  };

  const normalAt = (fraction: number): Point => {
    const a = pointAt(fraction - 0.004);
    const b = pointAt(fraction + 0.004);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const m = Math.hypot(dx, dy) || 1;
    return { x: -dy / m, y: dx / m };
  };

  return { pointAt, normalAt, length: total };
}

const MIN_GAP = 34;
const STEP = 32;
const MAX_TRIES = 6;

/**
 * Offsets along each marker's normal so markers at similar points don't overlap. Markers are
 * placed in the given order (rope order); later ones move aside, alternating sides.
 */
export function markerOffsets(trail: Trail, fractions: number[]): number[] {
  const placed: Point[] = [];
  return fractions.map((f) => {
    const p = trail.pointAt(f);
    const n = trail.normalAt(f);
    const clash = (o: number) =>
      placed.some((q) => Math.hypot(q.x - (p.x + n.x * o), q.y - (p.y + n.y * o)) < MIN_GAP);
    let offset = 0;
    for (let tries = 1; clash(offset) && tries <= MAX_TRIES; tries++) {
      offset = (tries % 2 ? 1 : -1) * Math.ceil(tries / 2) * STEP;
    }
    placed.push({ x: p.x + n.x * offset, y: p.y + n.y * offset });
    return offset;
  });
}

/** A wobbly closed contour line around (cx, cy), as in the prototype. */
export function contour(
  cx: number,
  cy: number,
  r: number,
  k: number,
  sx = 1.15,
  sy = 0.78,
): string {
  let d = '';
  for (let i = 0; i <= 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    const w =
      1 +
      0.1 * Math.sin(3 * a + k * 0.9) +
      0.06 * Math.sin(5 * a - k * 0.5) +
      0.04 * Math.sin(7 * a + k * 1.7);
    d += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * r * w * sx).toFixed(1)} ${(cy + Math.sin(a) * r * w * sy).toFixed(1)}`;
  }
  return `${d}Z`;
}

export type Contour = { d: string; index: boolean };

/** The terrain: two far hills and the main mountain (every 5th line is an index contour). */
export function buildContours(): Contour[] {
  const lines: Contour[] = [];
  for (let k = 0; k < 6; k++)
    lines.push({ d: contour(70, 330, 16 + k * 26, k + 3, 1, 0.9), index: false });
  for (let k = 0; k < 5; k++)
    lines.push({ d: contour(560, 580, 18 + k * 28, k + 7, 0.9, 1), index: false });
  for (let k = 0; k < 19; k++)
    lines.push({ d: contour(330, 78 + k * 20, 16 + k * 37, k), index: k % 5 === 4 });
  return lines;
}
