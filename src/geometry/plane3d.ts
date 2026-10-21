import { Point3D } from './point3d';
import { Vector3D } from './vector3d';

export class Plane3D {
  readonly normal: Vector3D;

  constructor(
    readonly origin: Point3D,
    normal: Vector3D,
  ) {
    this.normal = normal.normalized();
  }

  /** Signed distance from a point to the plane (positive on the normal side). */
  signedDistanceTo(point: Point3D): number {
    return point.sub(this.origin).dot(this.normal);
  }

  /**
   * Intersection line of two planes, or null when they are (near-)parallel (used by
   * Arc3D.snapToPlanes). Solves n1·p = d1, n2·p = d2 with the classic closed form
   * p = (d1·(n2×d) + d2·(d×n1)) / |d|², d = n1×n2 — p is exact on both planes (substituting
   * back: n1·(n2×d) = d·d and n1·(d×n1) = 0). `direction` is unit-length.
   */
  intersectPlane(other: Plane3D): { origin: Point3D; direction: Vector3D } | null {
    const d = this.normal.cross(other.normal);
    // Both normals are unit vectors, so |d|² = sin²(angle) — a scale-free parallelism test.
    if (d.lengthSquared < 1e-18) return null;
    const d1 = this.normal.x * this.origin.x + this.normal.y * this.origin.y + this.normal.z * this.origin.z;
    const d2 = other.normal.x * other.origin.x + other.normal.y * other.origin.y + other.normal.z * other.origin.z;
    const p = other.normal
      .cross(d)
      .scale(d1)
      .add(d.cross(this.normal).scale(d2))
      .scale(1 / d.lengthSquared);
    return { origin: new Point3D(p.x, p.y, p.z), direction: d.normalized() };
  }
}
