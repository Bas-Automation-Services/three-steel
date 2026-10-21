import { TOLERANCE } from './constants';

export class Vector3D {
  constructor(
    readonly x: number,
    readonly y: number,
    readonly z: number,
  ) {}

  static readonly X_AXIS = new Vector3D(1, 0, 0);
  static readonly Y_AXIS = new Vector3D(0, 1, 0);
  static readonly Z_AXIS = new Vector3D(0, 0, 1);

  get length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  get lengthSquared(): number {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }

  add(other: Vector3D): Vector3D {
    return new Vector3D(this.x + other.x, this.y + other.y, this.z + other.z);
  }

  sub(other: Vector3D): Vector3D {
    return new Vector3D(this.x - other.x, this.y - other.y, this.z - other.z);
  }

  scale(s: number): Vector3D {
    return new Vector3D(this.x * s, this.y * s, this.z * s);
  }

  neg(): Vector3D {
    return new Vector3D(-this.x, -this.y, -this.z);
  }

  dot(other: Vector3D): number {
    return this.x * other.x + this.y * other.y + this.z * other.z;
  }

  cross(other: Vector3D): Vector3D {
    return new Vector3D(
      this.y * other.z - this.z * other.y,
      this.z * other.x - this.x * other.z,
      this.x * other.y - this.y * other.x,
    );
  }

  normalized(): Vector3D {
    const len = this.length;
    return len > 0 ? new Vector3D(this.x / len, this.y / len, this.z / len) : new Vector3D(0, 0, 0);
  }

  angleTo(other: Vector3D): number {
    return Math.acos(this.dot(other) / (this.length * other.length));
  }

  isParallel(other: Vector3D, tolerance = TOLERANCE): boolean {
    return this.cross(other).length < tolerance;
  }

  isPerpendicular(other: Vector3D, tolerance = TOLERANCE): boolean {
    return Math.abs(this.dot(other)) < tolerance;
  }

  /** Rodrigues' rotation formula. */
  rotateAroundAxis(axis: Vector3D, angleRadians: number): Vector3D {
    const k = axis.normalized();
    const cosTheta = Math.cos(angleRadians);
    const sinTheta = Math.sin(angleRadians);

    const dotProduct = this.dot(k);
    const crossProduct = k.cross(this);

    return this.scale(cosTheta)
      .add(crossProduct.scale(sinTheta))
      .add(k.scale(dotProduct * (1 - cosTheta)));
  }

  isEqualTo(other: Vector3D, tolerance = 1e-10): boolean {
    return (
      Math.abs(this.x - other.x) < tolerance &&
      Math.abs(this.y - other.y) < tolerance &&
      Math.abs(this.z - other.z) < tolerance
    );
  }
}
