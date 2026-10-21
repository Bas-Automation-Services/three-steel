// 3D curves. Arc3D serves both as a BeamGeometry profile curve and as a full parametric member
// CENTERLINE alongside Line3D/Helix3D.
import { Point3D } from './point3d';
import { Vector3D } from './vector3d';
import { Line3D } from './line3d';
import { Plane3D } from './plane3d';
import { TOLERANCE } from './constants';

export class Arc3D {
  readonly kind = 'arc3d' as const;

  constructor(
    readonly center: Point3D,
    readonly normal: Vector3D,
    readonly xAxis: Vector3D,
    readonly radius: number,
    readonly startAngle: number,
    readonly endAngle: number,
    readonly isCounterClockwise = true,
  ) {}

  /**
   * Signed sweep in radians: positive for CCW arcs (normalized into (0, 2π]), negative for CW
   * (into [−2π, 0)) — coincident start/end angles mean a FULL turn, not an empty arc. Angles adjusted outside [0, 2π) (extendCurveEnds) stay un-wrapped, so a
   * sweep grown past a full turn is representable.
   */
  get sweepAngle(): number {
    let sweep = this.endAngle - this.startAngle;
    if (this.isCounterClockwise) {
      if (sweep <= 0) sweep += 2 * Math.PI;
    } else {
      if (sweep >= 0) sweep -= 2 * Math.PI;
    }
    return sweep;
  }

  /** Arc length = |sweep|·|radius| (|radius| tolerates the signed radii offsetRadial can produce). */
  get length(): number {
    return Math.abs(this.sweepAngle * this.radius);
  }

  get startPoint(): Point3D {
    return this.pointAt(0);
  }

  get endPoint(): Point3D {
    return this.pointAt(1);
  }

  get midPoint(): Point3D {
    return this.pointAt(0.5);
  }

  /**
   * Point at parameter t (0 = start, 1 = end): θ = startAngle + t·sweep, then
   * center + R·cosθ·xAxis + R·sinθ·yAxis with yAxis = normal×xAxis.
   * A negative R (signed-radius offset arc) lands on the opposite side of the center — exactly
   * the concentric-offset semantics offsetRadial needs when the offset crosses the center.
   */
  pointAt(t: number): Point3D {
    const angle = this.startAngle + t * this.sweepAngle;
    const yAxis = this.normal.cross(this.xAxis).normalized();
    return this.center.add(
      this.xAxis.scale(this.radius * Math.cos(angle)).add(yAxis.scale(this.radius * Math.sin(angle))),
    );
  }

  /**
   * Unit tangent at t, oriented along increasing t: d/dθ (R·cosθ·x + R·sinθ·y) scaled by the
   * SIGNED sweep — a CW arc (negative sweep) travels against increasing θ.
   */
  tangentAt(t: number): Vector3D {
    const angle = this.startAngle + t * this.sweepAngle;
    const yAxis = this.normal.cross(this.xAxis).normalized();
    const dir = this.xAxis.scale(-Math.sin(angle)).add(yAxis.scale(Math.cos(angle)));
    return dir.scale(this.sweepAngle * this.radius).normalized();
  }

