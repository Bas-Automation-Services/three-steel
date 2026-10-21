// Curve2D discriminated union: Line2D | Arc2D | Circle2D. Keep angle conventions, bounding boxes
// and normalization stable — regression snapshots pin them.
import { Point2D } from './point2d';
import { Vector2D } from './vector2d';
import { Box2D } from './box2d';

export type Curve2D = Line2D | Arc2D | Circle2D;

export class Line2D {
  readonly kind = 'line' as const;

  constructor(
    readonly startPoint: Point2D,
    readonly endPoint: Point2D,
  ) {}

  get direction(): Vector2D {
    return this.endPoint.sub(this.startPoint).normalized();
  }

  get length(): number {
    return this.startPoint.distanceTo(this.endPoint);
  }

  pointAt(t: number): Point2D {
    return this.startPoint.add(this.endPoint.sub(this.startPoint).scale(t));
  }

  tangentAt(_t: number): Vector2D {
    return this.direction;
  }

  get boundingBox(): Box2D {
    return new Box2D(
      new Point2D(Math.min(this.startPoint.x, this.endPoint.x), Math.min(this.startPoint.y, this.endPoint.y)),
      new Point2D(Math.max(this.startPoint.x, this.endPoint.x), Math.max(this.startPoint.y, this.endPoint.y)),
    );
  }

  reverse(): Line2D {
    return new Line2D(this.endPoint, this.startPoint);
  }
}

/** Angle convention: radians from positive X axis, CCW positive; angles normalized to [0, 2π). */
export class Arc2D {
  readonly kind = 'arc' as const;
  readonly startAngle: number;
  readonly endAngle: number;

  constructor(
    readonly center: Point2D,
    readonly radius: number,
    startAngle: number,
    endAngle: number,
    readonly isCounterClockwise = true,
  ) {
    this.startAngle = normalizeAngle(startAngle);
    this.endAngle = normalizeAngle(endAngle);
  }

  get startPoint(): Point2D {
    return this.center.add(
      new Vector2D(this.radius * Math.cos(this.startAngle), this.radius * Math.sin(this.startAngle)),
    );
  }

  get endPoint(): Point2D {
    return this.center.add(
      new Vector2D(this.radius * Math.cos(this.endAngle), this.radius * Math.sin(this.endAngle)),
    );
  }

  get sweepAngle(): number {
    let sweep = this.endAngle - this.startAngle;
    if (this.isCounterClockwise) {
      if (sweep <= 0) sweep += 2 * Math.PI;
    } else {
      if (sweep >= 0) sweep -= 2 * Math.PI;
    }
    return sweep;
  }

  get length(): number {
    return Math.abs(this.sweepAngle) * this.radius;
  }

  pointAt(t: number): Point2D {
    const angle = this.startAngle + t * this.sweepAngle;
    return this.center.add(new Vector2D(this.radius * Math.cos(angle), this.radius * Math.sin(angle)));
  }

  tangentAt(t: number): Vector2D {
    const angle = this.startAngle + t * this.sweepAngle;
    const tangent = new Vector2D(-Math.sin(angle), Math.cos(angle));
    return this.isCounterClockwise ? tangent : tangent.neg();
  }

  private isAngleInArcRange(angle: number): boolean {
    angle = normalizeAngle(angle);
    const start = normalizeAngle(this.startAngle);
    const end = normalizeAngle(this.endAngle);

    if (this.isCounterClockwise) {
      return start <= end ? angle >= start && angle <= end : angle >= start || angle <= end;
    }
    return start >= end ? angle <= start && angle >= end : angle <= start || angle >= end;
  }

  get boundingBox(): Box2D {
    const points: Point2D[] = [this.startPoint, this.endPoint];

    const cardinalAngles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
    for (const angle of cardinalAngles) {
      if (this.isAngleInArcRange(angle)) {
        points.push(
          this.center.add(new Vector2D(this.radius * Math.cos(angle), this.radius * Math.sin(angle))),
        );
      }
    }

    let minX = points[0].x, minY = points[0].y, maxX = points[0].x, maxY = points[0].y;
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return new Box2D(new Point2D(minX, minY), new Point2D(maxX, maxY));
  }

  reverse(): Arc2D {
    return new Arc2D(this.center, this.radius, this.endAngle, this.startAngle, !this.isCounterClockwise);
  }
}

export class Circle2D {
  readonly kind = 'circle' as const;

  constructor(
    readonly center: Point2D,
    readonly radius: number,
  ) {}

  get length(): number {
    return 2 * Math.PI * this.radius;
  }

  pointAt(t: number): Point2D {
    const angle = t * 2 * Math.PI;
    return this.center.add(new Vector2D(this.radius * Math.cos(angle), this.radius * Math.sin(angle)));
  }

  get boundingBox(): Box2D {
    return new Box2D(
      new Point2D(this.center.x - this.radius, this.center.y - this.radius),
      new Point2D(this.center.x + this.radius, this.center.y + this.radius),
    );
  }
}

/** Normalizes an angle to the range [0, 2π). */
export function normalizeAngle(angle: number): number {
  angle = angle % (2 * Math.PI);
  if (angle < 0) angle += 2 * Math.PI;
  return angle;
}
