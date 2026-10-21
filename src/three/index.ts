// three.js adapter: steel sections and beams as three.js geometry. Units are millimetres.
//
// A member is a ring of section vertices at each station along its centerline, with walls
// between neighbouring rings and a cap at each end. A straight member has two stations, so it
// is an exact prism. A curved member gets a station every few degrees, each placed in the
// member's own frame at that point, so arcs and helices (which twist) follow the true curve.
// End cuts slide the end ring's vertices along the member axis onto the cut plane, which is
// exact for planar cuts and needs no CSG.
import { BufferGeometry, Float32BufferAttribute, Path, Shape, ShapeUtils, Vector2 } from 'three';
import { Line3D, Plane3D, Point3D, Vector3D, type CoordinateSystem3D, type MemberCurve } from '../geometry';
import { BeamGeometry } from '../beams/beamGeometry';
import type { CrossSection } from '../sections/crossSection';
import { buildCrossSection } from '../sections/crossSectionBuilder';
import { getProfile } from '../profiles/euSteelProfiles';
import { polygonArea, tessellateOutline, type PolygonPoint } from '../tessellate';

export interface BeamMeshOptions {
  /** Max chord sag when arcs in the section outline become segments, mm. Default 0.5. */
  sagMm?: number;
  /** Max sweep between stations on curved members, degrees. Default 7.5. */
  maxDegPerStation?: number;
  /**
   * World-space end cuts (miters, angled ends). The normal may point either way. On a curved
   * member the centerline end should lie on the plane.
   */
  startCut?: Plane3D;
  endCut?: Plane3D;
  /** Section corners sharper than this get split normals, degrees. Default 30. */
  creaseAngleDeg?: number;
}

export type XYZ = readonly [number, number, number] | { x: number; y: number; z: number };

export interface BeamSpec extends BeamMeshOptions {
  /** Catalog id ('IPE300', 'HEA200', 'SHS100x100x5', 'UB305x165x40', ...) or a built section. */
  profile: string | CrossSection;
  start: XYZ;
  end: XYZ;
  /** Reference up for the section's Y axis. Default world Z (a perpendicular for vertical members). */
  up?: XYZ;
  /** Roll about the member axis, radians. */
  rotation?: number;
}

/** Straight member from a profile id and two points, as a BufferGeometry in world mm. */
export function createBeamGeometry(spec: BeamSpec): BufferGeometry {
  const section = typeof spec.profile === 'string' ? sectionOf(spec.profile) : spec.profile;
  const beam = new BeamGeometry(
    new Line3D(toPoint(spec.start), toPoint(spec.end)),
    section,
    spec.up ? toVector(spec.up) : undefined,
    spec.rotation ?? 0,
  );
  return beamToBufferGeometry(beam, spec);
}

/** Any BeamGeometry (line, arc or helix centerline) as a BufferGeometry in world mm. */
export function beamToBufferGeometry(
  beam: BeamGeometry<MemberCurve>,
  options: BeamMeshOptions = {},
): BufferGeometry {
  const { outer, holes } = sectionLoops(beam.crossSection, options.sagMm ?? 0.5);
  const loops = [outer, ...holes];
  const points = loops.flat();
  const crease = Math.cos(((options.creaseAngleDeg ?? 30) * Math.PI) / 180);

  const curve = beam.centerline;
  const n =
    curve.kind === 'line3d'
      ? 1
      : Math.max(4, Math.ceil((Math.abs(curve.sweepAngle) * 180) / Math.PI / (options.maxDegPerStation ?? 7.5)));
  const frames = Array.from({ length: n + 1 }, (_, i) => beam.getCoordinateSystemAt(i / n));
  const square: LocalPlane = { origin: [0, 0, 0], normal: [0, 0, 1] };
  const startPlane = options.startCut ? toLocalPlane(frames[0], options.startCut) : square;
  const endPlane = options.endCut ? toLocalPlane(frames[n], options.endCut) : square;

  const rings = frames.map((cs) => points.map(([x, y]) => toWorld(cs, [x, y, 0])));
  if (options.startCut) cutRuns(rings, points, options.startCut, startPlane, frames[0], true);
  if (options.endCut) cutRuns(rings, points, options.endCut, endPlane, frames[n], false);

  // Rings on a helix turn about the member axis from one station to the next.
  const twisted = curve.kind === 'helix3d';
  const out = new MeshSink();
  for (let i = 0; i < n; i++) buildWalls(out, loops, rings[i], rings[i + 1], frames[i], frames[i + 1], crease, twisted);
  buildCap(out, outer, holes, rings[0], startPlane, false, frames[0]);
  buildCap(out, outer, holes, rings[n], endPlane, true, frames[n]);
  return out.toGeometry();
}

/** Section outline as a three.js Shape (outer CCW, holes as paths) for ExtrudeGeometry & co. */
export function sectionToShape(section: CrossSection, sagMm = 0.5): Shape {
  const { outer, holes } = sectionLoops(section, sagMm);
  const shape = new Shape(outer.map(([x, y]) => new Vector2(x, y)));
  for (const hole of holes) shape.holes.push(new Path(hole.map(([x, y]) => new Vector2(x, y))));
  return shape;
}