  /**
   * Arc through three points: start, a point ON the arc, end — perpendicular-bisector
   * construction. The plane normal comes
   * from (mid−start)×(end−start); the center from intersecting the two chord bisectors solved in
   * that plane (denom = (perp1×perp2)·normal, t = (w×perp2)·normal/denom). CCW is inferred from
   * whether the mid point's angle lies inside the [0, endAngle] sweep. Null when the points are
   * collinear (cross length² < 1e-20) or numerically off-circle.
   */
  static fromThreePoints(startPoint: Point3D, midPoint: Point3D, endPoint: Point3D): Arc3D | null {
    const v1 = midPoint.sub(startPoint);
    const v2 = endPoint.sub(startPoint);

    const cross = v1.cross(v2);
    if (cross.lengthSquared < 1e-20) return null; // collinear
    const normal = cross.normalized();

    // Chord midpoints and in-plane perpendiculars of the two bisectors.
    const mid1 = startPoint.add(v1.scale(0.5));
    const mid2 = startPoint.add(v2.scale(0.5));
    const perp1 = normal.cross(v1).normalized();
    const perp2 = normal.cross(v2).normalized();

    // Intersect mid1 + t·perp1 with mid2 + s·perp2.
    const w = mid2.sub(mid1);
    const denom = perp1.cross(perp2).dot(normal);
    if (Math.abs(denom) < 1e-10) return null;
    const t = w.cross(perp2).dot(normal) / denom;
    const center = mid1.add(perp1.scale(t));

    const radius = startPoint.sub(center).length;
    const radiusMid = midPoint.sub(center).length;
    const radiusEnd = endPoint.sub(center).length;
    if (Math.abs(radiusMid - radius) > 1e-6 || Math.abs(radiusEnd - radius) > 1e-6) return null;

    // Frame: xAxis to the start point, angles CCW around the normal.
    const xAxis = startPoint.sub(center).normalized();
    const yAxis = normal.cross(xAxis).normalized();
    const toMid = midPoint.sub(center).normalized();
    let midAngle = Math.atan2(toMid.dot(yAxis), toMid.dot(xAxis));
    if (midAngle < 0) midAngle += 2 * Math.PI;
    const toEnd = endPoint.sub(center).normalized();
    let endAngle = Math.atan2(toEnd.dot(yAxis), toEnd.dot(xAxis));
    if (endAngle < 0) endAngle += 2 * Math.PI;

    // CCW iff the CCW walk from start (angle 0) to end passes through mid.
    let isCounterClockwise: boolean;
    if (midAngle > 0 && midAngle < endAngle) {
      isCounterClockwise = true;
    } else if (endAngle < midAngle && midAngle < 2 * Math.PI) {
      isCounterClockwise = false;
    } else {
      isCounterClockwise = endAngle > Math.PI;
    }
    return new Arc3D(center, normal, xAxis, radius, 0, endAngle, isCounterClockwise);
  }

  /**
   * Arc from its endpoints and center.
   * Radius comes from |start−center|; |end−center| must agree within 1e-6 relative — the caller
   * PRE-PROJECTS a free center onto the a-b bisector plane (projectCenterOntoBisectorPlane) so
   * parametric point moves keep the arc well-formed, this only rejects genuinely broken input.
   * Without `ccwHint` the arc runs start→end the SHORT way (normal = toStart×toEnd puts the end
   * angle in (0, π)); with a hint the normal whose dot with `ccwHint` is positive is picked, so
   * the same endpoints can describe the long way around the other orientation. Null when the
   * points are collinear with the center (which includes the ambiguous half-turn end = −start).
   */
  static fromStartEndCenter(
    startPoint: Point3D,
    endPoint: Point3D,
    center: Point3D,
    ccwHint?: Vector3D,
  ): Arc3D | null {
    const toStart = startPoint.sub(center);
    const toEnd = endPoint.sub(center);
    const radius = toStart.length;
    if (radius < 1e-9) return null;
    if (Math.abs(toEnd.length - radius) > 1e-6 * Math.max(1, radius)) return null;

    // Unit-vector cross ⇒ |cross| = sin(angle): a scale-free collinearity test (an absolute
    // threshold on raw mm vectors would be meaninglessly tight).
    const cross = toStart.normalized().cross(toEnd.normalized());
    if (cross.length < 1e-9) return null;

    let normal = cross.normalized();
    if (ccwHint && normal.dot(ccwHint) < 0) normal = normal.neg();

    const xAxis = toStart.normalized();
    const yAxis = normal.cross(xAxis).normalized();
    const toEndN = toEnd.normalized();
    let endAngle = Math.atan2(toEndN.dot(yAxis), toEndN.dot(xAxis));
    if (endAngle < 0) endAngle += 2 * Math.PI; // CCW angle around the chosen normal
    return new Arc3D(center, normal, xAxis, radius, 0, endAngle, true);
  }

  /**
   * Concentric radial offset: positive distance moves TOWARD the center (newRadius = radius −
   * distance). The radius is SIGNED — an offset
   * past the center flips its sign, and pointAt's R·cosθ formula places those points on the
   * opposite side, preserving the parameterization (rebuilding from three points would flip it).
   * Null when the result degenerates onto the center (|newRadius| < 1e-9).
   */
  offsetRadial(distanceMm: number): Arc3D | null {
    const newRadius = this.radius - distanceMm;
    if (Math.abs(newRadius) < 1e-9) return null;
    return new Arc3D(
      this.center, this.normal, this.xAxis, newRadius,
      this.startAngle, this.endAngle, this.isCounterClockwise,
    );
  }

