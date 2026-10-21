import { describe, expect, it } from 'vitest';
import { Helix3D } from './helix3d';
import { Plane3D } from './plane3d';
import { Point3D } from './point3d';
import { Vector3D } from './vector3d';

const p = (x: number, y: number, z: number) => new Point3D(x, y, z);
const v = (x: number, y: number, z: number) => new Vector3D(x, y, z);

const expectPointClose = (actual: Point3D, expected: Point3D, digits = 6) => {
  expect(actual.x).toBeCloseTo(expected.x, digits);
  expect(actual.y).toBeCloseTo(expected.y, digits);
  expect(actual.z).toBeCloseTo(expected.z, digits);
};

/** Vertical reference helix: R = 1000, one full CCW turn from +X, rising 250/turn. */
const reference = () =>
  new Helix3D(p(0, 0, 0), Vector3D.Z_AXIS, Vector3D.X_AXIS, 1000, 0, 2 * Math.PI, 250);

describe('Helix3D basics', () => {
  it('length = |sweep|·sqrt(R² + (pitch/2π)²)', () => {
    const h = reference();
    const c = 250 / (2 * Math.PI);
    expect(h.length).toBeCloseTo(2 * Math.PI * Math.sqrt(1000 * 1000 + c * c), 6);
    // Zero pitch degenerates to the circle's circumference.
    const flat = new Helix3D(p(0, 0, 0), Vector3D.Z_AXIS, Vector3D.X_AXIS, 1000, 0, 2 * Math.PI, 0);
    expect(flat.length).toBeCloseTo(2 * Math.PI * 1000, 6);
  });

  it('pointAt(0)/pointAt(1) are the start/end, one pitch apart after a full turn', () => {
    const h = reference();
    expectPointClose(h.pointAt(0), p(1000, 0, 0));
    expectPointClose(h.startPoint, p(1000, 0, 0));
    // Full turn: back over the start, risen by exactly the pitch.
    expectPointClose(h.pointAt(1), p(1000, 0, 250));
    expectPointClose(h.endPoint, p(1000, 0, 250));
    // Quarter turn: at +Y, a quarter of the pitch up.
    expectPointClose(h.pointAt(0.25), p(0, 1000, 62.5));
  });

  it('negative sweep mirrors the handedness (winds CW around +axis, rise flips with travel)', () => {
    const cw = new Helix3D(p(0, 0, 0), Vector3D.Z_AXIS, Vector3D.X_AXIS, 1000, 0, -2 * Math.PI, 250);
    // Quarter of the way: θ = −π/2 → −Y side; the axial term follows θ−θ₀ = −π/2, so the
    // helix DESCENDS along +Z when wound backwards with a positive pitch.
    expectPointClose(cw.pointAt(0.25), p(0, -1000, -62.5));
    expectPointClose(cw.pointAt(1), p(1000, 0, -250));
    expect(cw.length).toBeCloseTo(reference().length, 9);
  });

  it('respects startAngle and an arbitrary axis frame', () => {
    // Axis +Y, xAxis +Z (already perpendicular): yAxis = axis×xAxis = Y×Z = X.
    const h = new Helix3D(p(10, 20, 30), Vector3D.Y_AXIS, Vector3D.Z_AXIS, 500, Math.PI / 2, Math.PI, 100);
    // θ₀ = 90°: start at origin + R·(cos90·Z + sin90·X) = +X side.
    expectPointClose(h.pointAt(0), p(510, 20, 30));
    // Half turn later (θ = 270°): −X side, risen 50 along +Y.
    expectPointClose(h.pointAt(1), p(-490, 70, 30));
  });
});

describe('Helix3D tangents', () => {
  it('tangentAt agrees with a finite difference of pointAt (both handedness)', () => {
    const helices = [
      reference(),
      new Helix3D(p(0, 0, 0), Vector3D.Z_AXIS, Vector3D.X_AXIS, 1000, 0.3, -1.7 * Math.PI, 250),
      new Helix3D(p(5, -3, 8), v(1, 1, 0), v(0, 0, 1), 400, 0.5, 3 * Math.PI, -120),
    ];
    const h = 1e-7;
    for (const helix of helices) {
      for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        const analytic = helix.tangentAt(t);
        const numeric = helix.pointAt(t + h).sub(helix.pointAt(t - h)).normalized();
        expect(analytic.sub(numeric).length).toBeLessThan(1e-6);
        expect(analytic.length).toBeCloseTo(1, 9);
      }
    }
  });

  it('keeps a constant angle to the axis (the twist-free up reference)', () => {
    const helix = reference();
    const first = helix.tangentAt(0).dot(helix.axis);
    for (const t of [0.2, 0.5, 0.9]) {
      expect(helix.tangentAt(t).dot(helix.axis)).toBeCloseTo(first, 9);
    }
    expect(first).toBeGreaterThan(0); // positive pitch, positive sweep → climbs +axis
  });
});

