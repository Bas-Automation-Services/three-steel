import { Arc2D, type Curve2D, Line2D, Point2D } from '../../geometry';
import type { RoundEdgedAngle } from '../../shapes/profileShape';

export function buildRoundEdgedAngleOuter(shape: RoundEdgedAngle): Curve2D[] {
  const t = shape.thickness;
  // Tip semicircle: diameter == Thickness by definition of a round-edged
  // angle (the surrounding flat edges sit at y=0 and y=Thickness), so the
  // radius is fully determined.
  const toe = t / 2;
  // Outer corner quarter-circle radius: explicit RootRadius if provided, else
  // the legacy default of one full thickness.
  const root = shape.rootRadius > 0 ? shape.rootRadius : t;

  // Shift coordinates so the bounding box is centered at the origin.
  const cx = shape.legWidth / 2;
  const cy = shape.legHeight / 2;
  const p = (x: number, y: number): Point2D => new Point2D(x - cx, y - cy);

  const curves: Curve2D[] = [];

  // Counterclockwise from bottom of outer corner arc

  // 1. Bottom edge: outer corner arc end → horizontal tip semicircle start
  curves.push(new Line2D(p(root, 0), p(shape.legWidth - toe, 0)));

  // 2. Horizontal tip semicircle (bottom → top)
  curves.push(new Arc2D(
    p(shape.legWidth - toe, toe), toe,
    -Math.PI / 2, Math.PI / 2, true));

  // 3. Inner horizontal edge: horizontal tip → inner corner
  curves.push(new Line2D(p(shape.legWidth - toe, t), p(t, t)));

  // 4. Inner vertical edge: inner corner → vertical tip
  curves.push(new Line2D(p(t, t), p(t, shape.legHeight - toe)));

  // 5. Vertical tip semicircle (right → left)
  curves.push(new Arc2D(
    p(toe, shape.legHeight - toe), toe,
    0, Math.PI, true));

  // 6. Outer vertical edge: vertical tip → outer corner arc start
  curves.push(new Line2D(p(0, shape.legHeight - toe), p(0, root)));

  // 7. Outer corner quarter-circle (left → bottom)
  curves.push(new Arc2D(
    p(root, root), root,
    Math.PI, (3 * Math.PI) / 2, true));

  return curves;
}
