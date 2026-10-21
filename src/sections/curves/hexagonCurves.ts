import { type Curve2D, Line2D, Point2D } from '../../geometry';
import type { Hexagon } from '../../shapes/profileShape';

export function buildHexagonOuter(shape: Hexagon): Curve2D[] {
  const curves: Curve2D[] = [];

  // Regular hexagon with flat sides at top and bottom
  // The flat-to-flat width is the distance between parallel sides
  const cornerToCornerWidth = shape.widthAcrossFlats / Math.cos(Math.PI / 6);
  const radius = cornerToCornerWidth / 2; // Circumradius (corner radius)

  // Generate 6 vertices, starting from right, going counterclockwise
  // Vertices at 0°, 60°, 120°, 180°, 240°, 300° (pointy sides, flat top/bottom)
  const vertices: Point2D[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (i * 60 * Math.PI) / 180; // Start at 0°, increment by 60°
    vertices.push(new Point2D(
      radius * Math.cos(angle),
      radius * Math.sin(angle)));
  }

  // Create edges connecting vertices (counterclockwise)
  for (let i = 0; i < 6; i++) {
    const next = (i + 1) % 6;
    curves.push(new Line2D(vertices[i], vertices[next]));
  }

  return curves;
}
