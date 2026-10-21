import { describe, expect, it } from 'vitest';
import { ALL_STEEL_PROFILES, buildCrossSection, getProfile } from '.';
import { polygonArea, tessellateOutline } from './tessellate';

describe('tessellateOutline on IPE300', () => {
  const section = buildCrossSection(getProfile('IPE300')!.shape);
  const polygon = tessellateOutline(section.outerCurves);

  it('produces a clockwise polygon with no duplicate joints', () => {
    expect(polygon.length).toBeGreaterThan(20);
    expect(polygonArea(polygon)).toBeLessThan(0); // outlines are authored clockwise
    for (let i = 0; i < polygon.length; i++) {
      const [x1, y1] = polygon[i];
      const [x2, y2] = polygon[(i + 1) % polygon.length];
      expect(Math.abs(x1 - x2) + Math.abs(y1 - y2)).toBeGreaterThan(1e-9);
    }
  });

  it('matches the published IPE300 section area within tessellation error', () => {
    // EN 10365 lists A = 53.8 cm² = 5380 mm² for IPE300.
    const area = Math.abs(polygonArea(polygon));
    expect(area).toBeGreaterThan(5380 * 0.99);
    expect(area).toBeLessThan(5380 * 1.01);
  });
});

describe('tessellateOutline on fillet arcs stored against the outline', () => {
  const distinct = (polygon: [number, number][]) =>
    new Set(polygon.map(([x, y]) => `${x.toFixed(6)},${y.toFixed(6)}`)).size === polygon.length;

  it('walks UPE200 once round, with the published area', () => {
    const polygon = tessellateOutline(buildCrossSection(getProfile('UPE200')!.shape).outerCurves);
    expect(distinct(polygon)).toBe(true);
    // EN 10365 lists A = 29.0 cm² for UPE200.
    const area = Math.abs(polygonArea(polygon));
    expect(area).toBeGreaterThan(2900 * 0.99);
    expect(area).toBeLessThan(2900 * 1.01);
  });

  it('never revisits a point on any UPE or PFC', () => {
    for (const profile of ALL_STEEL_PROFILES.filter((p) => p.category === 'UPE' || p.category === 'PFC')) {
      const polygon = tessellateOutline(buildCrossSection(profile.shape).outerCurves);
      expect(distinct(polygon), profile.id).toBe(true);
    }
  });
});
