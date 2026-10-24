// Profile shapes: a discriminated union of plain JSON-serializable objects (they live in the
// catalog and in documents, so no classes here). New shapes are added together with their
// curve generators.

/** I / H / IPE / HEA / HEB / HEM (symmetric double-T). */
export interface IShape {
  kind: 'i';
  height: number;
  flangeWidth: number;
  webThickness: number;
  flangeThickness: number;
  filletRadius: number;
  toeRadius: number;
  /** Flange slope in percent (e.g. 8 for UPN-style 8%); 0 for parallel flanges. */
  flangeSlope: number;
}

/** Channel / U-section. */
export interface UShape {
  kind: 'u';
  height: number;
  flangeWidth: number;
  webThickness: number;
  flangeThickness: number;
  innerFilletRadius: number;
  outerFilletRadius: number;
  flangeSlope: number;
  /**
   * Where flangeThickness is measured on a sloped flange: the distance from the flange tip.
   * Omitted means b/2 (UPN up to 300); UPN above 300 measure at (b - tw) / 2.
   */
  flangeThicknessAt?: number;
}

/**
 * Angle (L) section, sharp or round-cornered via the fillet/toe radii.
 * Equal-leg when legHeight == legWidth.
 */
export interface Angle {
  kind: 'angle';
  legWidth: number;
  legHeight: number;
  thickness: number;
  outerFilletRadius: number;
  innerFilletRadius: number;
  toeRadius: number;
}

/**
 * Rectangular (and square) hollow section. Square is the height == width
 * invariant.
 */
export interface RectangularHollow {
  kind: 'rectHollow';
  height: number;
  width: number;
  wallThickness: number;
  outerCornerRadius: number;
}

/** Round hollow / tube. */
export interface CircularHollow {
  kind: 'circHollow';
  outerDiameter: number;
  wallThickness: number;
}

/**
 * Solid rectangle. Subsumes flat bar (thin rectangle) and square bar
 * (width == height).
 */
export interface Rectangle {
  kind: 'rect';
  width: number;
  height: number;
}

/** Solid round bar. */
export interface Circle {
  kind: 'circle';
  diameter: number;
}

/**
 * T-section. Carries separate web and flange thicknesses plus independent
 * web- and flange-slope values. Sharp variants (DIN 59051) zero out
 * bottomRadius/toeRadius; the rounded DIN EN 10055 variant populates them.
 */
export interface TShape {
  kind: 't';
  height: number;
  flangeWidth: number;
  webThickness: number;
  flangeThickness: number;
  filletRadius: number;
  toeRadius: number;
  bottomRadius: number;
  flangeSlope: number;
  webSlope: number;
}

/** Z-section. edgeRadius is null when the section has no edge rounding. */
export interface ZShape {
  kind: 'z';
  height: number;
  width: number;
  webThickness: number;
  flangeThickness: number;
  filletRadius: number;
  edgeRadius: number | null;
}

/**
 * L-section with rounded outer corner and fully-rounded leg tips. The tip shape
 * is by definition a semicircle of diameter = thickness; rootRadius drives the
 * outer-corner quarter-circle (0 falls back to a thickness-derived default).
 */
export interface RoundEdgedAngle {
  kind: 'roundEdgedAngle';
  legWidth: number;
  legHeight: number;
  thickness: number;
  rootRadius: number;
}

/**
 * Solid hex bar. widthAcrossFlats is the Schluesselweite; circumscribed
 * diameter is derived at curve-generation time.
 */
export interface Hexagon {
  kind: 'hexagon';
  widthAcrossFlats: number;
}

export type ProfileShape =
  | IShape
  | UShape
  | Angle
  | RectangularHollow
  | CircularHollow
  | Rectangle
  | Circle
  | TShape
  | ZShape
  | RoundEdgedAngle
  | Hexagon;
