import { Arc2D, type Curve2D, Line2D, Point2D } from '../../geometry';
import type { UShape } from '../../shapes/profileShape';

export function buildUShapeOuter(shape: UShape): Curve2D[] {
  const halfHeight = shape.height / 2;
  const halfWidth = shape.flangeWidth / 2;
  const curves: Curve2D[] = [];

  const webEdgeX = -halfWidth;
  const flangeEdgeX = halfWidth;
  const innerWebX = shape.webThickness - halfWidth;

  const slopeTan = shape.flangeSlope / 100.0;
  const slopeRadians = Math.atan(slopeTan);
  // T is measured at X=0 (profile center). Slope makes flange thinner toward tip.
  // Inner surface: Y(X) = (-halfH + T) - slopeTan * X  (slopes away from outer edge toward tip)
  const slopeOffsetAtWeb = -slopeTan * innerWebX; // positive (thicker at web)
  const slopeOffsetAtTip = -slopeTan * flangeEdgeX; // negative (thinner at tip)

  // We need innerYCoordinate for the inner web line; computed during bottom flange construction
  let bottomInnerWebY: number;
  let topInnerWebY: number;

  // ===== 1. Bottom line (left to right) =====
  curves.push(new Line2D(new Point2D(webEdgeX, -halfHeight), new Point2D(flangeEdgeX, -halfHeight)));

  // ===== 2. Bottom flange: up right side → outer fillet (CCW) → slope left → inner fillet (CW) =====
  if (shape.outerFilletRadius > 0) {
    const filletStartY = -halfHeight + shape.flangeThickness + slopeOffsetAtTip - shape.outerFilletRadius;
    curves.push(new Line2D(new Point2D(flangeEdgeX, -halfHeight), new Point2D(flangeEdgeX, filletStartY)));

    const outerFilletCenter = new Point2D(flangeEdgeX - shape.outerFilletRadius, filletStartY);
    const outerFilletEndAngle = Math.PI / 2 - slopeRadians;
    curves.push(new Arc2D(outerFilletCenter, shape.outerFilletRadius, 0.0, outerFilletEndAngle, true));

    const outerFilletEndX = outerFilletCenter.x + shape.outerFilletRadius * Math.cos(outerFilletEndAngle);
    const outerFilletEndY = outerFilletCenter.y + shape.outerFilletRadius * Math.sin(outerFilletEndAngle);

    if (shape.innerFilletRadius > 0) {
      const innerFlangeSurfaceY = -halfHeight + shape.flangeThickness + slopeOffsetAtWeb;
      const availableSpace = -innerFlangeSurfaceY;
      const effectiveFilletRadius = Math.min(shape.innerFilletRadius, availableSpace * 0.95);

      const innerFilletCenterX = innerWebX + effectiveFilletRadius;
      const innerFilletCenterY = innerFlangeSurfaceY + effectiveFilletRadius;
      const innerFilletStartAngle = (Math.PI * 3) / 2 - slopeRadians;

      const innerFilletStartX = innerFilletCenterX + effectiveFilletRadius * Math.cos(innerFilletStartAngle);
      const innerFilletStartY = innerFilletCenterY + effectiveFilletRadius * Math.sin(innerFilletStartAngle);

      curves.push(new Line2D(new Point2D(outerFilletEndX, outerFilletEndY), new Point2D(innerFilletStartX, innerFilletStartY)));
      curves.push(new Arc2D(new Point2D(innerFilletCenterX, innerFilletCenterY), effectiveFilletRadius, innerFilletStartAngle, Math.PI, false));

      bottomInnerWebY = innerFilletCenterY;
    } else {
      bottomInnerWebY = -halfHeight + shape.flangeThickness + slopeOffsetAtWeb;
      curves.push(new Line2D(new Point2D(outerFilletEndX, outerFilletEndY), new Point2D(innerWebX, bottomInnerWebY)));
    }
  } else {
    const tipSurfaceY = -halfHeight + shape.flangeThickness + slopeOffsetAtTip;
    curves.push(new Line2D(new Point2D(flangeEdgeX, -halfHeight), new Point2D(flangeEdgeX, tipSurfaceY)));

    if (shape.innerFilletRadius > 0) {
      const innerFlangeSurfaceY = -halfHeight + shape.flangeThickness + slopeOffsetAtWeb;
      const availableSpace = -innerFlangeSurfaceY;
      const effectiveFilletRadius = Math.min(shape.innerFilletRadius, availableSpace * 0.95);

      const innerFilletCenterX = innerWebX + effectiveFilletRadius;
      const innerFilletCenterY = innerFlangeSurfaceY + effectiveFilletRadius;
      const innerFilletStartAngle = (Math.PI * 3) / 2 - slopeRadians;

      const innerFilletStartX = innerFilletCenterX + effectiveFilletRadius * Math.cos(innerFilletStartAngle);
      const innerFilletStartY = innerFilletCenterY + effectiveFilletRadius * Math.sin(innerFilletStartAngle);

      curves.push(new Line2D(new Point2D(flangeEdgeX, tipSurfaceY), new Point2D(innerFilletStartX, innerFilletStartY)));
      curves.push(new Arc2D(new Point2D(innerFilletCenterX, innerFilletCenterY), effectiveFilletRadius, Math.PI, innerFilletStartAngle, true));

      bottomInnerWebY = innerFilletCenterY;
    } else {
      bottomInnerWebY = -halfHeight + shape.flangeThickness + slopeOffsetAtWeb;
      curves.push(new Line2D(new Point2D(flangeEdgeX, tipSurfaceY), new Point2D(innerWebX, bottomInnerWebY)));
    }
  }

  // ===== 3. Inner web (up from bottom to top) =====
  // Top inner web Y is the mirror of bottom
  topInnerWebY = -bottomInnerWebY;
  curves.push(new Line2D(new Point2D(innerWebX, bottomInnerWebY), new Point2D(innerWebX, topInnerWebY)));

  // ===== 4. Top flange: inner fillet (CW) → slope right → outer fillet (CCW) → down right side =====
  // Mirror of bottom: all Y coordinates negated, traversal order reversed
  if (shape.outerFilletRadius > 0) {
    const filletStartY = halfHeight - shape.flangeThickness - slopeOffsetAtTip + shape.outerFilletRadius;

    if (shape.innerFilletRadius > 0) {
      const innerFlangeSurfaceY = halfHeight - shape.flangeThickness - slopeOffsetAtWeb;
      const availableSpace = innerFlangeSurfaceY;
      const effectiveFilletRadius = Math.min(shape.innerFilletRadius, availableSpace * 0.95);

      const innerFilletCenterX = innerWebX + effectiveFilletRadius;
      const innerFilletCenterY = innerFlangeSurfaceY - effectiveFilletRadius;
      const innerFilletSlopeAngle = Math.PI / 2 + slopeRadians;

      const innerFilletSlopeX = innerFilletCenterX + effectiveFilletRadius * Math.cos(innerFilletSlopeAngle);
      const innerFilletSlopeY = innerFilletCenterY + effectiveFilletRadius * Math.sin(innerFilletSlopeAngle);

      curves.push(new Arc2D(new Point2D(innerFilletCenterX, innerFilletCenterY), effectiveFilletRadius, Math.PI, innerFilletSlopeAngle, false));

      const outerFilletCenter = new Point2D(flangeEdgeX - shape.outerFilletRadius, filletStartY);
      const outerFilletSlopeAngle = 2 * Math.PI - (Math.PI / 2 - slopeRadians);
      const outerFilletSlopeX = outerFilletCenter.x + shape.outerFilletRadius * Math.cos(outerFilletSlopeAngle);
      const outerFilletSlopeY = outerFilletCenter.y + shape.outerFilletRadius * Math.sin(outerFilletSlopeAngle);

      curves.push(new Line2D(new Point2D(innerFilletSlopeX, innerFilletSlopeY), new Point2D(outerFilletSlopeX, outerFilletSlopeY)));
      curves.push(new Arc2D(outerFilletCenter, shape.outerFilletRadius, outerFilletSlopeAngle, 0.0, true));
    } else {
      const outerFilletCenter = new Point2D(flangeEdgeX - shape.outerFilletRadius, filletStartY);
      const outerFilletSlopeAngle = 2 * Math.PI - (Math.PI / 2 - slopeRadians);
      const outerFilletSlopeX = outerFilletCenter.x + shape.outerFilletRadius * Math.cos(outerFilletSlopeAngle);
      const outerFilletSlopeY = outerFilletCenter.y + shape.outerFilletRadius * Math.sin(outerFilletSlopeAngle);

      curves.push(new Line2D(new Point2D(innerWebX, topInnerWebY), new Point2D(outerFilletSlopeX, outerFilletSlopeY)));
      curves.push(new Arc2D(outerFilletCenter, shape.outerFilletRadius, outerFilletSlopeAngle, 0.0, true));
    }

    curves.push(new Line2D(new Point2D(flangeEdgeX, filletStartY), new Point2D(flangeEdgeX, halfHeight)));
  } else {
    if (shape.innerFilletRadius > 0) {
      const innerFlangeSurfaceY = halfHeight - shape.flangeThickness - slopeOffsetAtWeb;
      const availableSpace = innerFlangeSurfaceY;
      const effectiveFilletRadius = Math.min(shape.innerFilletRadius, availableSpace * 0.95);

      const innerFilletCenterX = innerWebX + effectiveFilletRadius;
      const innerFilletCenterY = innerFlangeSurfaceY - effectiveFilletRadius;
      const innerFilletSlopeAngle = Math.PI / 2 + slopeRadians;

      const innerFilletSlopeX = innerFilletCenterX + effectiveFilletRadius * Math.cos(innerFilletSlopeAngle);
      const innerFilletSlopeY = innerFilletCenterY + effectiveFilletRadius * Math.sin(innerFilletSlopeAngle);

      curves.push(new Arc2D(new Point2D(innerFilletCenterX, innerFilletCenterY), effectiveFilletRadius, innerFilletSlopeAngle, Math.PI, true));
      curves.push(new Line2D(new Point2D(innerFilletSlopeX, innerFilletSlopeY), new Point2D(flangeEdgeX, halfHeight - shape.flangeThickness - slopeOffsetAtTip)));
    } else {
      curves.push(new Line2D(new Point2D(innerWebX, topInnerWebY), new Point2D(flangeEdgeX, halfHeight - shape.flangeThickness - slopeOffsetAtTip)));
    }

    curves.push(new Line2D(new Point2D(flangeEdgeX, halfHeight - shape.flangeThickness - slopeOffsetAtTip), new Point2D(flangeEdgeX, halfHeight)));
  }

  // ===== 5. Top line (right to left) =====
  curves.push(new Line2D(new Point2D(flangeEdgeX, halfHeight), new Point2D(webEdgeX, halfHeight)));

  // ===== 6. Outer web (down, closes loop) =====
  curves.push(new Line2D(new Point2D(webEdgeX, halfHeight), new Point2D(webEdgeX, -halfHeight)));

  return curves;
}
