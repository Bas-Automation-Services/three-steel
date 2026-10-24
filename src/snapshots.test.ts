// Regression snapshots: every catalog section outline and catalog entry is pinned to the JSON in
// ../fixtures (1e-9 mm). A deliberate geometry change updates the fixture in the same commit:
// `UPDATE_SNAPSHOTS=1 pnpm test` rewrites the fixtures from the current code.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Curve2D } from './geometry';
import { buildCrossSection } from './sections/crossSectionBuilder';
import { EU_STEEL_PROFILES, getProfile } from './profiles/euSteelProfiles';
import { UK_STEEL_PROFILES } from './profiles/ukSteelProfiles';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');
const sectionsDir = join(fixturesDir, 'sections');

interface LineFixture { type: 'line'; x1: number; y1: number; x2: number; y2: number }
interface ArcFixture { type: 'arc'; cx: number; cy: number; radius: number; startAngle: number; endAngle: number; ccw: boolean }
interface CircleFixture { type: 'circle'; cx: number; cy: number; radius: number }
type CurveFixture = LineFixture | ArcFixture | CircleFixture;

interface SectionFixture {
  id: string;
  outer: CurveFixture[];
  inner: CurveFixture[][];
  boundingBox: { minX: number; minY: number; maxX: number; maxY: number };
}

interface CatalogEntry {
  id: string;
  displayName: string;
  category: string;
  defaultMaterial: string;
  shape: { kind: string } & Record<string, number | string | null>;
}

const TOL = 1e-9;

function expectCurveMatches(actual: Curve2D, expected: CurveFixture, context: string): void {
  if (expected.type === 'line') {
    expect(actual.kind, context).toBe('line');
    if (actual.kind !== 'line') return;
    expect(actual.startPoint.x, context).toBeCloseTo(expected.x1, 9);
    expect(actual.startPoint.y, context).toBeCloseTo(expected.y1, 9);
    expect(actual.endPoint.x, context).toBeCloseTo(expected.x2, 9);
    expect(actual.endPoint.y, context).toBeCloseTo(expected.y2, 9);
  } else if (expected.type === 'arc') {
    expect(actual.kind, context).toBe('arc');
    if (actual.kind !== 'arc') return;
    expect(actual.center.x, context).toBeCloseTo(expected.cx, 9);
    expect(actual.center.y, context).toBeCloseTo(expected.cy, 9);
    expect(actual.radius, context).toBeCloseTo(expected.radius, 9);
    expect(actual.startAngle, context).toBeCloseTo(expected.startAngle, 9);
    expect(actual.endAngle, context).toBeCloseTo(expected.endAngle, 9);
    expect(actual.isCounterClockwise, context).toBe(expected.ccw);
  } else {
    expect(actual.kind, context).toBe('circle');
    if (actual.kind !== 'circle') return;
    expect(actual.center.x, context).toBeCloseTo(expected.cx, 9);
    expect(actual.center.y, context).toBeCloseTo(expected.cy, 9);
    expect(actual.radius, context).toBeCloseTo(expected.radius, 9);
  }
}

function expectCatalogMatches(profile: (typeof EU_STEEL_PROFILES)[number], entry: CatalogEntry | undefined): void {
  expect(entry, `snapshot is missing ${profile.id}`).toBeDefined();
  expect(entry!.id, `${profile.id}: id`).toBe(profile.id);
  expect(entry!.displayName, `${profile.id}: displayName`).toBe(profile.displayName);
  expect(entry!.category, `${profile.id}: category`).toBe(profile.category);
  expect(entry!.defaultMaterial, `${profile.id}: defaultMaterial`).toBe(profile.defaultMaterial);

  const shape = profile.shape as unknown as Record<string, unknown>;
  const snapShape = entry!.shape as Record<string, unknown>;
  expect(Object.keys(snapShape).sort(), `${profile.id}: shape fields`).toEqual(Object.keys(shape).sort());
  for (const key of Object.keys(shape)) {
    expect(snapShape[key], `${profile.id}: shape.${key}`).toBe(shape[key]);
  }
}

function curveFixture(c: Curve2D): CurveFixture {
  if (c.kind === 'line') return { type: 'line', x1: c.startPoint.x, y1: c.startPoint.y, x2: c.endPoint.x, y2: c.endPoint.y };
  if (c.kind === 'arc') {
    return { type: 'arc', cx: c.center.x, cy: c.center.y, radius: c.radius, startAngle: c.startAngle, endAngle: c.endAngle, ccw: c.isCounterClockwise };
  }
  return { type: 'circle', cx: c.center.x, cy: c.center.y, radius: c.radius };
}

