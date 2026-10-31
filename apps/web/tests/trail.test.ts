import { describe, expect, it } from 'vitest';

import {
  buildContours,
  buildTrail,
  markerOffsets,
  parseCubicPath,
} from '../src/features/climb/trail';

describe('trail geometry', () => {
  const trail = buildTrail();

  it('parses M, C and S commands with reflected control points', () => {
    const segments = parseCubicPath('M 0 0 C 10 0, 20 10, 30 10 S 50 20, 60 20');
    expect(segments).toHaveLength(2);
    expect(segments[1]?.[1]).toEqual({ x: 40, y: 10 });
  });

  it('starts at the bottom (Rookie) and ends at the summit', () => {
    expect(trail.pointAt(0)).toEqual({ x: 90, y: 770 });
    const top = trail.pointAt(1);
    expect(top.x).toBeCloseTo(330, 5);
    expect(top.y).toBeCloseTo(82, 5);
  });

  it('clamps fractions outside 0..1', () => {
    expect(trail.pointAt(-1)).toEqual(trail.pointAt(0));
    expect(trail.pointAt(2)).toEqual(trail.pointAt(1));
  });

  it('moves mostly upwards as points grow', () => {
    expect(trail.pointAt(0.75).y).toBeLessThan(trail.pointAt(0.25).y);
  });

  it('returns unit normals', () => {
    const n = trail.normalAt(0.5);
    expect(Math.hypot(n.x, n.y)).toBeCloseTo(1, 6);
  });

  it('nudges overlapping markers apart, alternating sides', () => {
    // 32-unit steps against a 34-unit clearance: the first step never clears (as in the prototype).
    expect(markerOffsets(trail, [0.4, 0.4, 0.4])).toEqual([0, 64, -64]);
    expect(markerOffsets(trail, [0.1, 0.9])).toEqual([0, 0]);
  });

  it('draws 30 contour lines with every fifth main line as an index line', () => {
    const lines = buildContours();
    expect(lines).toHaveLength(30);
    expect(lines.filter((l) => l.index)).toHaveLength(3);
    expect(lines[0]?.d.startsWith('M')).toBe(true);
  });
});
