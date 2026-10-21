import { describe, expect, it } from 'vitest';
import { Arc3D, Helix3D, Line3D, Point3D, Vector3D } from '../geometry';
import { applyEndExtensions, applyInsertOffset, extendCurveEnds, miterBisectorNormal } from './beamMath';
import { buildCrossSection } from '../sections/crossSectionBuilder';
import { INSERT_POSITIONS } from '../sections/insertPosition';
import { getProfile } from '../profiles/euSteelProfiles';

const p = (x: number, y: number, z: number) => new Point3D(x, y, z);

describe('applyEndExtensions', () => {
  it('extends both ends along the axis', () => {
    const line = new Line3D(p(0, 0, 0), p(1000, 0, 0));
    const extended = applyEndExtensions(line, 100, 50);
    expect(extended.startPoint.x).toBeCloseTo(-100, 9);
    expect(extended.endPoint.x).toBeCloseTo(1050, 9);
    expect(extended.length).toBeCloseTo(1150, 9);
  });

  it('returns the original when both extensions are ~0', () => {
    const line = new Line3D(p(0, 0, 0), p(1000, 0, 0));
    expect(applyEndExtensions(line, 0, 0)).toBe(line);
  });
});

describe('extendCurveEnds', () => {
  it('lines: delegates to applyEndExtensions (exact endpoint positions)', () => {
    const line = new Line3D(p(0, 0, 0), p(1000, 0, 0));
    const extended = extendCurveEnds(line, 100, 50) as Line3D;
    expect(extended.kind).toBe('line3d');
    expect(extended.startPoint.x).toBeCloseTo(-100, 9);
    expect(extended.endPoint.x).toBeCloseTo(1050, 9);
    expect(extendCurveEnds(line, 0, 0)).toBe(line);
  });

  it('arcs: grows the sweep — endpoints land mm further along the curve, mid-arc untouched', () => {
    // Quarter circle R = 1000 in XY, CCW: (1000,0,0) → (0,1000,0).
    const arc = Arc3D.fromStartEndCenter(p(1000, 0, 0), p(0, 1000, 0), p(0, 0, 0))!;
    const extended = extendCurveEnds(arc, 50, 80) as Arc3D;
    expect(extended.kind).toBe('arc3d');
    // Length grows by exactly the extensions (arc length is dθ·R).
    expect(extended.length).toBeCloseTo(arc.length + 130, 6);
    // Exact new endpoints: ∓dθ past the old angles on the same circle.
    const dS = 50 / 1000;
    const dE = 80 / 1000;
    expect(extended.startPoint.isEqualTo(p(1000 * Math.cos(-dS), 1000 * Math.sin(-dS), 0), 1e-6)).toBe(true);
    expect(
      extended.endPoint.isEqualTo(
        p(1000 * Math.cos(Math.PI / 2 + dE), 1000 * Math.sin(Math.PI / 2 + dE), 0), 1e-6,
      ),
    ).toBe(true);
    // For small extensions the new start sits ~mm along the REVERSED start tangent.
    const approx = arc.startPoint.add(arc.tangentAt(0).scale(-50));
    expect(extended.startPoint.distanceTo(approx)).toBeLessThan(50 * 50 / 1000); // sagitta bound
    // Old t=0.5 point still lies ON the extended arc (same circle, same direction).
    const mid = arc.pointAt(0.5);
    expect(mid.distanceTo(extended.center)).toBeCloseTo(extended.radius, 6);
  });

  it('arcs: negative extensions trim, and a CW arc extends against its travel direction', () => {
    const ccw = Arc3D.fromStartEndCenter(p(1000, 0, 0), p(0, 1000, 0), p(0, 0, 0))!;
    const trimmed = extendCurveEnds(ccw, -100, -100) as Arc3D;
    expect(trimmed.length).toBeCloseTo(ccw.length - 200, 6);

    const cw = Arc3D.fromStartEndCenter(p(1000, 0, 0), p(0, 1000, 0), p(0, 0, 0), new Vector3D(0, 0, -1))!;
    expect(cw.sweepAngle).toBeGreaterThan(0); // CCW around its own (−Z) normal…
    const extendedCw = extendCurveEnds(cw, 50, 0) as Arc3D;
    expect(extendedCw.length).toBeCloseTo(cw.length + 50, 6);
    // …and the extended start still sits behind the original start along the reversed tangent
    // (within the curvature sagitta of a 50 mm step on R = 1000).
    const approx = cw.startPoint.add(cw.tangentAt(0).scale(-50));
    expect(extendedCw.startPoint.distanceTo(approx)).toBeLessThan(50 * 50 / 1000);
  });

  it('helices: endpoints extend along the curve within 1e-6 relative for small extensions', () => {
    const helix = new Helix3D(
      p(0, 0, 0), Vector3D.Z_AXIS, Vector3D.X_AXIS, 1000, 0.2, 1.5 * Math.PI, 300,
    );
    const extended = extendCurveEnds(helix, 40, 70) as Helix3D;
    expect(extended.kind).toBe('helix3d');
    expect(extended.length).toBeCloseTo(helix.length + 110, 6);
    // The extended curve is the SAME infinite helix: its t for the old start/end must give the
    // old points exactly (old start now sits 40 mm of arc length in).
    const tOldStart = 40 / extended.length;
    const tOldEnd = (40 + helix.length) / extended.length;
    expect(extended.pointAt(tOldStart).distanceTo(helix.startPoint)).toBeLessThan(1e-6);
    expect(extended.pointAt(tOldEnd).distanceTo(helix.endPoint)).toBeLessThan(1e-6);
    // New start ≈ 40 mm behind the old start along the reversed start tangent (curvature-bent).
    const approx = helix.startPoint.add(helix.tangentAt(0).scale(-40));
    expect(extended.startPoint.distanceTo(approx)).toBeLessThan(40 * 40 / 1000);
    // Endpoint distances measured along the curve are exact.
    expect(extended.startPoint.distanceTo(helix.startPoint)).toBeLessThan(40 + 1e-6);
    expect(extended.startPoint.distanceTo(helix.startPoint)).toBeGreaterThan(39.9);
  });

  it('helices: negative sweep (opposite handedness) extends symmetrically', () => {
    const cw = new Helix3D(
      p(0, 0, 0), Vector3D.Z_AXIS, Vector3D.X_AXIS, 1000, 0.2, -1.5 * Math.PI, 300,
    );
    const extended = extendCurveEnds(cw, 40, 0) as Helix3D;
    expect(extended.length).toBeCloseTo(cw.length + 40, 6);
    expect(extended.pointAt(40 / extended.length).distanceTo(cw.startPoint)).toBeLessThan(1e-6);
    const approx = cw.startPoint.add(cw.tangentAt(0).scale(-40));
    expect(extended.startPoint.distanceTo(approx)).toBeLessThan(40 * 40 / 1000);
  });
});