function writeSnapshots(): void {
  for (const profile of EU_STEEL_PROFILES) {
    const section = buildCrossSection(profile.shape);
    const box = section.boundingBox;
    const fixture: SectionFixture = {
      id: profile.id,
      outer: section.outerCurves.map(curveFixture),
      inner: section.innerContours.map((contour) => contour.map(curveFixture)),
      boundingBox: { minX: box.min.x, minY: box.min.y, maxX: box.max.x, maxY: box.max.y },
    };
    writeFileSync(join(sectionsDir, `${profile.id}.json`), JSON.stringify(fixture, null, 2));
  }
  writeFileSync(join(fixturesDir, 'eu-steel.json'), JSON.stringify(EU_STEEL_PROFILES, null, 2));
  writeFileSync(join(fixturesDir, 'uk-steel.json'), JSON.stringify(UK_STEEL_PROFILES, null, 2));
}

if (process.env.UPDATE_SNAPSHOTS === '1') writeSnapshots();

const readCatalog = (name: string) =>
  JSON.parse(readFileSync(join(fixturesDir, name), 'utf8')) as CatalogEntry[];

describe('section outline snapshots', () => {
  const files = readdirSync(sectionsDir).filter((f) => f.endsWith('.json'));

  it('has a snapshot for every EU catalog profile', () => {
    const ids = new Set(files.map((f) => f.replace(/\.json$/, '')));
    for (const profile of EU_STEEL_PROFILES) {
      expect(ids.has(profile.id), `missing snapshot for ${profile.id}`).toBe(true);
    }
  });

  for (const file of files) {
    it(`reproduces ${file}`, () => {
      const fixture = JSON.parse(readFileSync(join(sectionsDir, file), 'utf8')) as SectionFixture;
      const profile = getProfile(fixture.id);
      expect(profile, `catalog is missing ${fixture.id}`).toBeDefined();

      const section = buildCrossSection(profile!.shape);
      const curves = section.outerCurves;
      expect(curves.length).toBe(fixture.outer.length);
      for (let i = 0; i < curves.length; i++) {
        expectCurveMatches(curves[i], fixture.outer[i], `outer[${i}]`);
      }

      const innerFixture = fixture.inner ?? [];
      const innerContours = section.innerContours;
      expect(innerContours.length, 'inner contour count').toBe(innerFixture.length);
      for (let c = 0; c < innerContours.length; c++) {
        const contour = innerContours[c];
        expect(contour.length, `inner[${c}] curve count`).toBe(innerFixture[c].length);
        for (let i = 0; i < contour.length; i++) {
          expectCurveMatches(contour[i], innerFixture[c][i], `inner[${c}][${i}]`);
        }
      }

      const box = section.boundingBox;
      expect(Math.abs(box.min.x - fixture.boundingBox.minX)).toBeLessThan(TOL);
      expect(Math.abs(box.min.y - fixture.boundingBox.minY)).toBeLessThan(TOL);
      expect(Math.abs(box.max.x - fixture.boundingBox.maxX)).toBeLessThan(TOL);
      expect(Math.abs(box.max.y - fixture.boundingBox.maxY)).toBeLessThan(TOL);
    });
  }
});

describe('EU catalog snapshot', () => {
  const catalog = readCatalog('eu-steel.json');
  const byId = new Map(catalog.map((c) => [c.id.toLowerCase(), c]));

  it('every profile matches its snapshot entry', () => {
    for (const profile of EU_STEEL_PROFILES) expectCatalogMatches(profile, byId.get(profile.id.toLowerCase()));
  });

  it('every snapshot entry is still in the catalog', () => {
    for (const entry of catalog) expect(getProfile(entry.id), `catalog is missing ${entry.id}`).toBeDefined();
  });
});

describe('UK catalog snapshot', () => {
  it('matches the snapshot both ways', () => {
    const catalog = readCatalog('uk-steel.json');
    expect(UK_STEEL_PROFILES.length).toBe(catalog.length);
    const byId = new Map(catalog.map((c) => [c.id.toLowerCase(), c]));
    for (const profile of UK_STEEL_PROFILES) {
      expectCatalogMatches(profile, byId.get(profile.id.toLowerCase()));
      // UK profiles resolve through the shared lookup.
      expect(getProfile(profile.id)?.id).toBe(profile.id);
    }
  });
});
