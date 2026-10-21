// The bore of a hollow section must be a rounded rectangle — not a self-intersecting star.
//
// Regression: the four inner corner arcs were once flagged COUNTER-clockwise. Tessellation follows
// the flag, so every inner corner swept 270° the long way round and showed up as inverted radii in
// the section previews. Snapshots only compare against stored values, so these tests pin the
// GEOMETRY instead, which is what actually has to be right.
import { describe, expect, it } from 'vitest';
import { buildRectangularHollowInner, buildRectangularHollowOuter } from './rectangularHollowCurves';
import type { RectangularHollow } from '../../shapes/profileShape';

/** SHS 100×100×5, r_out 12 → bore 90×90 with r_in 7. */
const SHS: RectangularHollow = {
  kind: 'rectHollow',
  width: 100,
  height: 100,
  wallThickness: 5,
  outerCornerRadius: 12,
};

const arcsOf = (curves: ReturnType<typeof buildRectangularHollowOuter>) =>
  curves.filter((c): c is Extract<typeof c, { kind: 'arc' }> => c.kind === 'arc');

describe('rectangular hollow section', () => {
  it('turns each inner corner through a quarter-circle, the short way', () => {
    const arcs = arcsOf(buildRectangularHollowInner(SHS)[0]);
    expect(arcs).toHaveLength(4);
    for (const arc of arcs) {
      // Clockwise quarter-turn: -90°, NOT +270° (the long way round, which self-intersects).
      expect(arc.sweepAngle).toBeCloseTo(-Math.PI / 2, 9);
      expect(arc.isCounterClockwise).toBe(false);
    }
  });

  it('turns each outer corner through a quarter-circle too (the outer was never wrong)', () => {
    const arcs = arcsOf(buildRectangularHollowOuter(SHS));
    expect(arcs).toHaveLength(4);
    for (const arc of arcs) {
      expect(arc.sweepAngle).toBeCloseTo(Math.PI / 2, 9);
      expect(arc.isCounterClockwise).toBe(true);
    }
  });

  it('keeps every bore point inside the bore (a long-way corner would bulge past it)', () => {
    const inner = buildRectangularHollowInner(SHS)[0];
    const halfW = SHS.width / 2 - SHS.wallThickness; // 45
    const halfH = SHS.height / 2 - SHS.wallThickness;
    for (const curve of inner) {
      for (let t = 0; t <= 1; t += 0.05) {
        const p = curve.pointAt(t);
        expect(Math.abs(p.x)).toBeLessThanOrEqual(halfW + 1e-9);
        expect(Math.abs(p.y)).toBeLessThanOrEqual(halfH + 1e-9);
      }
    }
  });

  it('walks the bore head-to-tail as one closed loop', () => {
    const inner = buildRectangularHollowInner(SHS)[0];
    for (let i = 0; i < inner.length; i++) {
      const a = inner[i];
      const b = inner[(i + 1) % inner.length];
      if (a.kind === 'circle' || b.kind === 'circle') throw new Error('a box bore has no full circles');
      const end = a.endPoint;
      const start = b.startPoint;
      expect(start.x).toBeCloseTo(end.x, 9);
      expect(start.y).toBeCloseTo(end.y, 9);
    }
  });

  it('encloses the right area: outer box minus bore, corners rounded', () => {
    // Shoelace over a fine tessellation of the bore; a 270° corner would fold the loop and
    // collapse (or invert) this area.
    const inner = buildRectangularHollowInner(SHS)[0];
    const pts: { x: number; y: number }[] = [];
    for (const curve of inner) {
      for (let t = 0; t < 1; t += 0.01) pts.push(curve.pointAt(t));
    }
    let a2 = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const q = pts[(i + 1) % pts.length];
      a2 += p.x * q.y - q.x * p.y;
    }
    const area = Math.abs(a2) / 2;
    // 90×90 bore with 7 mm corner radii: 8100 − (4 − π)·7² ≈ 8058.
    const expected = 90 * 90 - (4 - Math.PI) * 7 * 7;
    expect(area).toBeGreaterThan(expected * 0.999);
    expect(area).toBeLessThan(expected * 1.001);
  });
});
