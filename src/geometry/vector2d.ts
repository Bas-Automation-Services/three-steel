export class Vector2D {
  constructor(
    readonly x: number,
    readonly y: number,
  ) {}

  get length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  get lengthSquared(): number {
    return this.x * this.x + this.y * this.y;
  }

  add(other: Vector2D): Vector2D {
    return new Vector2D(this.x + other.x, this.y + other.y);
  }

  sub(other: Vector2D): Vector2D {
    return new Vector2D(this.x - other.x, this.y - other.y);
  }

  scale(s: number): Vector2D {
    return new Vector2D(this.x * s, this.y * s);
  }

  neg(): Vector2D {
    return new Vector2D(-this.x, -this.y);
  }

  dot(other: Vector2D): number {
    return this.x * other.x + this.y * other.y;
  }

  /** 2D cross product (scalar): a.x*b.y - a.y*b.x */
  cross(other: Vector2D): number {
    return this.x * other.y - this.y * other.x;
  }

  normalized(): Vector2D {
    const len = this.length;
    return len > 0 ? new Vector2D(this.x / len, this.y / len) : new Vector2D(0, 0);
  }
}