  /**
   * Copy with the endpoints slid ALONG the arc's circle onto the given planes (restores the
   * "endpoint lies on plane" invariant after an insert offset shifted a curved centerline off
   * the path arc). Each target plane is intersected with
   * the arc plane to a line, the line with the circle (|origin + t·dir − center|² = R², a
   * quadratic in t), and the root NEAREST the original endpoint wins so the trim is minimal.
   * A null plane leaves that endpoint unchanged; a plane that is parallel to the arc plane or
   * misses the circle returns null rather than silently keeping the endpoint — callers must
   * know the snap failed. Center/normal/radius/orientation are preserved; the angles
   * are recomputed in the arc's own frame.
   */
  snapToPlanes(startPlane: Plane3D | null, endPlane: Plane3D | null): Arc3D | null {
    const snap = (endpoint: Point3D, plane: Plane3D | null): Point3D | null => {
      if (!plane) return endpoint;
      if (Math.abs(plane.signedDistanceTo(endpoint)) <= TOLERANCE) return endpoint;

      const arcPlane = new Plane3D(this.center, this.normal);
      const line = plane.intersectPlane(arcPlane);
      if (!line) return null; // target plane parallel to the arc plane

      // |origin + t·dir − center|² = R² with unit dir → t² + b·t + c = 0.
      const oc = line.origin.sub(this.center);
      const b = 2 * oc.dot(line.direction);
      const c = oc.dot(oc) - this.radius * this.radius;
      const discriminant = b * b - 4 * c;
      if (discriminant < -TOLERANCE) return null; // line misses the circle

      const sqrtD = Math.sqrt(Math.max(0, discriminant));
      const p1 = line.origin.add(line.direction.scale((-b + sqrtD) / 2));
      const p2 = line.origin.add(line.direction.scale((-b - sqrtD) / 2));
      return p1.distanceTo(endpoint) <= p2.distanceTo(endpoint) ? p1 : p2;
    };

    const newStart = snap(this.startPoint, startPlane);
    const newEnd = snap(this.endPoint, endPlane);
    if (newStart === null || newEnd === null) return null;
    if (newStart.isEqualTo(this.startPoint, TOLERANCE) && newEnd.isEqualTo(this.endPoint, TOLERANCE)) {
      return this;
    }

    const yAxis = this.normal.cross(this.xAxis).normalized();
    const angleOf = (p: Point3D): number => {
      const v = p.sub(this.center);
      let angle = Math.atan2(v.dot(yAxis), v.dot(this.xAxis));
      if (angle < 0) angle += 2 * Math.PI;
      return angle;
    };
    return new Arc3D(
      this.center, this.normal, this.xAxis, this.radius,
      angleOf(newStart), angleOf(newEnd), this.isCounterClockwise,
    );
  }
}

/**
 * Projects a free arc-center pick onto the perpendicular-bisector plane of the a–b chord — the
 * locus of valid centers for an arc from a to b. The document stores an arc's center as a third
 * sketch POINT (SketchArcElement), so parametric moves of a/b/center can break exact
 * equidistance; resolvers pre-project the center through this before Arc3D.fromStartEndCenter,
 * keeping the arc well-formed while both endpoints stay exactly where the user put them.
 * Degenerate chord (a ≈ b) returns the center unchanged.
 */
export function projectCenterOntoBisectorPlane(a: Point3D, b: Point3D, center: Point3D): Point3D {
  const ab = b.sub(a);
  if (ab.lengthSquared < 1e-12) return center;
  const n = ab.normalized();
  const mid = a.add(ab.scale(0.5));
  return center.subV(n.scale(center.sub(mid).dot(n)));
}

export class Circle3D {
  readonly kind = 'circle3d' as const;

  constructor(
    readonly center: Point3D,
    readonly radius: number,
    readonly normal: Vector3D,
  ) {}
}

export type Curve3D = Line3D | Arc3D | Circle3D;
