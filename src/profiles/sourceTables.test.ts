import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { OUTPUT_FILE, renderSourceTables } from '../../scripts/build-catalog';
import { getProfile } from './euSteelProfiles';
import { IPE_ROWS, IPN_ROWS, HEA_ROWS, HEB_ROWS, HEM_ROWS, PFC_ROWS, UB_ROWS, UC_ROWS, UPE_ROWS, UPN_ROWS } from './sourceTables';

describe('source tables', () => {
  it('are generated from data/sources (run `pnpm catalog`)', () => {
    expect(readFileSync(OUTPUT_FILE, 'utf8').replace(/\r\n/g, '\n')).toBe(renderSourceTables());
  });

  it('put every sourced row in the catalog with its dimensions', () => {
    const series = { IPE: IPE_ROWS, IPN: IPN_ROWS, HEA: HEA_ROWS, HEB: HEB_ROWS, HEM: HEM_ROWS, UPN: UPN_ROWS, UPE: UPE_ROWS, UB: UB_ROWS, UC: UC_ROWS, PFC: PFC_ROWS };
    for (const [family, rows] of Object.entries(series)) {
      for (const row of rows) {
        const shape = getProfile(`${family}${row.size}`)?.shape;
        expect(shape, `${family}${row.size}`).toBeDefined();
        if (shape!.kind !== 'i' && shape!.kind !== 'u') throw new Error(`${family}${row.size} is a ${shape!.kind}`);
        expect([shape!.height, shape!.flangeWidth, shape!.webThickness, shape!.flangeThickness], `${family}${row.size}`).toEqual([row.h, row.b, row.tw, row.tf]);
      }
    }
  });
});

describe('sourced profiles', () => {
  it('IPN has tapered flanges with root and toe radii', () => {
    expect(getProfile('IPN200')?.shape).toEqual({
      kind: 'i', height: 200, flangeWidth: 90, webThickness: 7.5, flangeThickness: 11.3, filletRadius: 7.5, toeRadius: 4.5, flangeSlope: 14,
    });
  });

  it('UPN above 300 measures tf at (b - tw) / 2 from the tip, on a 5% slope', () => {
    const shape = getProfile('UPN320')?.shape;
    expect(shape).toMatchObject({ kind: 'u', flangeThickness: 17.5, flangeSlope: 5, flangeThicknessAt: 43 });
    expect(getProfile('UPN300')?.shape).not.toHaveProperty('flangeThicknessAt');
  });

  it('UC 356x406x235 is 394.8 wide', () => {
    expect(getProfile('UC356x406x235')?.shape).toMatchObject({ flangeWidth: 394.8 });
  });

  it('covers the full EN 10365 ranges', () => {
    for (const id of ['HEA1000', 'HEB1000', 'HEM1000', 'UPE400', 'UPN50', 'UPN400', 'IPN80', 'IPN600']) {
      expect(getProfile(id), id).toBeDefined();
    }
  });
});
