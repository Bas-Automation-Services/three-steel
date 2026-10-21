import {
  Arc3D,
  Circle3D,
  CoordinateSystem3D,
  type Curve2D,
  type Curve3D,
  Line3D,
  type MemberCurve,
  Plane3D,
  Point3D,
  TOLERANCE,
  Vector3D,
} from '../geometry';
import type { CrossSection } from '../sections/crossSection';

/**
 * The pure geometric description of a beam: a centerline (straight, arc or helix — any
 * MemberCurve), a cross-section, and an orientation (up vector + rotation about the beam axis).
 * Produces the 3D profile curves the body builder sweeps into a solid.
 *
 * Generic over the centerline type with Line3D as the default so the (overwhelmingly straight)
 * existing consumers — which read `geometry.centerline.direction` and pass centerlines into
 * line-only helpers — keep their exact types: a bare `BeamGeometry` annotation still means a
 * straight beam. Curved-beam call sites infer `BeamGeometry<Arc3D>` / `BeamGeometry<MemberCurve>`
 * from the constructor argument.
 */
export class BeamGeometry<C extends MemberCurve = Line3D> {
  readonly centerline: C;
  readonly crossSection: CrossSection;
  readonly upVector: Vector3D;
  readonly crossSectionRotation: number;

  constructor(
    centerline: C,
    crossSection: CrossSection,
    upVector?: Vector3D,
    crossSectionRotation = 0,
  ) {
    this.centerline = centerline;
    this.crossSection = crossSection;
    this.crossSectionRotation = crossSectionRotation;

    if (centerline.kind === 'line3d') {
      // Straight beams: up made orthogonal to the axis, or the default up when parallel/absent.
      this.upVector =
        upVector && !upVector.isParallel(centerline.direction)
          ? makeOrthogonal(upVector, centerline.direction)
          : calculateDefaultUpVector(centerline.direction);
    } else if (centerline.kind === 'arc3d') {
      // Curved beams keep a FIXED up along the whole sweep — default is the arc plane normal,
      // used as-is at every t; per-point orthogonalization happens in getCoordinateSystemAt. This keeps the section from twisting: the frame rotates rigidly
      // with the tangent around the normal. An explicit up still wins.
      this.upVector = (upVector ?? centerline.normal).normalized();
    } else {
      // Helix: the axis is the natural twist-free up reference (the tangent keeps a constant
      // angle to it), mirroring the arc-normal rule above. An explicit up still wins.
      this.upVector = (upVector ?? centerline.axis).normalized();
    }
  }

  get startPoint(): Point3D {
    return this.centerline.startPoint;
  }

  get endPoint(): Point3D {
    return this.centerline.endPoint;
  }

  get length(): number {
    return this.centerline.length;
  }

  /** End planes face OUTWARD along the local tangent (identical to `direction` for lines). */
  get startPlane(): Plane3D {
    return new Plane3D(this.startPoint, this.centerline.tangentAt(0).neg());
  }

  get endPlane(): Plane3D {
    return new Plane3D(this.endPoint, this.centerline.tangentAt(1));
  }

  /**
   * Coordinate system on the centerline at parameter t (0 = start, 1 = end).
   * Axes: X = binormal, Y = up, Z = tangent (beam direction).
   */
  getCoordinateSystemAt(t: number): CoordinateSystem3D {
    const point = this.centerline.pointAt(t);
    const tangent = this.centerline.tangentAt(t);

    let upVector = this.upVector;
    if (Math.abs(this.crossSectionRotation) > TOLERANCE) {
      upVector = upVector.rotateAroundAxis(tangent, this.crossSectionRotation);
    }

    // Re-orthogonalize per call: up is only a REFERENCE — the frame is built from the local
    // tangent. When the tangent runs (near-)parallel to up (a steep helix approaching its axis
    // direction), the cross product degenerates; fall back to a deterministic perpendicular of
    // the tangent so the frame stays orthonormal instead of collapsing to NaN.
    const rawBinormal = upVector.cross(tangent);
    const binormal =
      rawBinormal.length > 1e-9 ? rawBinormal.normalized() : pickPerpendicularAxis(tangent);
    const orthogonalUp = tangent.cross(binormal).normalized();
    return new CoordinateSystem3D(point, binormal, orthogonalUp, tangent);
  }

  getOuterProfileCurvesAt(cs: CoordinateSystem3D): Curve3D[] {
    return transformCurves2DTo3D(this.crossSection.outerCurves, cs);
  }

  getInnerContourCurvesAt(cs: CoordinateSystem3D): Curve3D[][] {
    if (!this.crossSection.isHollow) return [];
    return this.crossSection.innerContours.map((contour) => transformCurves2DTo3D(contour, cs));
  }
}

/**
 * Default up vector perpendicular to the beam direction, pointing as close to world Z
 * (or referenceUp) as possible.
 */
export function calculateDefaultUpVector(beamDirection: Vector3D, referenceUp?: Vector3D): Vector3D {
  const direction = beamDirection.normalized();
  const up = referenceUp ?? Vector3D.Z_AXIS;

  const upComponent = Math.abs(direction.dot(up));
  const reference = upComponent < 0.9 ? up : pickPerpendicularAxis(up);

  const binormal = direction.cross(reference).normalized();
  return binormal.cross(direction).normalized();
}

/** Returns a principal axis (±X/±Y/±Z) made perpendicular to the vector. */
export function pickPerpendicularAxis(vector: Vector3D): Vector3D {
  const v = vector.normalized();
  const ax = Math.abs(v.x);
  const ay = Math.abs(v.y);
  const az = Math.abs(v.z);
  const axis =
    ax <= ay && ax <= az ? Vector3D.X_AXIS : ay <= az ? Vector3D.Y_AXIS : Vector3D.Z_AXIS;
  return v.cross(axis).cross(v).normalized();
}

function makeOrthogonal(upVector: Vector3D, beamDirection: Vector3D): Vector3D {
  const direction = beamDirection.normalized();
  const binormal = direction.cross(upVector).normalized();
  return binormal.cross(direction).normalized();
}

function transformCurves2DTo3D(curves2d: readonly Curve2D[], cs: CoordinateSystem3D): Curve3D[] {
  const result: Curve3D[] = [];
  for (const curve of curves2d) {
    switch (curve.kind) {
      case 'line':
        result.push(new Line3D(cs.to3d(curve.startPoint), cs.to3d(curve.endPoint)));
        break;
      case 'arc': {
        const arcCenter3d = cs.to3d(curve.center);
        // Normal must be XAxis × YAxis so the Arc3D's internal frame matches the 2D X/Y axes.
        const arcNormal = cs.xAxis.cross(cs.yAxis);
        result.push(
          new Arc3D(
            arcCenter3d,
            arcNormal,
            cs.xAxis,
            curve.radius,
            curve.startAngle,
            curve.endAngle,
            curve.isCounterClockwise,
          ),
        );
        break;
      }
      case 'circle':
        result.push(new Circle3D(cs.to3d(curve.center), curve.radius, cs.zAxis));
        break;
    }
  }
  return result;
}
