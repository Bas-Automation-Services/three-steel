import { Vector3D } from './vector3d';

export class Point3D {
  constructor(
    readonly x: number,
    readonly y: number,
    readonly z: number,
  ) {}

  add(v: Vector3D): Point3D {
    return new Point3D(this.x + v.x, this.y + v.y, this.z + v.z);
  }

  /** point - point = vector */
  sub(other: Point3D): Vector3D {
    return new Vector3D(this.x - other.x, this.y - other.y, this.z - other.z);
  }

  /** point - vector = point */
  subV(v: Vector3D): Point3D {
    return new Point3D(this.x - v.x, this.y - v.y, this.z - v.z);
  }

  distanceTo(other: Point3D): number {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    const dz = this.z - other.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  isEqualTo(other: Point3D, tolerance = 1e-10): boolean {
    return (
      Math.abs(this.x - other.x) < tolerance &&
      Math.abs(this.y - other.y) < tolerance &&
      Math.abs(this.z - other.z) < tolerance
    );
  }
}
