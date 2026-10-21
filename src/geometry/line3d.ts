import { Point3D } from './point3d';
import { Vector3D } from './vector3d';

export class Line3D {
  readonly kind = 'line3d' as const;

  constructor(
    readonly startPoint: Point3D,
    readonly endPoint: Point3D,
  ) {}

  get direction(): Vector3D {
    return this.endPoint.sub(this.startPoint).normalized();
  }

  get length(): number {
    return this.startPoint.distanceTo(this.endPoint);
  }

  pointAt(t: number): Point3D {
    return this.startPoint.add(this.endPoint.sub(this.startPoint).scale(t));
  }

  /**
   * Unit tangent at parameter t. A line's tangent is its constant direction, so t is ignored —
   * the parameter exists purely so Line3D shares the MemberCurve surface with Arc3D/Helix3D
   * (whose tangents genuinely vary with t).
   */
  tangentAt(_t: number): Vector3D {
    return this.direction;
  }

  get midPoint(): Point3D {
    return this.pointAt(0.5);
  }
}
