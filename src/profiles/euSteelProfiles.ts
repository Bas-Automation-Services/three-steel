// European steel profile catalog (EN 10365 / EN 10056 / EN 10219). Dimensions in millimetres.
// Spot-verify against the published standard tables before 1.0.
import type { ProfileDefinition } from './profileDefinition';
import { UK_STEEL_PROFILES } from './ukSteelProfiles';

const STEEL = 'Steel';

/** At most one decimal digit, trailing zeros trimmed. */
function fmt(value: number): string {
  return String(Math.round(value * 10) / 10);
}

function iSection(family: string, nominal: number, h: number, b: number, tw: number, tf: number, r: number): ProfileDefinition {
  return {
    id: `${family}${nominal}`,
    displayName: `${family} ${nominal}`,
    category: family,
    defaultMaterial: STEEL,
    shape: {
      kind: 'i',
      height: h,
      flangeWidth: b,
      webThickness: tw,
      flangeThickness: tf,
      filletRadius: r,
      toeRadius: 0,
      flangeSlope: 0,
    },
  };
}

function upn(nominal: number, h: number, b: number, tw: number, tf: number, r1: number, r2: number): ProfileDefinition {
  return {
    id: `UPN${nominal}`,
    displayName: `UPN ${nominal}`,
    category: 'UPN',
    defaultMaterial: STEEL,
    shape: {
      kind: 'u',
      height: h,
      flangeWidth: b,
      webThickness: tw,
      flangeThickness: tf,
      innerFilletRadius: r1,
      outerFilletRadius: r2,
      flangeSlope: 8,
    },
  };
}

function upe(nominal: number, h: number, b: number, tw: number, tf: number, r: number): ProfileDefinition {
  return {
    id: `UPE${nominal}`,
    displayName: `UPE ${nominal}`,
    category: 'UPE',
    defaultMaterial: STEEL,
    shape: {
      kind: 'u',
      height: h,
      flangeWidth: b,
      webThickness: tw,
      flangeThickness: tf,
      innerFilletRadius: r,
      outerFilletRadius: 0,
      flangeSlope: 0,
    },
  };
}

function l(a: number, bLeg: number, t: number, r1: number, r2: number): ProfileDefinition {
  return {
    id: `L${fmt(a)}x${fmt(bLeg)}x${fmt(t)}`,
    displayName: `L ${fmt(a)}x${fmt(bLeg)}x${fmt(t)}`,
    category: 'Angle',
    defaultMaterial: STEEL,
    shape: {
      kind: 'angle',
      legWidth: a,
      legHeight: bLeg,
      thickness: t,
      outerFilletRadius: 0,
      innerFilletRadius: r1,
      toeRadius: r2,
    },
  };
}

function shs(a: number, t: number): ProfileDefinition {
  return {
    id: `SHS${fmt(a)}x${fmt(a)}x${fmt(t)}`,
    displayName: `SHS ${fmt(a)}x${fmt(a)}x${fmt(t)}`,
    category: 'SHS',
    defaultMaterial: STEEL,
    shape: {
      kind: 'rectHollow',
      height: a,
      width: a,
      wallThickness: t,
      outerCornerRadius: 2 * t,
    },
  };
}

function rhs(h: number, w: number, t: number): ProfileDefinition {
  return {
    id: `RHS${fmt(h)}x${fmt(w)}x${fmt(t)}`,
    displayName: `RHS ${fmt(h)}x${fmt(w)}x${fmt(t)}`,
    category: 'RHS',
    defaultMaterial: STEEL,
    shape: {
      kind: 'rectHollow',
      height: h,
      width: w,
      wallThickness: t,
      outerCornerRadius: 2 * t,
    },
  };
}

function chs(d: number, t: number): ProfileDefinition {
  return {
    id: `CHS${fmt(d)}x${fmt(t)}`,
    displayName: `CHS ${fmt(d)}x${fmt(t)}`,
    category: 'CHS',
    defaultMaterial: STEEL,
    shape: {
      kind: 'circHollow',
      outerDiameter: d,
      wallThickness: t,
    },
  };
}

