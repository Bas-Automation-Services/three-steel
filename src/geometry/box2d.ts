import { Point2D } from './point2d';

export class Box2D {
  constructor(
    readonly min: Point2D,
    readonly max: Point2D,
  ) {}

  get center(): Point2D {
    return new Point2D((this.min.x + this.max.x) / 2, (this.min.y + this.max.y) / 2);
  }

  get width(): number {
    return this.max.x - this.min.x;
  }

  get height(): number {
    return this.max.y - this.min.y;
  }

  union(other: Box2D): Box2D {
    return new Box2D(
      new Point2D(Math.min(this.min.x, other.min.x), Math.min(this.min.y, other.min.y)),
      new Point2D(Math.max(this.max.x, other.max.x), Math.max(this.max.y, other.max.y)),
    );
  }
}
