// Circular helix centerline (spiral-stair stringers and handrails). The parameterization
// mirrors Arc3D's (θ = startAngle + t·sweep in the axis/xAxis frame) with a
// linear axial rise added, so Arc3D math (extensions, frames) generalizes by swapping
// R·dθ arc length for sqrt(R² + (pitch/2π)²)·dθ.
import { Point3D } from './point3d';
import { Vector3D } from './vector3d';
import { Line3D } from './line3d';
import { Arc3D } from './curve3d';
import { Plane3D } from './plane3d';
import { TOLERANCE } from './constants';

export class Helix3D {
  readonly kind = 'helix3d' as const;

  /** Unit helix axis (normalized defensively from the constructor argument). */
  readonly axis: Vector3D;
  /** Unit angle reference ⊥ axis (Gram-Schmidt re-orthogonalized against the axis). */
  readonly xAxis: Vector3D;

  /**
   * @param origin      Point ON THE AXIS at the start height — pointAt(0) sits radius away from
   *                    it perpendicular to the axis (at startAngle in the axis/xAxis frame).
   * @param axis        Helix axis direction (normalized here).
   * @param xAxis       Angle reference ⊥ axis; re-orthogonalized against the axis defensively,
   *                    a (near-)parallel input falls back to a deterministic perpendicular.
   * @param radius      Radius, mm.
   * @param startAngle  Start angle around the axis from xAxis, radians.
   * @param sweepAngle  SIGNED sweep, radians — the sign IS the handedness: positive winds CCW
   *                    around +axis (right-handed with positive pitch), negative CW.
   * @param pitch       SIGNED rise along +axis per full 2π turn, mm.
   */
  constructor(
    readonly origin: Point3D,
    axis: Vector3D,
    xAxis: Vector3D,
    readonly radius: number,
    readonly startAngle: number,
    readonly sweepAngle: number,
    readonly pitch: number,
  ) {
    this.axis = axis.normalized();
    // Gram-Schmidt: strip the axis component so a sloppy caller (xAxis not exactly ⊥ axis)
    // still yields an orthonormal frame; a degenerate input (xAxis ∥ axis) cannot define an
    // angle reference, so fall back to a deterministic perpendicular of the axis.
    const inPlane = xAxis.sub(this.axis.scale(xAxis.dot(this.axis)));
    this.xAxis = inPlane.lengthSquared > 1e-18 ? inPlane.normalized() : perpendicularOf(this.axis);
  }

