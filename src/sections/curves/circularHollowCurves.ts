import { Circle2D, type Curve2D, Point2D } from '../../geometry';
import type { CircularHollow } from '../../shapes/profileShape';

export function buildCircularHollowOuter(shape: CircularHollow): Curve2D[] {
  const outerRadius = shape.outerDiameter / 2;
  return [new Circle2D(new Point2D(0, 0), outerRadius)];
}

export function buildCircularHollowInner(shape: CircularHollow): Curve2D[][] {
  const outerRadius = shape.outerDiameter / 2;
  const innerRadius = outerRadius - shape.wallThickness;

  // Only create inner contour if there's actually a hole
  if (innerRadius > 0) {
    const innerCurves: Curve2D[] = [new Circle2D(new Point2D(0, 0), innerRadius)];
    return [innerCurves];
  }

  return [];
}
