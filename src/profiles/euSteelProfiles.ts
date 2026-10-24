// European steel profile catalog. Dimensions in millimetres. IPE, IPN, HE and UPN/UPE come from
// the sourced tables in ./sourceTables (credited in NOTICE.md); angles, hollow sections and bars
// are authored from EN 10056 / EN 10219 / EN 10220 (spot-verify against the standard before 1.0).
import type { ProfileDefinition } from './profileDefinition';
import { HEA_ROWS, HEB_ROWS, HEM_ROWS, IPE_ROWS, IPN_ROWS, type ParallelFlangeRow, type TaperFlangeRow, UPE_ROWS, UPN_ROWS } from './sourceTables';
import { UK_STEEL_PROFILES } from './ukSteelProfiles';

const STEEL = 'Steel';

/** At most one decimal digit, trailing zeros trimmed. */
function fmt(value: number): string {
  return String(Math.round(value * 10) / 10);
}

function iSection(family: string, row: ParallelFlangeRow): ProfileDefinition {
  return {
    id: `${family}${row.size}`,
    displayName: `${family} ${row.size}`,
    category: family,
    defaultMaterial: STEEL,
    shape: {
      kind: 'i',
      height: row.h,
      flangeWidth: row.b,
      webThickness: row.tw,
      flangeThickness: row.tf,
      filletRadius: row.r,
      toeRadius: 0,
      flangeSlope: 0,
    },
  };
}

/** The I shape measures tf at b/4 from the flange tip, where EN 10365 measures IPN. */
function ipn(row: TaperFlangeRow): ProfileDefinition {
  if (row.xTf !== row.b / 4) throw new Error(`IPN ${row.size}: tf is measured ${row.xTf} from the tip, not at b/4`);
  return {
    id: `IPN${row.size}`,
    displayName: `IPN ${row.size}`,
    category: 'IPN',
    defaultMaterial: STEEL,
    shape: {
      kind: 'i',
      height: row.h,
      flangeWidth: row.b,
      webThickness: row.tw,
      flangeThickness: row.tf,
      filletRadius: row.r1,
      toeRadius: row.r2,
      flangeSlope: row.slopePct,
    },
  };
}

function upn(row: TaperFlangeRow): ProfileDefinition {
  return {
    id: `UPN${row.size}`,
    displayName: `UPN ${row.size}`,
    category: 'UPN',
    defaultMaterial: STEEL,
    shape: {
      kind: 'u',
      height: row.h,
      flangeWidth: row.b,
      webThickness: row.tw,
      flangeThickness: row.tf,
      innerFilletRadius: row.r1,
      outerFilletRadius: row.r2,
      flangeSlope: row.slopePct,
      ...(row.xTf === row.b / 2 ? {} : { flangeThicknessAt: row.xTf }),
    },
  };
}

function upe(row: ParallelFlangeRow): ProfileDefinition {
  return {
    id: `UPE${row.size}`,
    displayName: `UPE ${row.size}`,
    category: 'UPE',
    defaultMaterial: STEEL,
    shape: {
      kind: 'u',
      height: row.h,
      flangeWidth: row.b,
      webThickness: row.tw,
      flangeThickness: row.tf,
      innerFilletRadius: row.r,
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
  ...IPE_ROWS.map((row) => iSection('IPE', row)),
  ...IPN_ROWS.map(ipn),
  ...HEA_ROWS.map((row) => iSection('HEA', row)),
  ...HEB_ROWS.map((row) => iSection('HEB', row)),
  ...HEM_ROWS.map((row) => iSection('HEM', row)),
  ...UPN_ROWS.map(upn),
  ...UPE_ROWS.map(upe),

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