  /**
   * Arc length: the pitch adds a constant axial speed |pitch/2π| per radian on top of the
   * tangential R, so ds/dθ = sqrt(R² + (pitch/2π)²) and length = |sweep|·sqrt(R² + (pitch/2π)²).
   */
  get length(): number {
    const rise = this.pitch / (2 * Math.PI);
    return Math.abs(this.sweepAngle) * Math.sqrt(this.radius * this.radius + rise * rise);
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
   * origin + R·cosθ·xAxis + R·sinθ·yAxis + pitch·(θ−startAngle)/2π·axis with yAxis = axis×xAxis
   * — an Arc3D point plus the linear axial rise (zero at t=0 by construction: origin is the
   * axis point at start HEIGHT, not the start point itself).
   */
  pointAt(t: number): Point3D {
    const angle = this.startAngle + t * this.sweepAngle;
    const yAxis = this.axis.cross(this.xAxis);
    return this.origin
      .add(this.xAxis.scale(this.radius * Math.cos(angle)))
      .add(yAxis.scale(this.radius * Math.sin(angle)))
      .add(this.axis.scale((this.pitch * (angle - this.startAngle)) / (2 * Math.PI)));
  }

  /**
   * Unit tangent at t, oriented along increasing t: the analytic derivative
   * dP/dθ = R(−sinθ·xAxis + cosθ·yAxis) + (pitch/2π)·axis scaled by the signed sweep (dθ/dt) —
   * a negative sweep both reverses the tangential part AND flips the effective rise direction,
   * exactly like walking the same helix the other way.
   */
  tangentAt(t: number): Vector3D {
    const angle = this.startAngle + t * this.sweepAngle;
    const yAxis = this.axis.cross(this.xAxis);
    const dPdTheta = this.xAxis
      .scale(-this.radius * Math.sin(angle))
      .add(yAxis.scale(this.radius * Math.cos(angle)))
      .add(this.axis.scale(this.pitch / (2 * Math.PI)));
    return dPdTheta.scale(this.sweepAngle >= 0 ? 1 : -1).normalized();
  }

  /**
   * Copy with the endpoints slid ALONG the helix onto the given planes — the curved-member
   * end-cut analog of Arc3D.snapToPlanes. A plane–helix intersection has no closed form, so this
   * solves numerically but DETERMINISTICALLY: the plane distance f(t) = plane.signedDistanceTo
   * (pointAt(t)) is scanned over the ±10%-padded parameter range [−0.1, 1.1] at 64 uniform
   * samples; among the sign-change segments the one nearest the respective end (t = 0 for
   * startPlane, t = 1 for endPlane) is bisected 40 times (interval ≈ 1.2/64/2⁴⁰ — far below any
   * float tolerance), so the trim is minimal exactly like the arc's nearest-root rule. A null
   * plane leaves that endpoint unchanged; an endpoint already on its plane (within TOLERANCE)
   * stays put. Null when a plane has no crossing in the padded range, or when the trims cross
   * over (start lands past end — the member would degenerate). Axis/xAxis/radius/pitch are
   * preserved; startAngle/sweepAngle are re-derived and the origin slides along the axis to the
   * new start height (the `origin` invariant: pointAt(0)'s axial rise is zero by construction).
   */
  snapToPlanes(startPlane: Plane3D | null, endPlane: Plane3D | null): Helix3D | null {
    const solveNearest = (plane: Plane3D | null, endT: 0 | 1): number | null => {
      if (!plane) return endT;
      if (Math.abs(plane.signedDistanceTo(this.pointAt(endT))) <= TOLERANCE) return endT;

      const LO = -0.1;
      const HI = 1.1;
      const N = 64;
      const f = (t: number) => plane.signedDistanceTo(this.pointAt(t));

      // Scan for bracketing segments; keep the one whose midpoint is nearest the trimmed end.
      let bracket: [number, number] | null = null;
      let prevT = LO;
      let prevF = f(LO);
      for (let i = 1; i <= N; i++) {
        const t = LO + (i / N) * (HI - LO);
        const ft = f(t);
        if (prevF === 0 || prevF * ft < 0) {
          if (bracket === null || Math.abs((prevT + t) / 2 - endT) < Math.abs((bracket[0] + bracket[1]) / 2 - endT)) {
            bracket = [prevT, t];
          }
        }
        prevT = t;
        prevF = ft;
      }
      if (bracket === null) return prevF === 0 ? prevT : null; // last sample may land exactly on the plane
      let [a, b] = bracket;
      let fa = f(a);
      for (let i = 0; i < 40; i++) {
        const m = (a + b) / 2;
        const fm = f(m);
        if (fa === 0) return a;
        if (fa * fm > 0) {
          a = m;
          fa = fm;
        } else {
          b = m;
        }
      }
      return (a + b) / 2;
    };

    const t0 = solveNearest(startPlane, 0);
    const t1 = solveNearest(endPlane, 1);
    if (t0 === null || t1 === null) return null;
    if (t0 === 0 && t1 === 1) return this;
    if (t1 - t0 <= TOLERANCE / Math.max(this.length, TOLERANCE)) return null; // trims crossed over

    const newStartAngle = this.startAngle + t0 * this.sweepAngle;
    const newSweep = (t1 - t0) * this.sweepAngle;
    const newOrigin = this.origin.add(this.axis.scale((this.pitch * (t0 * this.sweepAngle)) / (2 * Math.PI)));
    return new Helix3D(newOrigin, this.axis, this.xAxis, this.radius, newStartAngle, newSweep, this.pitch);
  }
}

/** Deterministic unit perpendicular of a unit vector: cross with the least-aligned world axis. */
function perpendicularOf(unit: Vector3D): Vector3D {
  const ax = Math.abs(unit.x);
  const ay = Math.abs(unit.y);
  const az = Math.abs(unit.z);
  const reference =
    ax <= ay && ax <= az ? Vector3D.X_AXIS : ay <= az ? Vector3D.Y_AXIS : Vector3D.Z_AXIS;
  return unit.cross(reference).cross(unit).normalized();
}

/**
 * A member centerline: straight, circular-arc, or helical. Structurally uniform — all three
 * carry `length`, `startPoint`, `endPoint`, `pointAt(t)` and `tangentAt(t)` (t ∈ [0, 1]), so
 * BeamGeometry and the extension/frame math switch on `kind` only where the math itself differs.
 */
export type MemberCurve = Line3D | Arc3D | Helix3D;