function flat(w: number, t: number): ProfileDefinition {
  return {
    id: `FL${fmt(w)}x${fmt(t)}`,
    displayName: `Flat ${fmt(w)}x${fmt(t)}`,
    category: 'Flat',
    defaultMaterial: STEEL,
    shape: {
      kind: 'rect',
      width: w,
      height: t,
    },
  };
}

function round(d: number): ProfileDefinition {
  return {
    id: `RD${fmt(d)}`,
    displayName: `Round ${fmt(d)}`,
    category: 'Round',
    defaultMaterial: STEEL,
    shape: {
      kind: 'circle',
      diameter: d,
    },
  };
}

export const EU_STEEL_PROFILES: ProfileDefinition[] = [
  // IPE (EN 10365): h, b, tw, tf, r
  iSection('IPE', 80, 80, 46, 3.8, 5.2, 5),
  iSection('IPE', 100, 100, 55, 4.1, 5.7, 7),
  iSection('IPE', 120, 120, 64, 4.4, 6.3, 7),
  iSection('IPE', 140, 140, 73, 4.7, 6.9, 7),
  iSection('IPE', 160, 160, 82, 5.0, 7.4, 9),
  iSection('IPE', 180, 180, 91, 5.3, 8.0, 9),
  iSection('IPE', 200, 200, 100, 5.6, 8.5, 12),
  iSection('IPE', 220, 220, 110, 5.9, 9.2, 12),
  iSection('IPE', 240, 240, 120, 6.2, 9.8, 15),
  iSection('IPE', 270, 270, 135, 6.6, 10.2, 15),
  iSection('IPE', 300, 300, 150, 7.1, 10.7, 15),
  iSection('IPE', 330, 330, 160, 7.5, 11.5, 18),
  iSection('IPE', 360, 360, 170, 8.0, 12.7, 18),
  iSection('IPE', 400, 400, 180, 8.6, 13.5, 21),
  iSection('IPE', 450, 450, 190, 9.4, 14.6, 21),
  iSection('IPE', 500, 500, 200, 10.2, 16.0, 21),
  iSection('IPE', 550, 550, 210, 11.1, 17.2, 24),
  iSection('IPE', 600, 600, 220, 12.0, 19.0, 24),

  // HEA (EN 10365)
  iSection('HEA', 100, 96, 100, 5.0, 8.0, 12),
  iSection('HEA', 120, 114, 120, 5.0, 8.0, 12),
  iSection('HEA', 140, 133, 140, 5.5, 8.5, 12),
  iSection('HEA', 160, 152, 160, 6.0, 9.0, 15),
  iSection('HEA', 180, 171, 180, 6.0, 9.5, 15),
  iSection('HEA', 200, 190, 200, 6.5, 10.0, 18),
  iSection('HEA', 220, 210, 220, 7.0, 11.0, 18),
  iSection('HEA', 240, 230, 240, 7.5, 12.0, 21),
  iSection('HEA', 260, 250, 260, 7.5, 12.5, 24),
  iSection('HEA', 280, 270, 280, 8.0, 13.0, 24),
  iSection('HEA', 300, 290, 300, 8.5, 14.0, 27),
  iSection('HEA', 320, 310, 300, 9.0, 15.5, 27),
  iSection('HEA', 340, 330, 300, 9.5, 16.5, 27),
  iSection('HEA', 360, 350, 300, 10.0, 17.5, 27),
  iSection('HEA', 400, 390, 300, 11.0, 19.0, 27),
  iSection('HEA', 450, 440, 300, 11.5, 21.0, 27),
  iSection('HEA', 500, 490, 300, 12.0, 23.0, 27),

  // HEB (EN 10365)
  iSection('HEB', 100, 100, 100, 6.0, 10.0, 12),
  iSection('HEB', 120, 120, 120, 6.5, 11.0, 12),
  iSection('HEB', 140, 140, 140, 7.0, 12.0, 12),
  iSection('HEB', 160, 160, 160, 8.0, 13.0, 15),
  iSection('HEB', 180, 180, 180, 8.5, 14.0, 15),
  iSection('HEB', 200, 200, 200, 9.0, 15.0, 18),
  iSection('HEB', 220, 220, 220, 9.5, 16.0, 18),
  iSection('HEB', 240, 240, 240, 10.0, 17.0, 21),
  iSection('HEB', 260, 260, 260, 10.0, 17.5, 24),
  iSection('HEB', 280, 280, 280, 10.5, 18.0, 24),
  iSection('HEB', 300, 300, 300, 11.0, 19.0, 27),
  iSection('HEB', 320, 320, 300, 11.5, 20.5, 27),
  iSection('HEB', 340, 340, 300, 12.0, 21.5, 27),
  iSection('HEB', 360, 360, 300, 12.5, 22.5, 27),
  iSection('HEB', 400, 400, 300, 13.5, 24.0, 27),
  iSection('HEB', 450, 450, 300, 14.0, 26.0, 27),
  iSection('HEB', 500, 500, 300, 14.5, 28.0, 27),

  // HEM (EN 10365)
  iSection('HEM', 100, 120, 106, 12.0, 20.0, 12),
  iSection('HEM', 120, 140, 126, 12.5, 21.0, 12),
  iSection('HEM', 140, 160, 146, 13.0, 22.0, 12),
  iSection('HEM', 160, 180, 166, 14.0, 23.0, 15),
  iSection('HEM', 180, 200, 186, 14.5, 24.0, 15),
  iSection('HEM', 200, 220, 206, 15.0, 25.0, 18),
  iSection('HEM', 220, 240, 226, 15.5, 26.0, 18),
  iSection('HEM', 240, 270, 248, 18.0, 32.0, 21),
  iSection('HEM', 260, 290, 268, 18.0, 32.5, 24),
  iSection('HEM', 280, 310, 288, 18.5, 33.0, 24),
  iSection('HEM', 300, 340, 310, 21.0, 39.0, 27),

  // UPN (DIN 1026-1 / EN 10365): h, b, tw, tf, r1 (inner), r2 (outer), 8% flange slope
  upn(80, 80, 45, 6.0, 8.0, 8.0, 4.0),
  upn(100, 100, 50, 6.0, 8.5, 8.5, 4.5),
  upn(120, 120, 55, 7.0, 9.0, 9.0, 4.5),
  upn(140, 140, 60, 7.0, 10.0, 10.0, 5.0),
  upn(160, 160, 65, 7.5, 10.5, 10.5, 5.5),
  upn(180, 180, 70, 8.0, 11.0, 11.0, 5.5),
  upn(200, 200, 75, 8.5, 11.5, 11.5, 6.0),
  upn(220, 220, 80, 9.0, 12.5, 12.5, 6.5),
  upn(240, 240, 85, 9.5, 13.0, 13.0, 6.5),
  upn(260, 260, 90, 10.0, 14.0, 14.0, 7.0),
  upn(280, 280, 95, 10.0, 15.0, 15.0, 7.5),
  upn(300, 300, 100, 10.0, 16.0, 16.0, 8.0),

  // UPE (EN 10365, parallel flanges): h, b, tw, tf, r
  upe(80, 80, 50, 4.0, 7.0, 10),
  upe(100, 100, 55, 4.5, 7.5, 10),
  upe(120, 120, 60, 5.0, 8.0, 12),
  upe(140, 140, 65, 5.0, 9.0, 12),
  upe(160, 160, 70, 5.5, 9.5, 12),
  upe(180, 180, 75, 5.5, 10.5, 12),
  upe(200, 200, 80, 6.0, 11.0, 13),
  upe(220, 220, 85, 6.5, 12.0, 13),
  upe(240, 240, 90, 7.0, 12.5, 15),
  upe(270, 270, 95, 7.5, 13.5, 15),
  upe(300, 300, 100, 9.5, 15.0, 15),

  // Equal angles (EN 10056-1): a, a, t, r1 (root), r2 (toe)
  l(30, 30, 3, 5, 2.5),
  l(40, 40, 4, 6, 3),
  l(50, 50, 5, 7, 3.5),
  l(60, 60, 6, 8, 4),
  l(70, 70, 7, 9, 4.5),
  l(80, 80, 8, 10, 5),
  l(90, 90, 9, 11, 5.5),
  l(100, 100, 10, 12, 6),
  l(120, 120, 12, 13, 6.5),
  l(150, 150, 15, 16, 8),

  // Unequal angles (EN 10056-1)
  l(80, 40, 6, 7, 3.5),
  l(100, 50, 8, 9, 4.5),
  l(100, 65, 7, 10, 5),
  l(120, 80, 10, 11, 5.5),
  l(150, 100, 10, 12, 6),

  // SHS (EN 10219, cold formed; outer corner radius 2t)
  shs(20, 2),
  shs(25, 2.5),
  shs(30, 3),
  shs(40, 3),
  shs(40, 4),
  shs(50, 3),
  shs(50, 4),
  shs(60, 4),
  shs(70, 4),
  shs(80, 4),
  shs(80, 5),
  shs(90, 5),
  shs(100, 4),
  shs(100, 5),
  shs(100, 6),
  shs(120, 5),
  shs(120, 6),
  shs(140, 6),
  shs(150, 6),
  shs(150, 8),
  shs(180, 8),
  shs(200, 8),
  shs(250, 10),

  // RHS (EN 10219, cold formed; outer corner radius 2t): h, w, t
  rhs(40, 20, 2.5),
  rhs(50, 30, 3),
  rhs(60, 40, 3),
  rhs(60, 40, 4),
  rhs(80, 40, 3),
  rhs(80, 40, 4),
  rhs(100, 50, 4),
  rhs(100, 60, 4),
  rhs(120, 60, 4),
  rhs(120, 80, 5),
  rhs(140, 80, 5),
  rhs(150, 100, 5),
  rhs(160, 80, 5),
  rhs(180, 100, 6),
  rhs(200, 100, 6),
  rhs(200, 120, 6),
  rhs(250, 150, 8),

  // CHS (EN 10219/10220): outer diameter, wall
  chs(21.3, 2.3),
  chs(26.9, 2.3),
  chs(33.7, 2.6),
  chs(42.4, 2.6),
  chs(48.3, 2.9),
  chs(60.3, 2.9),
  chs(76.1, 2.9),
  chs(88.9, 3.2),
  chs(101.6, 3.6),
  chs(114.3, 3.6),
  chs(139.7, 4),
  chs(168.3, 4.5),
  chs(193.7, 5.4),
  chs(219.1, 5.9),
  chs(273, 6.3),

  // Flat bar: width x thickness
  flat(20, 5),
  flat(30, 5),
  flat(40, 5),
  flat(40, 8),
  flat(50, 5),
  flat(50, 8),
  flat(60, 8),
  flat(60, 10),
  flat(80, 8),
  flat(80, 10),
  flat(100, 10),
  flat(100, 12),
  flat(120, 10),
  flat(150, 12),

  // Round bar: diameter
  round(10),
  round(12),
  round(16),
  round(20),
  round(25),
  round(30),
  round(40),
  round(50),
];

/** Every built-in catalog the shared lookup and the pickers search, EU first (the default set). */
export const ALL_STEEL_PROFILES: ProfileDefinition[] = [...EU_STEEL_PROFILES, ...UK_STEEL_PROFILES];

export function getProfile(id: string): ProfileDefinition | undefined {
  const needle = id.toLowerCase();
  return ALL_STEEL_PROFILES.find((p) => p.id.toLowerCase() === needle);
}