describe('Helix3D.snapToPlanes', () => {
  it('horizontal plane trim matches the analytic z solution (rise = pitch·θ/2π)', () => {
    const h = reference(); // R = 1000, full turn, pitch 250, start at (1000, 0, 0)
    // End plane z = 200 → θ = 2π·(200/250) → t = 0.8; start plane z = 50 → t = 0.2.
    const snapped = h.snapToPlanes(
      new Plane3D(p(0, 0, 50), Vector3D.Z_AXIS),
      new Plane3D(p(0, 0, 200), Vector3D.Z_AXIS),
    )!;
    expect(snapped).not.toBeNull();
    expectPointClose(snapped.startPoint, h.pointAt(0.2), 6);
    expectPointClose(snapped.endPoint, h.pointAt(0.8), 6);
    expect(snapped.startPoint.z).toBeCloseTo(50, 6);
    expect(snapped.endPoint.z).toBeCloseTo(200, 6);
    // Shape parameters preserved; sweep shrunk to the trimmed window.
    expect(snapped.radius).toBe(h.radius);
    expect(snapped.pitch).toBe(h.pitch);
    expect(snapped.sweepAngle).toBeCloseTo(0.6 * h.sweepAngle, 9);
    expect(snapped.length).toBeCloseTo(0.6 * h.length, 6);
  });

  it('an oblique plane lands the endpoint exactly on the plane, still on the helix', () => {
    const h = reference();
    const plane = new Plane3D(p(0, 0, 180), v(0.25, -0.1, 1).normalized());
    const snapped = h.snapToPlanes(null, plane)!;
    expect(snapped).not.toBeNull();
    expect(Math.abs(plane.signedDistanceTo(snapped.endPoint))).toBeLessThan(1e-6);
    expectPointClose(snapped.startPoint, h.startPoint, 9); // null start plane: untouched
    // Endpoint stays ON the cylinder (radial distance from the axis = R).
    const e = snapped.endPoint;
    expect(Math.hypot(e.x, e.y)).toBeCloseTo(1000, 6);
    expect(Math.abs(snapped.sweepAngle)).toBeLessThan(Math.abs(h.sweepAngle));
  });

  it('picks the crossing NEAREST the trimmed end when a plane crosses twice', () => {
    const h = reference();
    // The plane x = 0 crosses the full turn at θ = π/2 (t = 0.25) and θ = 3π/2 (t = 0.75):
    // an end trim must keep the t = 0.75 crossing (minimal trim), not cut back to t = 0.25.
    const snapped = h.snapToPlanes(null, new Plane3D(p(0, 0, 0), Vector3D.X_AXIS))!;
    expect(snapped).not.toBeNull();
    expectPointClose(snapped.endPoint, h.pointAt(0.75), 5);
  });

  it('returns this when nothing moves and null when a plane never crosses', () => {
    const h = reference();
    expect(h.snapToPlanes(null, null)).toBe(h);
    // Both endpoints already on their planes (z = 0 start, z = 250 end).
    expect(
      h.snapToPlanes(new Plane3D(p(0, 0, 0), Vector3D.Z_AXIS), new Plane3D(p(0, 0, 250), Vector3D.Z_AXIS)),
    ).toBe(h);
    // z = 1000 is far above the one-turn rise (250 + 10% padding) — no crossing.
    expect(h.snapToPlanes(null, new Plane3D(p(0, 0, 1000), Vector3D.Z_AXIS))).toBeNull();
    // Trims crossing over (start plane above the end plane) degenerate the member.
    expect(
      h.snapToPlanes(new Plane3D(p(0, 0, 200), Vector3D.Z_AXIS), new Plane3D(p(0, 0, 50), Vector3D.Z_AXIS)),
    ).toBeNull();
  });
});

describe('Helix3D constructor hygiene', () => {
  it('normalizes the axis and Gram-Schmidt re-orthogonalizes the xAxis', () => {
    // Axis passed unnormalized; xAxis passed with a big axis-parallel component.
    const h = new Helix3D(p(0, 0, 0), v(0, 0, 5), v(2, 0, 9), 100, 0, Math.PI, 50);
    expect(h.axis.length).toBeCloseTo(1, 12);
    expect(h.xAxis.length).toBeCloseTo(1, 12);
    expect(Math.abs(h.xAxis.dot(h.axis))).toBeLessThan(1e-12);
    // The in-plane part of the seed (+X) survives the orthogonalization.
    expect(h.xAxis.x).toBeCloseTo(1, 12);
    expectPointClose(h.pointAt(0), p(100, 0, 0));
  });

  it('falls back to a deterministic perpendicular when xAxis is parallel to the axis', () => {
    const a = new Helix3D(p(0, 0, 0), Vector3D.Z_AXIS, Vector3D.Z_AXIS, 100, 0, Math.PI, 50);
    const b = new Helix3D(p(0, 0, 0), Vector3D.Z_AXIS, Vector3D.Z_AXIS, 100, 0, Math.PI, 50);
    expect(a.xAxis.length).toBeCloseTo(1, 12);
    expect(Math.abs(a.xAxis.dot(a.axis))).toBeLessThan(1e-12);
    expect(a.xAxis.isEqualTo(b.xAxis)).toBe(true); // deterministic, not random
  });
});
