import { describe, expect, it } from 'vitest';
import { buildCrossSection } from '../crossSectionBuilder';
import { getProfile } from '../../profiles/euSteelProfiles';
import type { Curve2D } from '../../geometry';

function startOf(c: Curve2D) {
  if (c.kind === 'circle') throw new Error('circle has no start');
  return c.startPoint;
}

function endOf(c: Curve2D) {
  if (c.kind === 'circle') throw new Error('circle has no end');
  return c.endPoint;
}

describe('IShape outline', () => {
  const ipe300 = getProfile('IPE300')!;
  const section = buildCrossSection(ipe300.shape);
  const curves = [...section.outerCurves];

  it('has the expected curve count for fillet>0/toe=0 (EN parallel-flange path)', () => {
    // 3 (bottom-left) + 1 (left web) + 3 (top-left) + 1 (top edge)
    // + 3 (top-right) + 1 (right web) + 3 (bottom-right) + 1 (bottom edge)
    expect(curves).toHaveLength(16);
  });

  it('forms a continuous closed loop', () => {
    for (let i = 0; i < curves.length; i++) {
      const prev = curves[(i + curves.length - 1) % curves.length];
      const gap = startOf(curves[i]).distanceTo(endOf(prev));
      expect(gap).toBeLessThan(1e-9);
    }
  });

  it('has the catalog bounding box', () => {
    const box = section.boundingBox;
    expect(box.min.x).toBeCloseTo(-75, 9); // flangeWidth 150
    expect(box.max.x).toBeCloseTo(75, 9);
    expect(box.min.y).toBeCloseTo(-150, 9); // height 300
    expect(box.max.y).toBeCloseTo(150, 9);
  });

  it('centers the section on the origin', () => {
    expect(section.centroid.x).toBeCloseTo(0, 9);
    expect(section.centroid.y).toBeCloseTo(0, 9);
  });
});
