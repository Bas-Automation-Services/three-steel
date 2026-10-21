import { type Curve2D, Line2D, Point2D } from '../../geometry';
import type { Rectangle } from '../../shapes/profileShape';

export function buildRectangleOuter(shape: Rectangle): Curve2D[] {
  const halfWidth = shape.width / 2;
  const halfHeight = shape.height / 2;

  return [
    new Line2D(new Point2D(-halfWidth, -halfHeight), new Point2D(halfWidth, -halfHeight)),
    new Line2D(new Point2D(halfWidth, -halfHeight), new Point2D(halfWidth, halfHeight)),
    new Line2D(new Point2D(halfWidth, halfHeight), new Point2D(-halfWidth, halfHeight)),
    new Line2D(new Point2D(-halfWidth, halfHeight), new Point2D(-halfWidth, -halfHeight)),
  ];
}