// --- internals ---

/** A plane in a station's local frame (X, Y = section axes, Z = member axis). */
interface LocalPlane {
  origin: [number, number, number];
  normal: [number, number, number];
}

function sectionOf(profileId: string): CrossSection {
  const profile = getProfile(profileId);
  if (!profile) throw new Error(`Unknown profile: ${profileId}`);
  return buildCrossSection(profile.shape);
}

const xyz = (p: XYZ): [number, number, number] => ('x' in p ? [p.x, p.y, p.z] : [p[0], p[1], p[2]]);
const toPoint = (p: XYZ) => new Point3D(...xyz(p));
const toVector = (p: XYZ) => new Vector3D(...xyz(p));

/** Outer loop CCW, holes CW (both in section XY), collinear points removed. */
function sectionLoops(section: CrossSection, sagMm: number): { outer: PolygonPoint[]; holes: PolygonPoint[][] } {
  const loop = (curves: Parameters<typeof tessellateOutline>[0], ccw: boolean) => {
    const points = dropCollinear(tessellateOutline(curves, sagMm));
    return polygonArea(points) > 0 === ccw ? points : points.reverse();
  };
  return {
    outer: loop(section.outerCurves, true),
    holes: section.innerContours.map((c) => loop(c, false)),
  };
}

/** The cap triangulator skips collinear points, so the walls must not have them either. */
function dropCollinear(points: PolygonPoint[]): PolygonPoint[] {
  return points.filter((p, i) => {
    const a = points[(i - 1 + points.length) % points.length];
    const b = points[(i + 1) % points.length];
    const ux = p[0] - a[0], uy = p[1] - a[1], vx = b[0] - p[0], vy = b[1] - p[1];
    return Math.abs(ux * vy - uy * vx) > 1e-9 * Math.hypot(ux, uy) * Math.hypot(vx, vy) || ux * vx + uy * vy < 0;
  });
}

function toLocalPlane(cs: CoordinateSystem3D, plane: Plane3D): LocalPlane {
  const o = plane.origin.sub(cs.origin);
  const n = plane.normal;
  return {
    origin: [o.dot(cs.xAxis), o.dot(cs.yAxis), o.dot(cs.zAxis)],
    normal: [n.dot(cs.xAxis), n.dot(cs.yAxis), n.dot(cs.zAxis)],
  };
}

const toWorldDir = (cs: CoordinateSystem3D, v: readonly number[]): number[] => [
  cs.xAxis.x * v[0] + cs.yAxis.x * v[1] + cs.zAxis.x * v[2],
  cs.xAxis.y * v[0] + cs.yAxis.y * v[1] + cs.zAxis.y * v[2],
  cs.xAxis.z * v[0] + cs.yAxis.z * v[1] + cs.zAxis.z * v[2],
];
const toWorld = (cs: CoordinateSystem3D, p: readonly number[]): number[] => {
  const d = toWorldDir(cs, p);
  return [cs.origin.x + d[0], cs.origin.y + d[1], cs.origin.z + d[2]];
};

/**
 * Ends every lengthwise run of vertices (one run per section point) on a cut plane. A run that
 * crosses the plane is trimmed where it crosses, so a steep cut on a curve can reach several
 * stations deep without folding the walls. A run whose end stops short of the plane is extended
 * along the end tangent.
 */
function cutRuns(
  rings: number[][][],
  points: PolygonPoint[],
  plane: Plane3D,
  local: LocalPlane,
  frame: CoordinateSystem3D,
  atStart: boolean,
): void {
  const n = rings.length - 1;
  const ring = (k: number) => rings[atStart ? k : n - k]; // k = 0 is the cut end
  // Signed distance, positive on the member's side of the plane.
  const into = atStart ? frame.zAxis : frame.zAxis.neg();
  const normal = plane.normal.dot(into) >= 0 ? plane.normal : plane.normal.neg();
  const o = plane.origin;
  const side = (p: number[]) => (p[0] - o.x) * normal.x + (p[1] - o.y) * normal.y + (p[2] - o.z) * normal.z;

  points.forEach(([x, y], v) => {
    if (side(ring(0)[v]) >= 0) {
      ring(0)[v] = toWorld(frame, [x, y, zOnPlane(local, x, y)]);
      return;
    }
    for (let k = 1; k <= n; k++) {
      const a = ring(k - 1)[v];
      const b = ring(k)[v];
      const da = side(a);
      const db = side(b);
      if (db < 0) continue;
      // A crossing within a micron of a station snaps onto it, so no sliver walls are left.
      const s = da / (da - db);
      const crossing = db < 1e-3 ? b : a.map((c, j) => c + (b[j] - c) * s);
      for (let m = 0; m < k; m++) ring(m)[v] = crossing;
      return;
    }
  });
}

const normalize = (v: number[]): number[] => {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
};

