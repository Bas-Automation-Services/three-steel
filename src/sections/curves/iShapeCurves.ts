import { Arc2D, type Curve2D, Line2D, Point2D } from '../../geometry';
import type { IShape } from '../../shapes/profileShape';

export function buildIShapeOuter(shape: IShape): Curve2D[] {
  const halfH = shape.height / 2;
  const halfW = shape.flangeWidth / 2;
  const halfWeb = shape.webThickness / 2;

  const slopeTan = shape.flangeSlope / 100.0;
  const slopeRad = Math.atan(slopeTan);
  const normF = Math.sqrt(1 + slopeTan * slopeTan);

  // T is measured at X = halfW/2. Slope line for the top flange (positive Y half):
  //   innerY(|X|) = innerYRef + slopeTan * (|X| - refX)
  // where innerYRef = halfH - T, refX = halfW / 2
  const refX = halfW / 2;
  const innerYRef = halfH - shape.flangeThickness;

  const innerY = (absX: number): number => innerYRef + slopeTan * (absX - refX);

  let leftWebBottomY: number;
  let leftWebTopY: number;

  const curves: Curve2D[] = [];

  // ===== BOTTOM FLANGE, LEFT HALF =====
  if (shape.toeRadius > 0) {
    const toeCX = -halfW + shape.toeRadius;
    const slopeYAtToeCX = -innerY(halfW - shape.toeRadius); // bottom half = negated
    const toeCY = slopeYAtToeCX - shape.toeRadius * normF; // toward outer edge (more negative Y)

    const toeVerticalPt = new Point2D(-halfW, toeCY);
    curves.push(new Line2D(new Point2D(-halfW, -halfH), toeVerticalPt));

    const toeSlopeAngle = Math.PI / 2 + slopeRad;
    const toeSlopePt = new Point2D(
      toeCX + shape.toeRadius * Math.cos(toeSlopeAngle),
      toeCY + shape.toeRadius * Math.sin(toeSlopeAngle),
    );
    curves.push(new Arc2D(new Point2D(toeCX, toeCY), shape.toeRadius, Math.PI, toeSlopeAngle, false));

    if (shape.filletRadius > 0) {
      const fCX = -halfWeb - shape.filletRadius;
      const slopeYAtFCX = -innerY(halfWeb + shape.filletRadius);
      const fCY = slopeYAtFCX + shape.filletRadius * normF; // toward web (more positive Y)

      const filletSlopeAngle = (3 * Math.PI) / 2 + slopeRad;
      const filletSlopePt = new Point2D(
        fCX + shape.filletRadius * Math.cos(filletSlopeAngle),
        fCY + shape.filletRadius * Math.sin(filletSlopeAngle),
      );

      curves.push(new Line2D(toeSlopePt, filletSlopePt));
      curves.push(new Arc2D(new Point2D(fCX, fCY), shape.filletRadius, filletSlopeAngle, 0, true));
      leftWebBottomY = fCY; // web starts at fillet center Y
    } else {
      const webPt = new Point2D(-halfWeb, -innerY(halfWeb));
      curves.push(new Line2D(toeSlopePt, webPt));
      leftWebBottomY = webPt.y;
    }
  } else {
    const tipPt = new Point2D(-halfW, -innerY(halfW));
    curves.push(new Line2D(new Point2D(-halfW, -halfH), tipPt));

    if (shape.filletRadius > 0) {
      const fCX = -halfWeb - shape.filletRadius;
      const slopeYAtFCX = -innerY(halfWeb + shape.filletRadius);
      const fCY = slopeYAtFCX + shape.filletRadius * normF;

      const filletSlopeAngle = (3 * Math.PI) / 2 + slopeRad;
      const filletSlopePt = new Point2D(
        fCX + shape.filletRadius * Math.cos(filletSlopeAngle),
        fCY + shape.filletRadius * Math.sin(filletSlopeAngle),
      );

      curves.push(new Line2D(tipPt, filletSlopePt));
      curves.push(new Arc2D(new Point2D(fCX, fCY), shape.filletRadius, filletSlopeAngle, 0, true));
      leftWebBottomY = fCY;
    } else {
      const webPt = new Point2D(-halfWeb, -innerY(halfWeb));
      curves.push(new Line2D(tipPt, webPt));
      leftWebBottomY = webPt.y;
    }
  }

  // ===== LEFT WEB (up) =====
  leftWebTopY = -leftWebBottomY; // symmetric
  curves.push(new Line2D(new Point2D(-halfWeb, leftWebBottomY), new Point2D(-halfWeb, leftWebTopY)));

  // ===== TOP FLANGE, LEFT HALF =====
  if (shape.filletRadius > 0) {
    const fCX = -halfWeb - shape.filletRadius;
    const slopeYAtFCX = innerY(halfWeb + shape.filletRadius);
    const fCY = slopeYAtFCX - shape.filletRadius * normF; // toward web (more negative Y)

    const filletSlopeAngle = Math.PI / 2 - slopeRad;
    const filletSlopePt = new Point2D(
      fCX + shape.filletRadius * Math.cos(filletSlopeAngle),
      fCY + shape.filletRadius * Math.sin(filletSlopeAngle),
    );

    curves.push(new Arc2D(new Point2D(fCX, fCY), shape.filletRadius, 0, filletSlopeAngle, true));

    if (shape.toeRadius > 0) {
      const toeCX = -halfW + shape.toeRadius;
      const slopeYAtToeCX = innerY(halfW - shape.toeRadius);
      const toeCY = slopeYAtToeCX + shape.toeRadius * normF; // toward outer edge (more positive Y)

      const toeSlopeAngle = (3 * Math.PI) / 2 - slopeRad;
      const toeSlopePt = new Point2D(
        toeCX + shape.toeRadius * Math.cos(toeSlopeAngle),
        toeCY + shape.toeRadius * Math.sin(toeSlopeAngle),
      );

      curves.push(new Line2D(filletSlopePt, toeSlopePt));
      curves.push(new Arc2D(new Point2D(toeCX, toeCY), shape.toeRadius, toeSlopeAngle, Math.PI, false));

      const toeVerticalPt = new Point2D(-halfW, toeCY);
      curves.push(new Line2D(toeVerticalPt, new Point2D(-halfW, halfH)));
    } else {
      const tipPt = new Point2D(-halfW, innerY(halfW));
      curves.push(new Line2D(filletSlopePt, tipPt));
      curves.push(new Line2D(tipPt, new Point2D(-halfW, halfH)));
    }
  } else {
    if (shape.toeRadius > 0) {
      const toeCX = -halfW + shape.toeRadius;
      const slopeYAtToeCX = innerY(halfW - shape.toeRadius);
      const toeCY = slopeYAtToeCX + shape.toeRadius * normF;

      const toeSlopeAngle = (3 * Math.PI) / 2 + slopeRad;
      const toeSlopePt = new Point2D(
        toeCX + shape.toeRadius * Math.cos(toeSlopeAngle),
        toeCY + shape.toeRadius * Math.sin(toeSlopeAngle),
      );

      curves.push(new Line2D(new Point2D(-halfWeb, innerY(halfWeb)), toeSlopePt));
      curves.push(new Arc2D(new Point2D(toeCX, toeCY), shape.toeRadius, toeSlopeAngle, Math.PI, false));
      curves.push(new Line2D(new Point2D(-halfW, toeCY), new Point2D(-halfW, halfH)));
    } else {
      curves.push(new Line2D(new Point2D(-halfWeb, innerY(halfWeb)), new Point2D(-halfW, innerY(halfW))));
      curves.push(new Line2D(new Point2D(-halfW, innerY(halfW)), new Point2D(-halfW, halfH)));
    }
  }

  // ===== TOP EDGE (left to right) =====
  curves.push(new Line2D(new Point2D(-halfW, halfH), new Point2D(halfW, halfH)));

  // ===== TOP FLANGE, RIGHT HALF =====
  if (shape.toeRadius > 0) {
    const toeCX = halfW - shape.toeRadius;
    const slopeYAtToeCX = innerY(halfW - shape.toeRadius);
    const toeCY = slopeYAtToeCX + shape.toeRadius * normF;

    const toeVerticalPt = new Point2D(halfW, toeCY);
    curves.push(new Line2D(new Point2D(halfW, halfH), toeVerticalPt));

    const toeSlopeAngle = (3 * Math.PI) / 2 + slopeRad; // mirrored
    const toeSlopePt = new Point2D(
      toeCX + shape.toeRadius * Math.cos(toeSlopeAngle),
      toeCY + shape.toeRadius * Math.sin(toeSlopeAngle),
    );
    curves.push(new Arc2D(new Point2D(toeCX, toeCY), shape.toeRadius, 0, toeSlopeAngle, false));

    if (shape.filletRadius > 0) {
      const fCX = halfWeb + shape.filletRadius;
      const slopeYAtFCX = innerY(halfWeb + shape.filletRadius);
      const fCY = slopeYAtFCX - shape.filletRadius * normF;

      const filletSlopeAngle = Math.PI / 2 + slopeRad;
      const filletSlopePt = new Point2D(
        fCX + shape.filletRadius * Math.cos(filletSlopeAngle),
        fCY + shape.filletRadius * Math.sin(filletSlopeAngle),
      );

      curves.push(new Line2D(toeSlopePt, filletSlopePt));
      curves.push(new Arc2D(new Point2D(fCX, fCY), shape.filletRadius, filletSlopeAngle, Math.PI, true));
    } else {
      curves.push(new Line2D(toeSlopePt, new Point2D(halfWeb, innerY(halfWeb))));
    }
  } else {
    curves.push(new Line2D(new Point2D(halfW, halfH), new Point2D(halfW, innerY(halfW))));

    if (shape.filletRadius > 0) {
      const fCX = halfWeb + shape.filletRadius;
      const slopeYAtFCX = innerY(halfWeb + shape.filletRadius);
      const fCY = slopeYAtFCX - shape.filletRadius * normF;

      const filletSlopeAngle = Math.PI / 2 + slopeRad;
      const filletSlopePt = new Point2D(
        fCX + shape.filletRadius * Math.cos(filletSlopeAngle),
        fCY + shape.filletRadius * Math.sin(filletSlopeAngle),
      );

      curves.push(new Line2D(new Point2D(halfW, innerY(halfW)), filletSlopePt));
      curves.push(new Arc2D(new Point2D(fCX, fCY), shape.filletRadius, filletSlopeAngle, Math.PI, true));
    } else {
      curves.push(new Line2D(new Point2D(halfW, innerY(halfW)), new Point2D(halfWeb, innerY(halfWeb))));
    }
  }

  // ===== RIGHT WEB (down) =====
  curves.push(new Line2D(new Point2D(halfWeb, leftWebTopY), new Point2D(halfWeb, leftWebBottomY)));

  // ===== BOTTOM FLANGE, RIGHT HALF =====
  if (shape.filletRadius > 0) {
    const fCX = halfWeb + shape.filletRadius;
    const slopeYAtFCX = -innerY(halfWeb + shape.filletRadius);
    const fCY = slopeYAtFCX + shape.filletRadius * normF;

    const filletSlopeAngle = Math.PI + Math.PI / 2 - slopeRad;
    const filletSlopePt = new Point2D(
      fCX + shape.filletRadius * Math.cos(filletSlopeAngle),
      fCY + shape.filletRadius * Math.sin(filletSlopeAngle),
    );

    curves.push(new Arc2D(new Point2D(fCX, fCY), shape.filletRadius, Math.PI, filletSlopeAngle, true));

    if (shape.toeRadius > 0) {
      const toeCX = halfW - shape.toeRadius;
      const slopeYAtToeCX = -innerY(halfW - shape.toeRadius);
      const toeCY = slopeYAtToeCX - shape.toeRadius * normF;

      const toeSlopeAngle = Math.PI / 2 - slopeRad;
      const toeSlopePt = new Point2D(
        toeCX + shape.toeRadius * Math.cos(toeSlopeAngle),
        toeCY + shape.toeRadius * Math.sin(toeSlopeAngle),
      );

      curves.push(new Line2D(filletSlopePt, toeSlopePt));
      curves.push(new Arc2D(new Point2D(toeCX, toeCY), shape.toeRadius, toeSlopeAngle, 0, false));
      curves.push(new Line2D(new Point2D(halfW, toeCY), new Point2D(halfW, -halfH)));
    } else {
      curves.push(new Line2D(filletSlopePt, new Point2D(halfW, -innerY(halfW))));
      curves.push(new Line2D(new Point2D(halfW, -innerY(halfW)), new Point2D(halfW, -halfH)));
    }
  } else {
    if (shape.toeRadius > 0) {
      const toeCX = halfW - shape.toeRadius;
      const slopeYAtToeCX = -innerY(halfW - shape.toeRadius);
      const toeCY = slopeYAtToeCX - shape.toeRadius * normF;

      const toeSlopeAngle = Math.PI / 2 - slopeRad;
      const toeSlopePt = new Point2D(
        toeCX + shape.toeRadius * Math.cos(toeSlopeAngle),
        toeCY + shape.toeRadius * Math.sin(toeSlopeAngle),
      );

      curves.push(new Line2D(new Point2D(halfWeb, -innerY(halfWeb)), toeSlopePt));
      curves.push(new Arc2D(new Point2D(toeCX, toeCY), shape.toeRadius, toeSlopeAngle, 0, false));
      curves.push(new Line2D(new Point2D(halfW, toeCY), new Point2D(halfW, -halfH)));
    } else {
      curves.push(new Line2D(new Point2D(halfWeb, -innerY(halfWeb)), new Point2D(halfW, -innerY(halfW))));
      curves.push(new Line2D(new Point2D(halfW, -innerY(halfW)), new Point2D(halfW, -halfH)));
    }
  }

  // ===== BOTTOM EDGE (right to left, closes loop) =====
  curves.push(new Line2D(new Point2D(halfW, -halfH), new Point2D(-halfW, -halfH)));

  return curves;
}
