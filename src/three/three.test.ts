import { describe, expect, it } from 'vitest';
import { ShapeUtils, type BufferGeometry } from 'three';
import { Arc3D, Helix3D, Plane3D, Point3D, Vector3D } from '../geometry';
import { BeamGeometry } from '../beams/beamGeometry';
import { buildCrossSection } from '../sections/crossSectionBuilder';
import { getProfile } from '../profiles/euSteelProfiles';
import { polygonArea, tessellateOutline } from '../tessellate';
import { beamToBufferGeometry, createBeamGeometry, sectionToShape } from './index';

const SAG = 0.05;

function triangles(g: BufferGeometry): number[][][] {
  const p = g.getAttribute('position').array;
  const tris: number[][][] = [];
  for (let i = 0; i < p.length; i += 9) {
    tris.push([[p[i], p[i + 1], p[i + 2]], [p[i + 3], p[i + 4], p[i + 5]], [p[i + 6], p[i + 7], p[i + 8]]]);
  }
  return tris;
}

/** Signed volume (divergence theorem): positive iff the closed surface winds outward. */
function volume(g: BufferGeometry): number {
  let v = 0;
  for (const [a, b, c] of triangles(g)) {
    v += a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
  }
  return v / 6;
}

/** Every directed edge is matched by exactly one reverse edge: closed and consistently wound. */
function expectClosed(g: BufferGeometry, tol = 1e-2): void {
  const key = (p: number[]) => p.map((c) => Math.round(c / tol)).join(',');
  const edges = new Map<string, number>();
  for (const tri of triangles(g)) {
    for (let i = 0; i < 3; i++) {
      const e = `${key(tri[i])}|${key(tri[(i + 1) % 3])}`;
      edges.set(e, (edges.get(e) ?? 0) + 1);
    }
  }
  let open = 0;
  for (const [e, n] of edges) {
    const [a, b] = e.split('|');
    if (n !== 1 || edges.get(`${b}|${a}`) !== 1) open++;
  }
  expect(open, 'unmatched edges').toBe(0);
}

const sectionArea = (id: string) => {
  const section = buildCrossSection(getProfile(id)!.shape);
  const area = (curves: Parameters<typeof tessellateOutline>[0]) => Math.abs(polygonArea(tessellateOutline(curves, SAG)));
  return area(section.outerCurves) - section.innerContours.reduce((s, c) => s + area(c), 0);
};

describe('createBeamGeometry', () => {
  it('puts an IPE300 along X with its height on world Z', () => {
    const g = createBeamGeometry({ profile: 'IPE300', start: [0, 0, 0], end: [6000, 0, 0], sagMm: SAG });
    g.computeBoundingBox();
    const box = g.boundingBox!;
    expect(box.min.x).toBeCloseTo(0, 6);
    expect(box.max.x).toBeCloseTo(6000, 6);
    expect(box.max.y - box.min.y).toBeCloseTo(150, 3);
    expect(box.max.z - box.min.z).toBeCloseTo(300, 3);
  });

  it('builds closed, outward-wound solids with the right volume', () => {
    for (const id of ['IPE300', 'HEA200', 'SHS100x100x5', 'CHS168.3x4.5', 'UPE200', 'L100x100x10']) {
      if (!getProfile(id)) continue;
      const g = createBeamGeometry({ profile: id, start: [0, 0, 0], end: [0, 2000, 500], sagMm: SAG });
      expectClosed(g);
      const length = Math.hypot(2000, 500);
      // Positions are float32: ~1e-6 relative on thin hollow sections.
      expect(volume(g) / (sectionArea(id) * length), id).toBeCloseTo(1, 5);
    }
  });

  it('accepts {x,y,z} points, an up vector and a roll', () => {
    const g = createBeamGeometry({
      profile: 'IPE300',
      start: { x: 0, y: 0, z: 0 },
      end: { x: 0, y: 0, z: 3000 },
      up: [1, 0, 0],
      rotation: Math.PI / 2,
    });
    g.computeBoundingBox();
    const box = g.boundingBox!;
    // Up = X, rolled 90° about +Z: the 300 mm height ends up along Y.
    expect(box.max.y - box.min.y).toBeCloseTo(300, 3);
    expect(box.max.x - box.min.x).toBeCloseTo(150, 3);
  });

  it('rejects unknown profiles', () => {
    expect(() => createBeamGeometry({ profile: 'NOPE', start: [0, 0, 0], end: [1, 0, 0] })).toThrow('Unknown profile');
  });
});

