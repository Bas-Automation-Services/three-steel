import { Circle2D, type Curve2D, Point2D } from '../../geometry';
import type { Circle } from '../../shapes/profileShape';

export function buildCircleOuter(shape: Circle): Curve2D[] {
  const radius = shape.diameter / 2;
  return [new Circle2D(new Point2D(0, 0), radius)];
}