describe('miterBisectorNormal', () => {
  it('bisects a 90° corner at 45°', () => {
    const n = miterBisectorNormal(p(0, 0, 0), p(1000, 0, 0), p(0, 1000, 0))!;
    expect(n).not.toBeNull();
    expect(Math.abs(n.x)).toBeCloseTo(Math.SQRT1_2, 9);
    expect(Math.abs(n.y)).toBeCloseTo(Math.SQRT1_2, 9);
    expect(n.z).toBeCloseTo(0, 9);
  });

  it('returns null for collinear beams', () => {
    expect(miterBisectorNormal(p(0, 0, 0), p(1000, 0, 0), p(2000, 0, 0))).toBeNull();
  });
});

describe('applyInsertOffset', () => {
  it('TopCenter drops the centerline by half the height', () => {
    const section = buildCrossSection(getProfile('IPE300')!.shape);
    const driver = new Line3D(p(0, 0, 0), p(1000, 0, 0));
    const shifted = applyInsertOffset(driver, section, 'TopCenter', 0);
    // Driver along X, default up = Z: TopCenter anchor puts the driver at the top of the section.
    expect(shifted.startPoint.z).toBeCloseTo(-150, 9);
    expect(shifted.endPoint.z).toBeCloseTo(-150, 9);
    expect(shifted.startPoint.y).toBeCloseTo(0, 9);
  });

  it('CenterCenter leaves the driver untouched', () => {
    const section = buildCrossSection(getProfile('IPE300')!.shape);
    const driver = new Line3D(p(0, 0, 0), p(1000, 0, 0));
    expect(applyInsertOffset(driver, section, 'CenterCenter', 0)).toBe(driver);
  });

  /**
   * The invariant the whole anchor UI promises: whatever anchor you pick, THAT point of the
   * section's bounding box ends up ON the driving line. Checked for all nine at once by walking
   * the section frame back out from the shifted centerline — driver along +X with the default up
   * (+Z) gives binormal = +Y (section X) and orthogonal up = +Z (section Y), so the anchor's
   * world position is centerline + (anchor.x on Y) + (anchor.y on Z), and it must be the driver.
   */
  it('puts the chosen anchor of the section ON the driving line, for all nine anchors', () => {
    const section = buildCrossSection(getProfile('IPE300')!.shape);
    const driver = new Line3D(p(0, 0, 0), p(1000, 0, 0));

    for (const position of INSERT_POSITIONS) {
      const shifted = applyInsertOffset(driver, section, position, 0);
      const anchor = section.getInsertOffset(position);
      // The anchor point of the section, in world, at the start of the beam.
      const anchorWorldY = shifted.startPoint.y + anchor.x;
      const anchorWorldZ = shifted.startPoint.z + anchor.y;
      expect(anchorWorldY).toBeCloseTo(driver.startPoint.y, 9);
      expect(anchorWorldZ).toBeCloseTo(driver.startPoint.z, 9);
    }
  });

  it('offsets nudge the section further off the line, on top of the anchor', () => {
    // The fabricator's case: flush the top flange to the line, then drop the beam 20 mm.
    const section = buildCrossSection(getProfile('IPE300')!.shape);
    const driver = new Line3D(p(0, 0, 0), p(1000, 0, 0));

    const flush = applyInsertOffset(driver, section, 'TopCenter', 0);
    const dropped = applyInsertOffset(driver, section, 'TopCenter', 0, 0, -20);
    // Section +Y is world +Z here, so a -20 offsetY lowers the section by a further 20 mm — i.e.
    // the CENTERLINE the resolver returns moves DOWN by 20 relative to the flush case.
    expect(dropped.startPoint.z).toBeCloseTo(flush.startPoint.z - 20, 9);
    // ...and the top flange now sits 20 mm BELOW the driving line, which is the point.
    expect(dropped.startPoint.z + section.getInsertOffset('TopCenter').y).toBeCloseTo(-20, 9);
  });

  it('offsetX rides the section X axis (the binormal), not world X', () => {
    const section = buildCrossSection(getProfile('IPE300')!.shape);
    const driver = new Line3D(p(0, 0, 0), p(1000, 0, 0));
    const shifted = applyInsertOffset(driver, section, 'CenterCenter', 0, 30, 0);
    // Driver along +X, up = +Z → binormal = +Y. The offset must land entirely on world Y.
    expect(shifted.startPoint.y).toBeCloseTo(30, 9);
    expect(shifted.startPoint.z).toBeCloseTo(0, 9);
    expect(shifted.startPoint.x).toBeCloseTo(0, 9);
  });

  it('rotation carries the anchor with the section frame', () => {
    // Rotating the section 90° about its own axis turns "TopCenter" from a drop in world Z into a
    // shift in world Y: the anchor is a property of the SECTION's frame, never of the world.
    const section = buildCrossSection(getProfile('IPE300')!.shape);
    const driver = new Line3D(p(0, 0, 0), p(1000, 0, 0));
    const shifted = applyInsertOffset(driver, section, 'TopCenter', Math.PI / 2);
    expect(Math.hypot(shifted.startPoint.y, shifted.startPoint.z)).toBeCloseTo(150, 6);
    expect(shifted.startPoint.z).toBeCloseTo(0, 6);
  });

  /**
   * OLD-DOCUMENT COMPATIBILITY. Members persisted before the section offsets existed carry no
   * offsetXMm/offsetYMm at all. resolveModel passes member.offsetXMm straight in, so those reads
   * are `undefined` — which must behave as 0 (a default parameter, not NaN arithmetic). If this
   * ever regressed, every legacy beam would resolve to NaN coordinates and vanish.
   */
  it('treats a legacy member without offsets exactly as offsets of zero', () => {
    const section = buildCrossSection(getProfile('IPE300')!.shape);
    const driver = new Line3D(p(0, 0, 0), p(1000, 0, 0));
    const legacy = { offsetXMm: undefined, offsetYMm: undefined } as unknown as {
      offsetXMm: number;
      offsetYMm: number;
    };

    const shifted = applyInsertOffset(driver, section, 'TopCenter', 0, legacy.offsetXMm, legacy.offsetYMm);
    expect(Number.isNaN(shifted.startPoint.z)).toBe(false);
    expect(shifted.startPoint.z).toBeCloseTo(-150, 9);
    // ...and a legacy CENTRED member still short-circuits to the untouched driver.
    expect(applyInsertOffset(driver, section, 'CenterCenter', 0, legacy.offsetXMm, legacy.offsetYMm)).toBe(driver);
  });
});
