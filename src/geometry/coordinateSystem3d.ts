import { Point3D } from './point3d';
import { Vector3D } from './vector3d';
import { Point2D } from './point2d';

export class CoordinateSystem3D {
  constructor(
    readonly origin: Point3D,
    readonly xAxis: Vector3D,
    readonly yAxis: Vector3D,
    readonly zAxis: Vector3D,
  ) {}

  /** X kept, Z = X × Y, Y recomputed for orthogonality. */
  static fromOriginAndXy(origin: Point3D, xAxis: Vector3D, yAxis: Vector3D): CoordinateSystem3D {
    const x = xAxis.normalized();
    let y = yAxis.normalized();
    const z = x.cross(y).normalized();
    y = z.cross(x).normalized();
    return new CoordinateSystem3D(origin, x, y, z);
  }

  /** Z kept, Y = Z × xHint, X = Y × Z. */
  static fromOriginAndZAxis(origin: Point3D, zAxis: Vector3D, xHint: Vector3D): CoordinateSystem3D {
    const z = zAxis.normalized();
    const y = z.cross(xHint).normalized();
    const x = y.cross(z).normalized();
    return new CoordinateSystem3D(origin, x, y, z);
  }

  /** Maps a 2D point in this system's XY plane to world space: origin + x*X + y*Y. */
  to3d(p: Point2D): Point3D {
    return this.origin.add(this.xAxis.scale(p.x)).add(this.yAxis.scale(p.y));
  }

  /**
   * Transforms a point from world coordinates to this coordinate system.
   * World→local via row-dot products with the axes.
   */
  toLocal(p: Point3D): Point3D {
    const tx = -(this.xAxis.x * this.origin.x + this.xAxis.y * this.origin.y + this.xAxis.z * this.origin.z);
    const ty = -(this.yAxis.x * this.origin.x + this.yAxis.y * this.origin.y + this.yAxis.z * this.origin.z);
    const tz = -(this.zAxis.x * this.origin.x + this.zAxis.y * this.origin.y + this.zAxis.z * this.origin.z);
    return new Point3D(
      this.xAxis.x * p.x + this.xAxis.y * p.y + this.xAxis.z * p.z + tx,
      this.yAxis.x * p.x + this.yAxis.y * p.y + this.yAxis.z * p.z + ty,
      this.zAxis.x * p.x + this.zAxis.y * p.y + this.zAxis.z * p.z + tz,
    );
  }

  /**
   * Transforms a vector (no translation) from world coordinates to this coordinate system.
   */
  toLocalVector(v: Vector3D): Vector3D {
    return new Vector3D(
      this.xAxis.x * v.x + this.xAxis.y * v.y + this.xAxis.z * v.z,
      this.yAxis.x * v.x + this.yAxis.y * v.y + this.yAxis.z * v.z,
      this.zAxis.x * v.x + this.zAxis.y * v.y + this.zAxis.z * v.z,
    );
  }

  /**
   * Transforms a point from this coordinate system to world coordinates.
   * origin + x·X + y·Y + z·Z.
   */
  toWorld(p: Point3D): Point3D {
    return this.origin
      .add(this.xAxis.scale(p.x))
      .add(this.yAxis.scale(p.y))
      .add(this.zAxis.scale(p.z));
  }

  /**
   * Transforms a vector (no translation) from this coordinate system to world coordinates.
   */
  toWorldVector(v: Vector3D): Vector3D {
    return this.xAxis.scale(v.x).add(this.yAxis.scale(v.y)).add(this.zAxis.scale(v.z));
  }
}
