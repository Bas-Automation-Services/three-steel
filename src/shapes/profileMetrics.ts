// Headline dimensions of a profile shape as a plain interface, with the pure functions
// profileMetricsSize / profileMetricsFrom.
import type { ProfileShape } from './profileShape';

/**
 * Nominal outer dimensions and a representative thickness for any {@link ProfileShape}, in
 * millimetres. Gives one uniform shape over the (otherwise heterogeneous) shape hierarchy so the
 * catalog can offer size/thickness filtering and a detail panel without a per-shape switch at
 * every call site.
 *
 * `thickness` is the wall for hollow sections, the web for open sections (I/U/T/Z), the leg
 * thickness for angles, and the smaller side for solid bar/plate; it is `null` for solid
 * round/hex where a single thickness is not meaningful. `flangeThickness` is populated only for
 * flanged open sections.
 */
export interface ProfileMetrics {
  height: number;
  width: number;
  thickness: number | null;
  flangeThickness: number | null;
}

/** The dominant outer dimension — the usual "nominal size" people filter by. */
export function profileMetricsSize(metrics: ProfileMetrics): number {
  return Math.max(metrics.height, metrics.width);
}

/** Projects any catalog shape to uniform metrics. Exhaustive over the closed hierarchy. */
export function profileMetricsFrom(shape: ProfileShape): ProfileMetrics {
  switch (shape.kind) {
    case 'i':
      return { height: shape.height, width: shape.flangeWidth, thickness: shape.webThickness, flangeThickness: shape.flangeThickness };
    case 'u':
      return { height: shape.height, width: shape.flangeWidth, thickness: shape.webThickness, flangeThickness: shape.flangeThickness };
    case 't':
      return { height: shape.height, width: shape.flangeWidth, thickness: shape.webThickness, flangeThickness: shape.flangeThickness };
    case 'z':
      return { height: shape.height, width: shape.width, thickness: shape.webThickness, flangeThickness: shape.flangeThickness };
    case 'angle':
      return { height: shape.legHeight, width: shape.legWidth, thickness: shape.thickness, flangeThickness: null };
    case 'roundEdgedAngle':
      return { height: shape.legHeight, width: shape.legWidth, thickness: shape.thickness, flangeThickness: null };
    case 'rectHollow':
      return { height: shape.height, width: shape.width, thickness: shape.wallThickness, flangeThickness: null };
    case 'circHollow':
      return { height: shape.outerDiameter, width: shape.outerDiameter, thickness: shape.wallThickness, flangeThickness: null };
    case 'rect':
      return { height: shape.height, width: shape.width, thickness: Math.min(shape.height, shape.width), flangeThickness: null };
    case 'circle':
      return { height: shape.diameter, width: shape.diameter, thickness: null, flangeThickness: null };
    case 'hexagon':
      return { height: shape.widthAcrossFlats, width: shape.widthAcrossFlats, thickness: null, flangeThickness: null };
    default:
      // Unreachable while the union stays closed.
      return { height: 0, width: 0, thickness: null, flangeThickness: null };
  }
}
