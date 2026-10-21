// Outline → polygon tessellation for the mesh kernel. Lines contribute endpoints; arcs are
// sampled by sag tolerance. Display-quality only — exact geometry always re-derives from the
// document (meshes are visual, JSON is truth).
import type { Curve2D } from './geometry';

export type PolygonPoint = [number, number];

const DEFAULT_SAG_MM = 0.15;
const JOIN_TOLERANCE = 1e-6;

/** Segment count so the chord sag stays under `sag` for the given radius/sweep. */
function arcSegments(radius: number, sweep: number, sag: number): number {
  if (radius <= sag) return 4;
  const maxStep = 2 * Math.acos(Math.max(-1, Math.min(1, 1 - sag / radius)));
  return Math.max(1, Math.ceil(Math.abs(sweep) / maxStep));
}

/** Start and end point of an open curve. */
function ends(curve: Curve2D): [PolygonPoint, PolygonPoint] | null {
  if (curve.kind === 'line') return [[curve.startPoint.x, curve.startPoint.y], [curve.endPoint.x, curve.endPoint.y]];
  if (curve.kind === 'arc') {
    const s = curve.pointAt(0);
    const e = curve.pointAt(1);
    return [[s.x, s.y], [e.x, e.y]];
  }
  return null;
}

const dist = (a: PolygonPoint, b: PolygonPoint) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/**
 * Walks an ordered closed outline and emits a polygon (no closing duplicate point).
 * Curves come in outline order, but each may be stored either way round (fillet arcs often run
 * against the outline), so every curve is walked in the direction that continues the chain.
 */
export function tessellateOutline(curves: readonly Curve2D[], sag = DEFAULT_SAG_MM): PolygonPoint[] {
  const points: PolygonPoint[] = [];

  const push = (x: number, y: number) => {
    const last = points[points.length - 1];
    if (last && Math.abs(last[0] - x) < JOIN_TOLERANCE && Math.abs(last[1] - y) < JOIN_TOLERANCE) return;
    points.push([x, y]);
  };

  /** Whether curve i runs backwards: its end, not its start, touches the chain so far. */
  const reversed = (i: number): boolean => {
    const e = ends(curves[i]);
    if (!e) return false;
    const last = points[points.length - 1];
    if (last) return dist(last, e[1]) < dist(last, e[0]);
    // First curve: orient it so its end meets the next curve.
    const next = curves.length > 1 ? ends(curves[1]) : null;
    if (!next) return false;
    return Math.min(dist(e[0], next[0]), dist(e[0], next[1])) < Math.min(dist(e[1], next[0]), dist(e[1], next[1]));
  };

  for (let c = 0; c < curves.length; c++) {
    const curve = curves[c];
    switch (curve.kind) {
      case 'line': {
        const [s, e] = ends(curve)!;
        const [a, b] = reversed(c) ? [e, s] : [s, e];
        push(a[0], a[1]);
        push(b[0], b[1]);
        break;
      }
      case 'arc': {
        const n = arcSegments(curve.radius, curve.sweepAngle, sag);
        const back = reversed(c);
        for (let i = 0; i <= n; i++) {
          const p = curve.pointAt((back ? n - i : i) / n);
          push(p.x, p.y);
        }
        break;
      }
      case 'circle': {
        const n = Math.max(8, arcSegments(curve.radius, 2 * Math.PI, sag));
        for (let i = 0; i < n; i++) {
          const p = curve.pointAt(i / n);
          push(p.x, p.y);
        }
        break;
      }
    }
  }

  // Drop the closing duplicate if the loop returned to the start.
  const first = points[0];
  const last = points[points.length - 1];
  if (
    points.length > 1 &&
    Math.abs(first[0] - last[0]) < JOIN_TOLERANCE &&
    Math.abs(first[1] - last[1]) < JOIN_TOLERANCE
  ) {
    points.pop();
  }

  return points;
}

/** Signed polygon area (positive = CCW). Used for winding checks and BOM sanity tests. */
export function polygonArea(points: PolygonPoint[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}
