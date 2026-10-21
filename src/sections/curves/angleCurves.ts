import { Arc2D, type Curve2D, Line2D, Point2D } from '../../geometry';
import type { Angle } from '../../shapes/profileShape';

export function buildAngleOuter(shape: Angle): Curve2D[] {
  // Shift all coordinates so that the bounding box is centered at the origin.
  // The natural drawing below uses (0,0) at the outer L corner with both legs in the
  // first quadrant; without this offset, InsertPosition.CenterCenter would place the
  // outer corner on the path line instead of the profile's bounding-box center.
  const cx = shape.legWidth / 2;
  const cy = shape.legHeight / 2;
  const p = (x: number, y: number): Point2D => new Point2D(x - cx, y - cy);

  const curves: Curve2D[] = [];

  // Start from bottom-left corner and go counterclockwise

  // Bottom edge
  if (shape.outerFilletRadius > 0) {
    curves.push(new Line2D(p(shape.outerFilletRadius, 0), p(shape.legWidth, 0)));
  } else {
    curves.push(new Line2D(p(0, 0), p(shape.legWidth, 0)));
  }

  // Right edge of horizontal leg
  if (shape.toeRadius > 0) {
    curves.push(new Line2D(p(shape.legWidth, 0), p(shape.legWidth, shape.thickness - shape.toeRadius)));

    // Bottom-right toe radius (inside the angle)
    curves.push(new Arc2D(
      p(shape.legWidth - shape.toeRadius, shape.thickness - shape.toeRadius),
      shape.toeRadius,
      0,
      Math.PI / 2,
      true,
    ));

    curves.push(new Line2D(p(shape.legWidth - shape.toeRadius, shape.thickness), p(shape.thickness + shape.innerFilletRadius, shape.thickness)));
  } else {
    curves.push(new Line2D(p(shape.legWidth, 0), p(shape.legWidth, shape.thickness)));
    curves.push(new Line2D(p(shape.legWidth, shape.thickness), p(shape.thickness + shape.innerFilletRadius, shape.thickness)));
  }

  // Inner fillet at corner
  if (shape.innerFilletRadius > 0) {
    curves.push(new Arc2D(
      p(shape.thickness + shape.innerFilletRadius, shape.thickness + shape.innerFilletRadius),
      shape.innerFilletRadius,
      (Math.PI / 2) * 3,
      Math.PI,
      false,
    ));

    curves.push(new Line2D(p(shape.thickness, shape.thickness + shape.innerFilletRadius), p(shape.thickness, shape.legHeight - shape.toeRadius)));
  } else {
    curves.push(new Line2D(p(shape.thickness, shape.thickness), p(shape.thickness, shape.legHeight - shape.toeRadius)));
  }

  // Top toe radius (inside the angle)
  if (shape.toeRadius > 0) {
    curves.push(new Arc2D(
      p(shape.thickness - shape.toeRadius, shape.legHeight - shape.toeRadius),
      shape.toeRadius,
      0,
      Math.PI / 2,
      true,
    ));

    curves.push(new Line2D(p(shape.thickness - shape.toeRadius, shape.legHeight), p(0, shape.legHeight)));
  } else {
    curves.push(new Line2D(p(shape.thickness, shape.legHeight), p(0, shape.legHeight)));
  }

  // Left edge of vertical leg
  if (shape.outerFilletRadius > 0) {
    curves.push(new Line2D(p(0, shape.legHeight), p(0, shape.outerFilletRadius)));

    // Outer fillet
    curves.push(new Arc2D(
      p(shape.outerFilletRadius, shape.outerFilletRadius),
      shape.outerFilletRadius,
      Math.PI,
      (3 * Math.PI) / 2,
      true, // counterclockwise
    ));
  } else {
    curves.push(new Line2D(p(0, shape.legHeight), p(0, 0)));
  }

  return curves;
}