/** Z where the axis-parallel line through (x, y) meets the plane. */
function zOnPlane(plane: LocalPlane, x: number, y: number): number {
  const [nx, ny, nz] = plane.normal;
  if (Math.abs(nz) < 1e-6) throw new Error('End cut is parallel to the member axis.');
  const [ox, oy, oz] = plane.origin;
  return (nx * ox + ny * oy + nz * oz - nx * x - ny * y) / nz;
}

class MeshSink {
  readonly positions: number[] = [];
  readonly normals: number[] = [];

  tri(a: number[], b: number[], c: number[], na: number[], nb: number[], nc: number[]): void {
    // Runs trimmed by an end cut collapse onto one point; skip the triangles that leaves empty.
    const same = (p: number[], q: number[]) => p[0] === q[0] && p[1] === q[1] && p[2] === q[2];
    if (same(a, b) || same(b, c) || same(a, c)) return;
    this.positions.push(...a, ...b, ...c);
    this.normals.push(...na, ...nb, ...nc);
  }

  toGeometry(): BufferGeometry {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('normal', new Float32BufferAttribute(this.normals, 3));
    return geometry;
  }
}

/**
 * Walls between two rings. Loops are CCW (outer) / CW (holes) in section XY, so the edge normal
 * (dy, -dx) points away from the material. Each ring's normals use that ring's own frame.
 */
function buildWalls(
  out: MeshSink,
  loops: PolygonPoint[][],
  ring0: number[][],
  ring1: number[][],
  frame0: CoordinateSystem3D,
  frame1: CoordinateSystem3D,
  crease: number,
  twisted: boolean,
): void {
  let offset = 0;
  for (const loop of loops) {
    const n = loop.length;
    const edgeNormals = loop.map((p, i) => {
      const q = loop[(i + 1) % n];
      const dx = q[0] - p[0];
      const dy = q[1] - p[1];
      const len = Math.hypot(dx, dy) || 1;
      return [dy / len, -dx / len, 0];
    });
    // A vertex's section normal on edge e: smoothed with the neighbouring edge unless the corner is sharp.
    const sectionNormal = (e: number, neighbour: number) => {
      const a = edgeNormals[e];
      const b = edgeNormals[neighbour];
      if (a[0] * b[0] + a[1] * b[1] < crease) return a;
      const len = Math.hypot(a[0] + b[0], a[1] + b[1]) || 1;
      return [(a[0] + b[0]) / len, (a[1] + b[1]) / len, 0];
    };
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const na = sectionNormal(i, (i - 1 + n) % n);
      const nb = sectionNormal(i, j);
      const [na0, nb0, na1, nb1] = [toWorldDir(frame0, na), toWorldDir(frame0, nb), toWorldDir(frame1, na), toWorldDir(frame1, nb)];
      const [a0, b0, a1, b1] = [ring0[offset + i], ring0[offset + j], ring1[offset + i], ring1[offset + j]];
      // A side collapsed by an end cut makes the quad a triangle: no fan needed (or wanted).
      const collapsed = a0 === a1 || b0 === b1;
      if (!twisted || collapsed) {
        out.tri(a0, b0, b1, na0, nb0, nb1);
        out.tri(a0, b1, a1, na0, nb1, na1);
        continue;
      }
      // A twisted quad is not flat. Splitting every one along the same diagonal biases the
      // volume (about 3% on a thin-walled helix at 7.5°); a fan around the centre does not.
      const c = [0, 1, 2].map((k) => (a0[k] + b0[k] + a1[k] + b1[k]) / 4);
      const nc = normalize([0, 1, 2].map((k) => na0[k] + nb0[k] + na1[k] + nb1[k]));
      out.tri(a0, b0, c, na0, nb0, nc);
      out.tri(b0, b1, c, nb0, nb1, nc);
      out.tri(b1, a1, c, nb1, na1, nc);
      out.tri(a1, a0, c, na1, na0, nc);
    }
    offset += n;
  }
}

/** End face on a ring (vertex order: outer loop, then the holes). */
function buildCap(
  out: MeshSink,
  outer: PolygonPoint[],
  holes: PolygonPoint[][],
  ring: number[][],
  plane: LocalPlane,
  facingEnd: boolean,
  frame: CoordinateSystem3D,
): void {
  const points = [outer, ...holes].flat();
  const tris = ShapeUtils.triangulateShape(
    outer.map(([x, y]) => new Vector2(x, y)),
    holes.map((h) => h.map(([x, y]) => new Vector2(x, y))),
  );
  // The plane normal, turned to point out of the member.
  const sign = plane.normal[2] > 0 === facingEnd ? 1 : -1;
  const normal = toWorldDir(frame, plane.normal.map((c) => c * sign));
  for (const [i, j, k] of tris) {
    const [p, q, r] = [points[i], points[j], points[k]];
    const ccw = (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]) > 0;
    const [b, c] = ccw === facingEnd ? [j, k] : [k, j];
    out.tri(ring[i], ring[b], ring[c], normal, normal, normal);
  }
}
