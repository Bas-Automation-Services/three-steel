// Chordal decomposition of a curved centerline into straight extrusion spans — the bridge
// between curved BeamGeometry and a mesh kernel that only knows extrude/trim/transform (the
// regen meshBuilder). Each span is a short prism along one chord of the curve, mitered against
// its neighbors on shared bisector planes so the union is watertight (the same construction a
// miter corner uses, applied every few degrees). Exactness note: this is a TESSELLATION of the
// sweep for visualization/meshing — the analytic curve stays the source of truth (BeamGeometry,
// signatures, BOM lengths all read the curve, never the spans).
import { CoordinateSystem3D, type MemberCurve, type Plane3D, type Point3D, Vector3D } from '../geometry';
import type { CrossSection } from '../sections/crossSection';
import type { BeamGeometry } from './beamGeometry';
import { pickPerpendicularAxis } from './beamGeometry';

/** A miter plane bounding one end of a span, in that span's LOCAL frame. */
export interface SweepSpanPlane {
  origin: [number, number, number];
  normal: [number, number, number];
}

export interface SweepSpan {
  /**
   * Span local (Z along the chord) → PART-LOCAL frame, column-major 4x4 — the same layout
   * resolveModel's frameMatrix emits, so the mesh kernel transforms spans exactly like parts.
   * Part-local = the frame of geometry.getCoordinateSystemAt(0): PartSpec.matrix places that
   * at world, spans nest inside it.
   */
  matrix: number[];
  /** Chord length, mm — the span extrudes this far along its local Z (plus trim overshoot). */
  lengthMm: number;
  /** Bisector miter plane against the PREVIOUS chord (absent on the first span). */
  startPlane?: SweepSpanPlane;
  /** Bisector miter plane against the NEXT chord (absent on the last span). */
  endPlane?: SweepSpanPlane;
}

const IDENTITY4: readonly number[] = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

/** World point/vector re-expressed in a (world-posed) orthonormal frame. */
const localPoint = (cs: CoordinateSystem3D, p: Point3D): [number, number, number] => {
  const v = p.sub(cs.origin);
  return [v.dot(cs.xAxis), v.dot(cs.yAxis), v.dot(cs.zAxis)];
};
const localVector = (cs: CoordinateSystem3D, v: Vector3D): [number, number, number] => [
  v.dot(cs.xAxis), v.dot(cs.yAxis), v.dot(cs.zAxis),
];

/** WORLD-space end-cut planes to bake onto the boundary spans (see computeSweepSpans). */
export interface SweepEndCutPlanes {
  start?: Plane3D;
  end?: Plane3D;
}

/**
 * Decomposes a curved beam into mitered chord spans, ≤ maxDegPerSpan of sweep each (≥ 4 spans,
 * so even tiny arcs stay visibly round). A straight beam is a single untrimmed span (identity
 * matrix — its chord frame IS the part frame), so callers need no line/curve branching.
 *
 * Per-span frame: Z along the chord; Y from the AVERAGE of the two bounding stations' up (Y)
 * axes re-orthogonalized against the chord — averaging keeps the section's roll centered on the
 * curve segment instead of leading/trailing it — and X = Y×Z (right-handed, matching
 * BeamGeometry's X = up×tangent / Y = tangent×X convention). Interior stations carry the shared
 * bisector plane normal ~ chordPrev + chordNext (unit vectors), expressed in EACH neighbor
 * span's local frame so the mesh kernel can trim both against the identical world plane.
 *
 * `endCutPlanes` (toPlane end cuts on a curved member whose centerline was ALREADY snapped onto
 * the planes, so a station origin lies exactly on each given plane) become the FIRST span's
 * startPlane / LAST span's endPlane — the same trim channel the interior miters use, so the mesh
 * kernel overshoots the boundary span past its end and trims the end face back to the (generally
 * non-perpendicular) cut plane with no extra machinery. The conversion lives HERE rather than in
 * the caller because the span frames only exist in world space inside this function — a caller
 * would have to invert span matrices to express a world plane span-locally. Normals are
 * re-oriented ALONG the travel direction (positive dot with the boundary chord), the keep-side
 * convention the mesh kernel expects of startPlane/endPlane. Ignored for straight beams (their
 * end cuts go through the prism cutPlanes channel).
 */
