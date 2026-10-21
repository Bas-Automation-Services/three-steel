import { Arc2D, type Curve2D, Line2D, Point2D, TOLERANCE } from '../../geometry';
import type { TShape } from '../../shapes/profileShape';

function arcPoint(cx: number, cy: number, r: number, angle: number): Point2D {
  return new Point2D(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
}

export function buildTShapeOuter(shape: TShape): Curve2D[] {
  const halfWidth = shape.flangeWidth / 2;
  const halfWeb = shape.webThickness / 2;
  const halfHeight = shape.height / 2;
  const flangeBottom = shape.height - shape.flangeThickness - halfHeight;

  // Flange slope
  const flangeSlopeTan = shape.flangeSlope / 100.0;
  const flangeSlopeRad = Math.atan(flangeSlopeTan);
  const halfFlangeDepth = (shape.flangeWidth - shape.webThickness) / 2;
  const flangeSlopeOffset = flangeSlopeTan * halfFlangeDepth;

  // Web slope: web is wider at top (flange junction), narrower at bottom
  const webSlopeTan = shape.webSlope / 100.0;
  const webHeight = shape.height - shape.flangeThickness;
  const webSlopeOffset = webSlopeTan * webHeight;

  const halfWebAtTop = halfWeb + webSlopeOffset;
  const halfWebAtBottom = halfWeb;

  // Flange inner surface Y: at tip = flangeBottom, at web = flangeBottom - flangeSlopeOffset
  const flangeYAtTip = flangeBottom;
  const flangeYAtWeb = flangeBottom - flangeSlopeOffset;

  const curves: Curve2D[] = [];

  // ===== BOTTOM EDGE =====
  if (shape.bottomRadius > 0) {
    // Clamp: radius can't exceed half the web width or the arcs would intersect
    const br = Math.min(shape.bottomRadius, halfWebAtBottom);

    const lbCX = -halfWebAtBottom + br;
    const lbCY = br - halfHeight;
    curves.push(new Arc2D(new Point2D(lbCX, lbCY), br, Math.PI, (3 * Math.PI) / 2, true));

    const rbCX = halfWebAtBottom - br;
    const rbCY = br - halfHeight;

    // Only add the bottom line if the arcs don't meet
    if (lbCX < rbCX - TOLERANCE)
      curves.push(new Line2D(new Point2D(lbCX, -halfHeight), new Point2D(rbCX, -halfHeight)));

    curves.push(new Arc2D(new Point2D(rbCX, rbCY), br, (3 * Math.PI) / 2, 0, true));
  } else {
    curves.push(new Line2D(new Point2D(-halfWebAtBottom, -halfHeight), new Point2D(halfWebAtBottom, -halfHeight)));
  }

  // ===== RIGHT WEB (up, possibly tapered) =====
  {
    const bottomY = shape.bottomRadius > 0 ? shape.bottomRadius - halfHeight : -halfHeight;
    const topY = shape.filletRadius > 0 ? flangeYAtWeb - shape.filletRadius : flangeYAtWeb;
    curves.push(new Line2D(new Point2D(halfWebAtBottom, bottomY), new Point2D(halfWebAtTop, topY)));
  }

  // ===== RIGHT FILLET + SLOPED FLANGE SURFACE + RIGHT TOE =====
  if (shape.filletRadius > 0) {
    // Right fillet: connects web top to flange bottom (right side)
    const fCX = halfWebAtTop + shape.filletRadius;
    const fCY = flangeYAtWeb - shape.filletRadius;
    const fStartAngle = Math.PI;
    const fEndAngle = Math.PI / 2 + flangeSlopeRad;
    const fEndPt = arcPoint(fCX, fCY, shape.filletRadius, fEndAngle);

    curves.push(new Arc2D(new Point2D(fCX, fCY), shape.filletRadius, fStartAngle, fEndAngle, false));

    // Sloped flange surface (right part) from fillet end to toe/tip
    if (shape.toeRadius > 0) {
      const toeCX = halfWidth - shape.toeRadius;
      const toeCY = flangeYAtTip + shape.toeRadius;
      const toeStartAngle = -(Math.PI / 2 + flangeSlopeRad);
      const toeEndAngle = 0.0;
      const toeStartPt = arcPoint(toeCX, toeCY, shape.toeRadius, toeStartAngle);

      curves.push(new Line2D(fEndPt, toeStartPt));
      curves.push(new Arc2D(new Point2D(toeCX, toeCY), shape.toeRadius, toeStartAngle, toeEndAngle, true));
      curves.push(new Line2D(new Point2D(halfWidth, flangeYAtTip + shape.toeRadius), new Point2D(halfWidth, halfHeight)));
    } else {
      curves.push(new Line2D(fEndPt, new Point2D(halfWidth, flangeYAtTip)));
      curves.push(new Line2D(new Point2D(halfWidth, flangeYAtTip), new Point2D(halfWidth, halfHeight)));
    }
  } else {
    // No fillet
    if (shape.toeRadius > 0) {
      const toeCX = halfWidth - shape.toeRadius;
      const toeCY = flangeYAtTip + shape.toeRadius;
      const toeStartAngle = -(Math.PI / 2 + flangeSlopeRad);
      const toeEndAngle = 0.0;
      const toeStartPt = arcPoint(toeCX, toeCY, shape.toeRadius, toeStartAngle);

      curves.push(new Line2D(new Point2D(halfWebAtTop, flangeYAtWeb), toeStartPt));
      curves.push(new Arc2D(new Point2D(toeCX, toeCY), shape.toeRadius, toeStartAngle, toeEndAngle, true));
      curves.push(new Line2D(new Point2D(halfWidth, flangeYAtTip + shape.toeRadius), new Point2D(halfWidth, halfHeight)));
    } else {
      curves.push(new Line2D(new Point2D(halfWebAtTop, flangeYAtWeb), new Point2D(halfWidth, flangeYAtTip)));
      curves.push(new Line2D(new Point2D(halfWidth, flangeYAtTip), new Point2D(halfWidth, halfHeight)));
    }
  }

  // ===== TOP EDGE =====
  curves.push(new Line2D(new Point2D(halfWidth, halfHeight), new Point2D(-halfWidth, halfHeight)));

  // ===== LEFT TOE + SLOPED FLANGE SURFACE + LEFT FILLET =====
  if (shape.toeRadius > 0) {
    const toeCX = -halfWidth + shape.toeRadius;
    const toeCY = flangeYAtTip + shape.toeRadius;
    const toeStartAngle = Math.PI;
    const toeEndAngle = Math.PI + Math.PI / 2 + flangeSlopeRad;
    const toeEndPt = arcPoint(toeCX, toeCY, shape.toeRadius, toeEndAngle);

    curves.push(new Line2D(new Point2D(-halfWidth, halfHeight), new Point2D(-halfWidth, flangeYAtTip + shape.toeRadius)));
    curves.push(new Arc2D(new Point2D(toeCX, toeCY), shape.toeRadius, toeStartAngle, toeEndAngle, true));

    if (shape.filletRadius > 0) {
      const fCX = -halfWebAtTop - shape.filletRadius;
      const fCY = flangeYAtWeb - shape.filletRadius;
      const fStartAngle = Math.PI / 2 + flangeSlopeRad;
      const fEndAngle = 0.0;
      const fStartPt = arcPoint(fCX, fCY, shape.filletRadius, fStartAngle);

      curves.push(new Line2D(toeEndPt, fStartPt));
      curves.push(new Arc2D(new Point2D(fCX, fCY), shape.filletRadius, fStartAngle, fEndAngle, false));
    } else {
      curves.push(new Line2D(toeEndPt, new Point2D(-halfWebAtTop, flangeYAtWeb)));
    }
  } else {
    curves.push(new Line2D(new Point2D(-halfWidth, halfHeight), new Point2D(-halfWidth, flangeYAtTip)));

    if (shape.filletRadius > 0) {
      const fCX = -halfWebAtTop - shape.filletRadius;
      const fCY = flangeYAtWeb - shape.filletRadius;
      const fStartAngle = Math.PI / 2 + flangeSlopeRad;
      const fEndAngle = 0.0;
      const fStartPt = arcPoint(fCX, fCY, shape.filletRadius, fStartAngle);

      curves.push(new Line2D(new Point2D(-halfWidth, flangeYAtTip), fStartPt));
      curves.push(new Arc2D(new Point2D(fCX, fCY), shape.filletRadius, fStartAngle, fEndAngle, false));
    } else {
      curves.push(new Line2D(new Point2D(-halfWidth, flangeYAtTip), new Point2D(-halfWebAtTop, flangeYAtWeb)));
    }
  }

  // ===== LEFT WEB (down, possibly tapered) =====
  {
    const topY = shape.filletRadius > 0 ? flangeYAtWeb - shape.filletRadius : flangeYAtWeb;
    const bottomY = shape.bottomRadius > 0 ? shape.bottomRadius - halfHeight : -halfHeight;
    curves.push(new Line2D(new Point2D(-halfWebAtTop, topY), new Point2D(-halfWebAtBottom, bottomY)));
  }

  return curves;
}
