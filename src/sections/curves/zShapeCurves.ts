import { Arc2D, type Curve2D, Line2D, Point2D } from '../../geometry';
import type { ZShape } from '../../shapes/profileShape';

// NOTE: ZSection exposed InnerFilletRadius + OuterFilletRadius. The ZShape
// record collapses these into filletRadius (inner) + nullable edgeRadius
// (outer). Null edgeRadius => no outer radius (treated as 0).
export function buildZShapeOuter(shape: ZShape): Curve2D[] {
  const curves: Curve2D[] = [];

  const hw = shape.webThickness / 2;
  const hh = shape.height / 2;
  const t = shape.flangeThickness;
  const r1 = shape.filletRadius;
  const r2 = shape.edgeRadius ?? 0.0;

  // Web: X = -hw (left) to X = +hw (right)
  // Bottom flange extends RIGHT: X = -hw to X = FlangeWidth - hw
  // Top flange extends LEFT: X = hw to X = -(FlangeWidth - hw)
  const bfR = shape.width - hw; // bottom flange right X
  const tfL = -(shape.width - hw); // top flange left X

  // Traversal order:
  // Left web down → bottom edge right → bottom flange right up → R2 → inner edge left → R1 →
  // right web up → top edge left → top flange left down → R2 → inner edge right → R1 → back

  // 1. Web left edge going down. R1 fillet at TOP (web-top_flange junction).
  const wlTop = r1 > 0 ? hh - t - r1 : hh - t;
  curves.push(new Line2D(new Point2D(-hw, wlTop), new Point2D(-hw, -hh)));

  // 2. Bottom edge (left to right)
  curves.push(new Line2D(new Point2D(-hw, -hh), new Point2D(bfR, -hh)));

  // 3. Bottom flange right edge going up to R2
  const brBot = r2 > 0 ? -(hh - t + r2) : -(hh - t);
  curves.push(new Line2D(new Point2D(bfR, -hh), new Point2D(bfR, brBot)));

  // 4. R2 outer fillet at bottom flange right tip
  if (r2 > 0) {
    curves.push(new Arc2D(new Point2D(bfR - r2, brBot), r2, 0, Math.PI / 2, true));
  }

  // 5. Bottom flange inner edge going left to R1
  const biR = r2 > 0 ? bfR - r2 : bfR;
  const biL = r1 > 0 ? hw + r1 : hw;
  curves.push(new Line2D(new Point2D(biR, -(hh - t)), new Point2D(biL, -(hh - t))));

  // 6. R1 inner fillet at bottom-right web-flange junction
  if (r1 > 0) {
    curves.push(new Arc2D(new Point2D(hw + r1, -(hh - t - r1)), r1,
      (3 * Math.PI) / 2, Math.PI, false));
  }

  // 7. Web right edge going up. R1 fillet at BOTTOM (web-bottom_flange junction).
  const wrBot = r1 > 0 ? -(hh - t - r1) : -(hh - t);
  curves.push(new Line2D(new Point2D(hw, wrBot), new Point2D(hw, hh)));

  // 8. Top edge (right to left)
  curves.push(new Line2D(new Point2D(hw, hh), new Point2D(tfL, hh)));

  // 9. Top flange left edge going down to R2
  const tlTop = r2 > 0 ? hh - t + r2 : hh - t;
  curves.push(new Line2D(new Point2D(tfL, hh), new Point2D(tfL, tlTop)));

  // 10. R2 outer fillet at top flange left tip
  if (r2 > 0) {
    curves.push(new Arc2D(new Point2D(tfL + r2, tlTop), r2, Math.PI, (3 * Math.PI) / 2, true));
  }

  // 11. Top flange inner edge going right to R1
  const tiL = r2 > 0 ? tfL + r2 : tfL;
  const tiR = r1 > 0 ? -hw - r1 : -hw;
  curves.push(new Line2D(new Point2D(tiL, hh - t), new Point2D(tiR, hh - t)));

  // 12. R1 inner fillet at top-left web-flange junction
  if (r1 > 0) {
    curves.push(new Arc2D(new Point2D(-hw - r1, hh - t - r1), r1,
      Math.PI / 2, 0, false));
  }

  return curves;
}
