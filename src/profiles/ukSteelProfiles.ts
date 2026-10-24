// UK steel profile catalog: UB universal beams and UC universal columns (parallel flanges) and PFC
// parallel-flange channels, BS 4-1. Dimensions in millimetres, from the Koyda Ltd tables in
// ./sourceTables (CC BY 4.0, credited in NOTICE.md).
import type { ProfileDefinition } from './profileDefinition';
import { PFC_ROWS, type ParallelFlangeRow, UB_ROWS, UC_ROWS } from './sourceTables';

const STEEL = 'Steel';

function iSection(family: 'UB' | 'UC', row: ParallelFlangeRow): ProfileDefinition {
  return {
    id: `${family}${row.size}`,
    displayName: `${family} ${row.size}`,
    category: family,
    defaultMaterial: STEEL,
    shape: { kind: 'i', height: row.h, flangeWidth: row.b, webThickness: row.tw, flangeThickness: row.tf, filletRadius: row.r, toeRadius: 0, flangeSlope: 0 },
  };
}

function pfc(row: ParallelFlangeRow): ProfileDefinition {
  return {
    id: `PFC${row.size}`,
    displayName: `PFC ${row.size}`,
    category: 'PFC',
    defaultMaterial: STEEL,
    shape: { kind: 'u', height: row.h, flangeWidth: row.b, webThickness: row.tw, flangeThickness: row.tf, innerFilletRadius: row.r, outerFilletRadius: 0, flangeSlope: 0 },
  };
}

export const UK_STEEL_PROFILES: ProfileDefinition[] = [
  ...UB_ROWS.map((row) => iSection('UB', row)),
  ...UC_ROWS.map((row) => iSection('UC', row)),
  ...PFC_ROWS.map(pfc),
];
