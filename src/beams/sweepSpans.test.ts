import { describe, expect, it } from 'vitest';
import { Arc3D, Line3D, Plane3D, Point3D, Vector3D } from '../geometry';
import { BeamGeometry } from './beamGeometry';
import { computeSweepSpans, sweepChordOvershootMm, type SweepSpan } from './sweepSpans';
import { buildCrossSection } from '../sections/crossSectionBuilder';
import { getProfile } from '../profiles/euSteelProfiles';

const p = (x: number, y: number, z: number) => new Point3D(x, y, z);
const chsSection = () => buildCrossSection(getProfile('CHS48.3x2.9')!.shape);

// Quarter circle R = 1000 in the XY plane: (1000,0,0) → (0,1000,0), CCW around +Z.
const quarterArc = () => Arc3D.fromStartEndCenter(p(1000, 0, 0), p(0, 1000, 0), p(0, 0, 0))!;

/** Span-local point → world, through the span matrix then the part frame (both column-major). */
function spanPointToWorld(
  geometry: BeamGeometry<Arc3D>,
  span: SweepSpan,
  local: [number, number, number],
): Point3D {
  const m = span.matrix;
  const partLocal = [
    m[0] * local[0] + m[4] * local[1] + m[8] * local[2] + m[12],
    m[1] * local[0] + m[5] * local[1] + m[9] * local[2] + m[13],
    m[2] * local[0] + m[6] * local[1] + m[10] * local[2] + m[14],
  ];
  const cs = geometry.getCoordinateSystemAt(0);
  return cs.origin
    .add(cs.xAxis.scale(partLocal[0]))
    .add(cs.yAxis.scale(partLocal[1]))
    .add(cs.zAxis.scale(partLocal[2]));
}

/** Span-local vector → world (rotation only). */
function spanVectorToWorld(
  geometry: BeamGeometry<Arc3D>,
  span: SweepSpan,
  local: [number, number, number],
): Vector3D {
  const m = span.matrix;
  const partLocal = new Vector3D(
    m[0] * local[0] + m[4] * local[1] + m[8] * local[2],
    m[1] * local[0] + m[5] * local[1] + m[9] * local[2],
    m[2] * local[0] + m[6] * local[1] + m[10] * local[2],
  );
  const cs = geometry.getCoordinateSystemAt(0);
  return cs.xAxis.scale(partLocal.x).add(cs.yAxis.scale(partLocal.y)).add(cs.zAxis.scale(partLocal.z));
}