describe('end cuts', () => {
  it('lands every end-face vertex exactly on a 45° miter and keeps the volume', () => {
    const endCut = new Plane3D(new Point3D(4000, 0, 0), new Vector3D(1, 0, 1));
    const g = createBeamGeometry({ profile: 'HEA200', start: [0, 0, 0], end: [4000, 0, 0], endCut, sagMm: SAG });
    expectClosed(g);
    const p = g.getAttribute('position').array;
    let onCut = 0;
    for (let i = 0; i < p.length; i += 3) {
      if (p[i] < 3800) continue;
      expect(Math.abs(endCut.signedDistanceTo(new Point3D(p[i], p[i + 1], p[i + 2])))).toBeLessThan(1e-3);
      onCut++;
    }
    expect(onCut).toBeGreaterThan(0);
    // A miter through the axis removes as much as it adds (symmetric section).
    expect(volume(g) / (sectionArea('HEA200') * 4000)).toBeCloseTo(1, 6);
  });

  it('cuts the start too, whichever way the normal points', () => {
    const startCut = new Plane3D(new Point3D(0, 0, 0), new Vector3D(-1, 0.5, 0));
    const g = createBeamGeometry({ profile: 'IPE300', start: [0, 0, 0], end: [3000, 0, 0], startCut });
    expectClosed(g);
    expect(volume(g)).toBeGreaterThan(0);
  });
});

describe('curved members', () => {
  it('sweeps an arc into a closed solid of area × arc length', () => {
    const arc = Arc3D.fromThreePoints(new Point3D(0, 0, 0), new Point3D(2000, 600, 0), new Point3D(4000, 0, 0))!;
    const section = buildCrossSection(getProfile('SHS100x100x5')!.shape);
    const g = beamToBufferGeometry(new BeamGeometry(arc, section), { sagMm: SAG, maxDegPerStation: 1 });
    expectClosed(g);
    // Chordal walls under-fill the arc slightly; 1° stations keep it well inside 0.1%.
    expect(volume(g) / (sectionArea('SHS100x100x5') * arc.length)).toBeCloseTo(1, 3);
  });

  it('sweeps a spiral stringer (helix) into a closed solid', () => {
    const helix = new Helix3D(new Point3D(0, 0, 0), Vector3D.Z_AXIS, Vector3D.X_AXIS, 1200, 0, Math.PI, 3000);
    const sweep = (id: string) =>
      beamToBufferGeometry(new BeamGeometry(helix, buildCrossSection(getProfile(id)!.shape)), { sagMm: SAG, maxDegPerStation: 2 });
    expectClosed(sweep('UPE200'));
    // Volume = area × centroid path; only a doubly symmetric section keeps its centroid on the centerline.
    expect(volume(sweep('IPE200')) / (sectionArea('IPE200') * helix.length)).toBeCloseTo(1, 3);
  });
});

describe('sectionToShape', () => {
  it('matches the section area, holes subtracted', () => {
    const section = buildCrossSection(getProfile('SHS100x100x5')!.shape);
    const shape = sectionToShape(section, SAG);
    expect(shape.holes).toHaveLength(1);
    // Outer CCW, hole CW: the signed areas add up to the net area.
    const area = ShapeUtils.area(shape.getPoints()) + ShapeUtils.area(shape.holes[0].getPoints());
    expect(area / sectionArea('SHS100x100x5')).toBeCloseTo(1, 6);
  });
});
