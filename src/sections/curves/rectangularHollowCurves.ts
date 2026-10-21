import { Arc2D, type Curve2D, Line2D, Point2D } from '../../geometry';
import type { RectangularHollow } from '../../shapes/profileShape';

export function buildRectangularHollowOuter(shape: RectangularHollow): Curve2D[] {
  // Ensure corner radius is valid
  const cornerRadius = Math.min(shape.outerCornerRadius, Math.min(shape.width / 2, shape.height / 2));

  const halfWidth = shape.width / 2;
  const halfHeight = shape.height / 2;

  const curves: Curve2D[] = [];

  // Outer profile
  const outerInnerWidth = halfWidth - cornerRadius;
  const outerInnerHeight = halfHeight - cornerRadius;

  // Bottom line
  if (outerInnerWidth > 0)
    curves.push(new Line2D(new Point2D(-outerInnerWidth, -halfHeight), new Point2D(outerInnerWidth, -halfHeight)));

  // Bottom-right corner
  if (cornerRadius > 0) {
    curves.push(new Arc2D(
      new Point2D(outerInnerWidth, -outerInnerHeight),
      cornerRadius,
      -Math.PI / 2,
      0,
      true,
    ));
  }

  // Right line
  if (outerInnerHeight > 0)
    curves.push(new Line2D(new Point2D(halfWidth, -outerInnerHeight), new Point2D(halfWidth, outerInnerHeight)));

  // Top-right corner
  if (cornerRadius > 0) {
    curves.push(new Arc2D(
      new Point2D(outerInnerWidth, outerInnerHeight),
      cornerRadius,
      0,
      Math.PI / 2,
      true,
    ));
  }

  // Top line
  if (outerInnerWidth > 0)
    curves.push(new Line2D(new Point2D(outerInnerWidth, halfHeight), new Point2D(-outerInnerWidth, halfHeight)));

  // Top-left corner
  if (cornerRadius > 0) {
    curves.push(new Arc2D(
      new Point2D(-outerInnerWidth, outerInnerHeight),
      cornerRadius,
      Math.PI / 2,
      Math.PI,
      true,
    ));
  }

  // Left line
  if (outerInnerHeight > 0)
    curves.push(new Line2D(new Point2D(-halfWidth, outerInnerHeight), new Point2D(-halfWidth, -outerInnerHeight)));

  // Bottom-left corner
  if (cornerRadius > 0) {
    curves.push(new Arc2D(
      new Point2D(-outerInnerWidth, -outerInnerHeight),
      cornerRadius,
      Math.PI,
      (3 * Math.PI) / 2,
      true,
    ));
  }

  return curves;
}

export function buildRectangularHollowInner(shape: RectangularHollow): Curve2D[][] {
  // Ensure thickness is valid
  const thickness = Math.min(shape.wallThickness, Math.min(shape.width / 2, shape.height / 2));

  const halfWidth = shape.width / 2;
  const halfHeight = shape.height / 2;
  const innerHalfWidth = halfWidth - thickness;
  const innerHalfHeight = halfHeight - thickness;

  // Only create inner contour if there's space for it
  if (innerHalfWidth <= 0 || innerHalfHeight <= 0) return [];

  let innerCornerRadius = Math.max(0, shape.outerCornerRadius - thickness);
  // Limit corner radius so opposite arcs don't overlap
  // When radius = halfDimension/2, arcs meet tangentially (valid geometry)
  // When radius > halfDimension/2, arcs would overlap (invalid)
  innerCornerRadius = Math.min(innerCornerRadius, innerHalfWidth / 2);
  innerCornerRadius = Math.min(innerCornerRadius, innerHalfHeight / 2);
  const innerCurves: Curve2D[] = [];

  if (innerCornerRadius > 0) {
    // Rounded inner rectangle
    const innerInnerWidth = innerHalfWidth - innerCornerRadius;
    const innerInnerHeight = innerHalfHeight - innerCornerRadius;

    // Note: Inner profile goes clockwise (opposite of outer), so these four arcs pass
    // `isCounterClockwise = false`. Passing `true` sends every inner corner the long way
    // round: a 270° sweep instead of 90°, self-intersecting the bore.
    // Bottom-left corner
    innerCurves.push(new Arc2D(
      new Point2D(-innerInnerWidth, -innerInnerHeight),
      innerCornerRadius,
      (3 * Math.PI) / 2,
      Math.PI,
      false, // clockwise
    ));

    // Left line
    if (innerInnerHeight > 0)
      innerCurves.push(new Line2D(new Point2D(-innerHalfWidth, -innerInnerHeight), new Point2D(-innerHalfWidth, innerInnerHeight)));

    // Top-left corner
    innerCurves.push(new Arc2D(
      new Point2D(-innerInnerWidth, innerInnerHeight),
      innerCornerRadius,
      Math.PI,
      Math.PI / 2,
      false, // clockwise
    ));

    // Top line
    if (innerInnerWidth > 0)
      innerCurves.push(new Line2D(new Point2D(-innerInnerWidth, innerHalfHeight), new Point2D(innerInnerWidth, innerHalfHeight)));

    // Top-right corner
    innerCurves.push(new Arc2D(
      new Point2D(innerInnerWidth, innerInnerHeight),
      innerCornerRadius,
      Math.PI / 2,
      0,
      false, // clockwise
    ));

    // Right line
    if (innerInnerHeight > 0)
      innerCurves.push(new Line2D(new Point2D(innerHalfWidth, innerInnerHeight), new Point2D(innerHalfWidth, -innerInnerHeight)));

    // Bottom-right corner
    innerCurves.push(new Arc2D(
      new Point2D(innerInnerWidth, -innerInnerHeight),
      innerCornerRadius,
      0,
      -Math.PI / 2,
      false, // clockwise
    ));

    // Bottom line
    if (innerInnerWidth > 0)
      innerCurves.push(new Line2D(new Point2D(innerInnerWidth, -innerHalfHeight), new Point2D(-innerInnerWidth, -innerHalfHeight)));
  } else {
    // Sharp inner rectangle (no corner radius)
    innerCurves.push(new Line2D(new Point2D(-innerHalfWidth, -innerHalfHeight), new Point2D(-innerHalfWidth, innerHalfHeight)));
    innerCurves.push(new Line2D(new Point2D(-innerHalfWidth, innerHalfHeight), new Point2D(innerHalfWidth, innerHalfHeight)));
    innerCurves.push(new Line2D(new Point2D(innerHalfWidth, innerHalfHeight), new Point2D(innerHalfWidth, -innerHalfHeight)));
    innerCurves.push(new Line2D(new Point2D(innerHalfWidth, -innerHalfHeight), new Point2D(-innerHalfWidth, -innerHalfHeight)));
  }

  return [innerCurves];
}
