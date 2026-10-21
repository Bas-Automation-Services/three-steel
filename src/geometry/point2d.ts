import { Vector2D } from './vector2d';

export class Point2D {
  constructor(
    readonly x: number,
    readonly y: number,
  ) {}

  add(v: Vector2D): Point2D {
    return new Point2D(this.x + v.x, this.y + v.y);
  }

  /** point - point = vector */
  sub(other: Point2D): Vector2D {
    return new Vector2D(this.x - other.x, this.y - other.y);
  }

  /** point - vector = point */
  subV(v: Vector2D): Point2D {
    return new Point2D(this.x - v.x, this.y - v.y);
  }

  distanceTo(other: Point2D): number {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  isEqualTo(other: Point2D, tolerance = 1e-10): boolean {
    return Math.abs(this.x - other.x) < tolerance && Math.abs(this.y - other.y) < tolerance;
  }
}