export function computeSweepSpans(
  geometry: BeamGeometry<MemberCurve>,
  maxDegPerSpan = 7.5,
  endCutPlanes?: SweepEndCutPlanes,
): SweepSpan[] {
  const curve = geometry.centerline;
  if (curve.kind === 'line3d') {
    return [{ matrix: [...IDENTITY4], lengthMm: geometry.length }];
  }

  const sweepDeg = (Math.abs(curve.sweepAngle) * 180) / Math.PI;
  const spanCount = Math.max(4, Math.ceil(sweepDeg / maxDegPerSpan));

  // Station frames straight from the geometry (crossSectionRotation included), so the spans roll
  // with the member's rotation exactly like the analytic frames do.
  const stations: CoordinateSystem3D[] = [];
  for (let i = 0; i <= spanCount; i++) {
    stations.push(geometry.getCoordinateSystemAt(i / spanCount));
  }

  // Chord i: station origin i → origin i+1.
  const chordDirs: Vector3D[] = [];
  const chordLens: number[] = [];
  for (let i = 0; i < spanCount; i++) {
    const d = stations[i + 1].origin.sub(stations[i].origin);
    chordLens.push(d.length);
    chordDirs.push(d.normalized());
  }

  const partCs = geometry.getCoordinateSystemAt(0);
  const spans: SweepSpan[] = [];
  const frames: { x: Vector3D; y: Vector3D; z: Vector3D }[] = [];

  for (let i = 0; i < spanCount; i++) {
    const z = chordDirs[i];
    // Average the bounding stations' ups, then strip the chord component (Gram-Schmidt). A
    // degenerate average (up flipping across the span — impossible at ≤7.5° per span, guarded
    // anyway) falls back to a deterministic perpendicular, mirroring BeamGeometry's own fallback.
    const avgUp = stations[i].yAxis.add(stations[i + 1].yAxis);
    const inPlane = avgUp.sub(z.scale(avgUp.dot(z)));
    const y = inPlane.lengthSquared > 1e-18 ? inPlane.normalized() : pickPerpendicularAxis(z);
    const x = y.cross(z).normalized();
    frames.push({ x, y, z });

    const xL = localVector(partCs, x);
    const yL = localVector(partCs, y);
    const zL = localVector(partCs, z);
    const oL = localPoint(partCs, stations[i].origin);
    spans.push({
      matrix: [
        xL[0], xL[1], xL[2], 0,
        yL[0], yL[1], yL[2], 0,
        zL[0], zL[1], zL[2], 0,
        oL[0], oL[1], oL[2], 1,
      ],
      lengthMm: chordLens[i],
    });
  }

  // Bisector planes at the interior stations, expressed in BOTH adjacent spans' local frames
  // (each span trims against the same world plane, so the mitered faces meet exactly).
  for (let i = 1; i < spanCount; i++) {
    const worldNormal = chordDirs[i - 1].add(chordDirs[i]).normalized();
    const origin = stations[i].origin;
    const spanLocalPlane = (spanIndex: number): SweepSpanPlane => {
      const f = frames[spanIndex];
      const o = origin.sub(stations[spanIndex].origin);
      return {
        origin: [o.dot(f.x), o.dot(f.y), o.dot(f.z)],
        normal: [worldNormal.dot(f.x), worldNormal.dot(f.y), worldNormal.dot(f.z)],
      };
    };
    spans[i - 1].endPlane = spanLocalPlane(i - 1);
    spans[i].startPlane = spanLocalPlane(i);
  }

  // End-cut planes onto the boundary spans (world plane → that span's local frame, normal
  // oriented along the travel direction). Boundary spans never carry a bisector plane on their
  // outer end, so nothing is overwritten.
  const spanLocalCutPlane = (spanIndex: number, plane: Plane3D): SweepSpanPlane => {
    const f = frames[spanIndex];
    const normal = plane.normal.dot(chordDirs[spanIndex]) >= 0 ? plane.normal : plane.normal.neg();
    const o = plane.origin.sub(stations[spanIndex].origin);
    return {
      origin: [o.dot(f.x), o.dot(f.y), o.dot(f.z)],
      normal: [normal.dot(f.x), normal.dot(f.y), normal.dot(f.z)],
    };
  };
  if (endCutPlanes?.start) spans[0].startPlane = spanLocalCutPlane(0, endCutPlanes.start);
  if (endCutPlanes?.end) spans[spanCount - 1].endPlane = spanLocalCutPlane(spanCount - 1, endCutPlanes.end);

  return spans;
}

/**
 * Trim overshoot for swept spans: each span extrudes this much past both chord ends before the
 * bisector planes cut it back, so an oblique miter still crosses the whole section envelope.
 * The section bounding-box diagonal is the worst-case reach of any section point from the axis
 * (×2), which safely covers bisector tilts up to half the per-span sweep.
 */
export function sweepChordOvershootMm(section: CrossSection): number {
  return section.boundingBoxDiagonal;
}