describe('computeSweepSpans (90° CHS arc)', () => {
  const geometry = new BeamGeometry(quarterArc(), chsSection());
  const spans = computeSweepSpans(geometry);

  it('span count = max(4, ceil(sweepDeg / 7.5))', () => {
    expect(spans).toHaveLength(12); // ceil(90 / 7.5)
    // A tiny sweep still gets the 4-span floor.
    const tiny = new BeamGeometry(
      new Arc3D(p(0, 0, 0), Vector3D.Z_AXIS, Vector3D.X_AXIS, 1000, 0, (10 * Math.PI) / 180),
      chsSection(),
    );
    expect(computeSweepSpans(tiny)).toHaveLength(4);
  });

  it('chord endpoints lie exactly on the analytic arc', () => {
    const arc = quarterArc();
    spans.forEach((span, i) => {
      const start = spanPointToWorld(geometry, span, [0, 0, 0]);
      const end = spanPointToWorld(geometry, span, [0, 0, span.lengthMm]);
      expect(start.isEqualTo(arc.pointAt(i / spans.length), 1e-6)).toBe(true);
      expect(end.isEqualTo(arc.pointAt((i + 1) / spans.length), 1e-6)).toBe(true);
    });
  });

  it('adjacent spans share the identical world bisector plane', () => {
    for (let i = 1; i < spans.length; i++) {
      const prev = spans[i - 1];
      const next = spans[i];
      expect(prev.endPlane).toBeDefined();
      expect(next.startPlane).toBeDefined();
      const nPrev = spanVectorToWorld(geometry, prev, prev.endPlane!.normal);
      const nNext = spanVectorToWorld(geometry, next, next.startPlane!.normal);
      expect(nPrev.isEqualTo(nNext, 1e-9)).toBe(true);
      const oPrev = spanPointToWorld(geometry, prev, prev.endPlane!.origin);
      const oNext = spanPointToWorld(geometry, next, next.startPlane!.origin);
      expect(oPrev.isEqualTo(oNext, 1e-6)).toBe(true);
    }
    // Outermost ends stay untrimmed (the free member faces sit exactly on the stations).
    expect(spans[0].startPlane).toBeUndefined();
    expect(spans[spans.length - 1].endPlane).toBeUndefined();
  });

  it('total chord length approaches the arc length from below (sagitta bound)', () => {
    const total = spans.reduce((sum, s) => sum + s.lengthMm, 0);
    const arcLength = geometry.length;
    expect(total).toBeLessThanOrEqual(arcLength + 1e-9);
    // Per-span shortfall for a circular chord: L·(1 − sin(θ/2)/(θ/2)), θ = sweep/spanCount.
    const theta = Math.PI / 2 / spans.length;
    const bound = arcLength * (1 - Math.sin(theta / 2) / (theta / 2));
    expect(arcLength - total).toBeLessThanOrEqual(bound + 1e-9);
  });

  it('a straight centerline yields a single untrimmed identity span', () => {
    const line = new BeamGeometry(new Line3D(p(0, 0, 0), p(0, 0, 2500)), chsSection());
    const single = computeSweepSpans(line);
    expect(single).toHaveLength(1);
    expect(single[0].lengthMm).toBeCloseTo(2500, 9);
    expect(single[0].startPlane).toBeUndefined();
    expect(single[0].endPlane).toBeUndefined();
    expect(single[0].matrix).toEqual([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  });

  it('sweepChordOvershootMm is the section bounding-box diagonal', () => {
    const section = chsSection();
    expect(sweepChordOvershootMm(section)).toBeCloseTo(section.boundingBoxDiagonal, 12);
  });

  it('endCutPlanes land on the boundary spans, normals oriented along the travel direction', () => {
    // World planes through the exact arc endpoints (a snapped centerline guarantees this):
    // radial planes at 0° and 90°, both handed AGAINST the travel direction on purpose —
    // computeSweepSpans must flip them to the keep-side convention (dot(normal, chord) > 0).
    const startPlane = new Plane3D(p(1000, 0, 0), new Vector3D(0, -1, 0));
    const endPlane = new Plane3D(p(0, 1000, 0), new Vector3D(1, 0, 0));
    const cut = computeSweepSpans(geometry, undefined, { start: startPlane, end: endPlane });
    expect(cut).toHaveLength(12);
    const first = cut[0];
    const last = cut[cut.length - 1];
    expect(first.startPlane).toBeDefined();
    expect(last.endPlane).toBeDefined();
    // Interior bisectors untouched.
    expect(first.endPlane).toBeDefined();
    expect(last.startPlane).toBeDefined();

    // Round-trip: the span-local plane re-expressed in world matches the input plane (origin on
    // it, normal ±parallel), with the normal pointing along the local chord (+Z component > 0).
    expect(first.startPlane!.normal[2]).toBeGreaterThan(0);
    expect(last.endPlane!.normal[2]).toBeGreaterThan(0);
    const oStart = spanPointToWorld(geometry, first, first.startPlane!.origin);
    expect(oStart.isEqualTo(p(1000, 0, 0), 1e-6)).toBe(true);
    const nStart = spanVectorToWorld(geometry, first, first.startPlane!.normal);
    expect(Math.abs(nStart.dot(new Vector3D(0, 1, 0)))).toBeCloseTo(1, 9);
    const oEnd = spanPointToWorld(geometry, last, last.endPlane!.origin);
    expect(oEnd.isEqualTo(p(0, 1000, 0), 1e-6)).toBe(true);
    const nEnd = spanVectorToWorld(geometry, last, last.endPlane!.normal);
    expect(Math.abs(nEnd.dot(new Vector3D(1, 0, 0)))).toBeCloseTo(1, 9);
    // The end normal was flipped to point along the travel direction (world −X at the arc end).
    expect(nEnd.x).toBeLessThan(0);
  });
});
