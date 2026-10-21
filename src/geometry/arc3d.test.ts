import { describe, expect, it } from 'vitest';
import { Arc3D, projectCenterOntoBisectorPlane } from './curve3d';
import { Line3D } from './line3d';
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

/** Central-difference tangent of pointAt — the analytic tangentAt must agree to ~1e-6. */
const finiteDifferenceTangent = (curve: { pointAt(t: number): Point3D }, t: number): Vector3D => {
  const h = 1e-7;
  return curve.pointAt(t + h).sub(curve.pointAt(t - h)).normalized();
};

describe('Arc3D.fromThreePoints', () => {
  it('round-trips the three points at t = 0 / 0.5 / 1 (quarter circle)', () => {
    // Quarter circle radius 1000 about the origin in the XY plane, mid at 45°.
    const start = p(1000, 0, 0);
    const mid = p(1000 * Math.SQRT1_2, 1000 * Math.SQRT1_2, 0);
    const end = p(0, 1000, 0);
    const arc = Arc3D.fromThreePoints(start, mid, end)!;
    expect(arc).not.toBeNull();
    expect(arc.radius).toBeCloseTo(1000, 6);
    expectPointClose(arc.pointAt(0), start);
    expectPointClose(arc.pointAt(0.5), mid);
    expectPointClose(arc.pointAt(1), end);
  });

  it('round-trips a non-planar-axis arc (tilted plane)', () => {
    // Same quarter circle rotated so its plane is not a world plane.
    const axis = v(1, 2, 3).normalized();
    const rot = (pt: Point3D) => {
      const w = v(pt.x, pt.y, pt.z).rotateAroundAxis(axis, 0.7);
      return p(w.x + 100, w.y - 50, w.z + 20);
    };
    const start = rot(p(1000, 0, 0));
    const mid = rot(p(1000 * Math.SQRT1_2, 1000 * Math.SQRT1_2, 0));
    const end = rot(p(0, 1000, 0));
    const arc = Arc3D.fromThreePoints(start, mid, end)!;
    expect(arc).not.toBeNull();
    expect(arc.radius).toBeCloseTo(1000, 5);
    expectPointClose(arc.pointAt(0), start, 5);
    expectPointClose(arc.pointAt(0.5), mid, 5);
    expectPointClose(arc.pointAt(1), end, 5);
  });

  it('takes the major (>π) sweep when the mid point demands it', () => {
    // Start at 0°, mid at −90°, end at +90°: the arc must run through the bottom of the circle,
    // a 270° sweep. The constructor's normal comes from (mid−start)×(end−start), which always
    // winds start→mid→end CCW around itself — here that flips the normal to −Z.
    const arc = Arc3D.fromThreePoints(p(1000, 0, 0), p(0, -1000, 0), p(0, 1000, 0))!;
    expect(arc).not.toBeNull();
    expect(arc.normal.z).toBeLessThan(0);
    expect(Math.abs(arc.sweepAngle)).toBeCloseTo(1.5 * Math.PI, 6);
    // Mid sits a third of the way around (90° of 270°).
    expectPointClose(arc.pointAt(1 / 3), p(0, -1000, 0));
  });

  it('returns null for collinear points', () => {
    expect(Arc3D.fromThreePoints(p(0, 0, 0), p(500, 0, 0), p(1000, 0, 0))).toBeNull();
  });
});

describe('Arc3D.fromStartEndCenter', () => {
  const start = p(1000, 0, 0);
  const end = p(0, 1000, 0);
  const center = p(0, 0, 0);

  it('takes the short way by default (90°, CCW around +Z here)', () => {
    const arc = Arc3D.fromStartEndCenter(start, end, center)!;
    expect(arc).not.toBeNull();
    expect(Math.abs(arc.sweepAngle)).toBeCloseTo(Math.PI / 2, 9);
    expectPointClose(arc.pointAt(0), start);
    expectPointClose(arc.pointAt(1), end);
    // Short way passes through 45°.
    expectPointClose(arc.pointAt(0.5), p(1000 * Math.SQRT1_2, 1000 * Math.SQRT1_2, 0));
  });

  it('ccwHint +Z keeps the short CCW quarter', () => {
    const arc = Arc3D.fromStartEndCenter(start, end, center, Vector3D.Z_AXIS)!;
    expect(arc).not.toBeNull();
    expect(arc.normal.dot(Vector3D.Z_AXIS)).toBeGreaterThan(0);
    expect(arc.sweepAngle * arc.normal.dot(Vector3D.Z_AXIS)).toBeGreaterThan(0);
    expectPointClose(arc.pointAt(0.5), p(1000 * Math.SQRT1_2, 1000 * Math.SQRT1_2, 0));
  });

  it('ccwHint −Z takes the LONG way (270° around −Z), same endpoints', () => {
    const arc = Arc3D.fromStartEndCenter(start, end, center, v(0, 0, -1))!;
    expect(arc).not.toBeNull();
    expect(arc.normal.dot(Vector3D.Z_AXIS)).toBeLessThan(0);
    expect(Math.abs(arc.sweepAngle)).toBeCloseTo(1.5 * Math.PI, 9);
    expectPointClose(arc.pointAt(0), start);
    expectPointClose(arc.pointAt(1), end);
    // The long way runs (1000,0) → (0,−1000) → (−1000,0) → (0,1000): its halfway point is the
    // 225° position (−√½, −√½)·R.
    expectPointClose(arc.pointAt(0.5), p(-1000 * Math.SQRT1_2, -1000 * Math.SQRT1_2, 0));
  });

  it('rejects genuinely unequal radii but accepts within 1e-6 relative', () => {
    expect(Arc3D.fromStartEndCenter(start, p(0, 1010, 0), center)).toBeNull();
    const nearlyEqual = Arc3D.fromStartEndCenter(start, p(0, 1000 + 5e-4, 0), center);
    expect(nearlyEqual).not.toBeNull();
  });

  it('returns null when the points are collinear with the center (incl. half turn)', () => {
    expect(Arc3D.fromStartEndCenter(start, p(-1000, 0, 0), center)).toBeNull();
  });
});

describe('Arc3D sweep / length / tangent', () => {
  it('sweepAngle normalizes into (0, 2π] for CCW and [−2π, 0) for CW', () => {
    const ccwWrapped = new Arc3D(p(0, 0, 0), Vector3D.Z_AXIS, Vector3D.X_AXIS, 100, 1.5 * Math.PI, 0.5 * Math.PI, true);
    expect(ccwWrapped.sweepAngle).toBeCloseTo(Math.PI, 12); // −π raw + 2π
    const cwWrapped = new Arc3D(p(0, 0, 0), Vector3D.Z_AXIS, Vector3D.X_AXIS, 100, 0.5 * Math.PI, 1.5 * Math.PI, false);
    expect(cwWrapped.sweepAngle).toBeCloseTo(-Math.PI, 12); // +π raw − 2π
    // Coincident angles = a FULL turn, not an empty arc.
    const full = new Arc3D(p(0, 0, 0), Vector3D.Z_AXIS, Vector3D.X_AXIS, 100, 0, 0, true);
    expect(full.sweepAngle).toBeCloseTo(2 * Math.PI, 12);
  });

  it('length = |sweep|·radius', () => {
    const arc = Arc3D.fromStartEndCenter(p(1000, 0, 0), p(0, 1000, 0), p(0, 0, 0))!;
    expect(arc.length).toBeCloseTo((Math.PI / 2) * 1000, 6);
  });

  it('tangentAt agrees with a finite difference of pointAt (CCW and CW)', () => {
    const ccw = Arc3D.fromThreePoints(p(1000, 0, 0), p(0, 1000, 0), p(-1000, 0, 0))!;
    const cw = Arc3D.fromThreePoints(p(1000, 0, 0), p(0, -1000, 0), p(-1000, 0, 0))!;
    for (const arc of [ccw, cw]) {
      for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        const analytic = arc.tangentAt(t);
        const numeric = finiteDifferenceTangent(arc, t);
        expect(analytic.sub(numeric).length).toBeLessThan(1e-6);
        expect(analytic.length).toBeCloseTo(1, 9);
      }
    }
  });

  it('startPoint/endPoint match pointAt(0)/pointAt(1)', () => {
    const arc = Arc3D.fromStartEndCenter(p(1000, 0, 0), p(0, 1000, 0), p(0, 0, 0))!;
    expectPointClose(arc.startPoint, arc.pointAt(0), 12);
    expectPointClose(arc.endPoint, arc.pointAt(1), 12);
  });
});

describe('Arc3D.offsetRadial', () => {
  const arc = Arc3D.fromStartEndCenter(p(1000, 0, 0), p(0, 1000, 0), p(0, 0, 0))!;

  it('moves pointAt(0) radially toward the center by the distance', () => {
    const offset = arc.offsetRadial(100)!;
    expect(offset).not.toBeNull();
    expect(offset.radius).toBeCloseTo(900, 9);
    expectPointClose(offset.pointAt(0), p(900, 0, 0));
    expectPointClose(offset.pointAt(1), p(0, 900, 0));
  });

  it('flips the radius sign past the center, preserving the parameterization', () => {
    const flipped = arc.offsetRadial(1500)!;
    expect(flipped).not.toBeNull();
    expect(flipped.radius).toBeCloseTo(-500, 9);
    // The t=0 point crossed THROUGH the center to the opposite side — the same radial ray,
    // 1500 mm inward from (1000,0,0).
    expectPointClose(flipped.pointAt(0), p(-500, 0, 0));
    expectPointClose(flipped.pointAt(1), p(0, -500, 0));
    // Parameterization preserved: same angular travel direction as the original.
    expect(flipped.sweepAngle).toBeCloseTo(arc.sweepAngle, 12);
  });

  it('returns null when the offset lands on the center', () => {
    expect(arc.offsetRadial(1000)).toBeNull();
  });
});

describe('Arc3D.snapToPlanes', () => {
  // Quarter circle R=1000 in XY, start (1000,0,0) → end (0,1000,0).
  const arc = Arc3D.fromStartEndCenter(p(1000, 0, 0), p(0, 1000, 0), p(0, 0, 0))!;

  it('slides both endpoints along the circle onto their planes', () => {
    // Planes at 30° and 60° through the center: x·sin − y·cos = 0 lines in the arc plane.
    const startPlane = new Plane3D(p(0, 0, 0), v(-Math.sin(Math.PI / 6), Math.cos(Math.PI / 6), 0));
    const endPlane = new Plane3D(p(0, 0, 0), v(-Math.sin(Math.PI / 3), Math.cos(Math.PI / 3), 0));
    const snapped = arc.snapToPlanes(startPlane, endPlane)!;
    expect(snapped).not.toBeNull();
    expectPointClose(snapped.startPoint, p(1000 * Math.cos(Math.PI / 6), 1000 * Math.sin(Math.PI / 6), 0), 5);
    expectPointClose(snapped.endPoint, p(1000 * Math.cos(Math.PI / 3), 1000 * Math.sin(Math.PI / 3), 0), 5);
    // Circle unchanged: same center/radius/orientation.
    expectPointClose(snapped.center, arc.center, 9);
    expect(snapped.radius).toBeCloseTo(arc.radius, 9);
    expect(snapped.isCounterClockwise).toBe(arc.isCounterClockwise);
    // Endpoints actually ON the planes.
    expect(Math.abs(startPlane.signedDistanceTo(snapped.startPoint))).toBeLessThan(1e-6);
    expect(Math.abs(endPlane.signedDistanceTo(snapped.endPoint))).toBeLessThan(1e-6);
  });

  it('leaves a null-plane endpoint unchanged and returns this when nothing moves', () => {
    // y = 200 crosses the circle at x = ±√(1000²−200²); the root NEAR the old start (1000,0,0)
    // wins — an asymmetric plane, so the two roots are clearly distinguished.
    const startOnly = arc.snapToPlanes(new Plane3D(p(0, 200, 0), Vector3D.Y_AXIS), null)!;
    expect(startOnly).not.toBeNull();
    expectPointClose(startOnly.startPoint, p(Math.sqrt(1000 * 1000 - 200 * 200), 200, 0), 5);
    expectPointClose(startOnly.endPoint, arc.endPoint, 9);
    expect(arc.snapToPlanes(null, null)).toBe(arc);
  });

  it('returns null when a plane misses the circle or is parallel to the arc plane', () => {
    expect(arc.snapToPlanes(new Plane3D(p(2000, 0, 0), Vector3D.X_AXIS), null)).toBeNull();
    expect(arc.snapToPlanes(new Plane3D(p(0, 0, 100), Vector3D.Z_AXIS), null)).toBeNull();
  });
});

describe('projectCenterOntoBisectorPlane', () => {
  it('projects a free center pick onto the a–b bisector plane (equidistant result)', () => {
    const a = p(1000, 0, 0);
    const b = p(0, 1000, 0);
    const off = p(100, 0, 0); // NOT equidistant from a and b
    const center = projectCenterOntoBisectorPlane(a, b, off);
    expect(center.distanceTo(a)).toBeCloseTo(center.distanceTo(b), 9);
    // The projection moves the pick the minimal distance: along the a–b direction only.
    const ab = b.sub(a).normalized();
    const moved = center.sub(off);
    expect(moved.sub(ab.scale(moved.dot(ab))).length).toBeLessThan(1e-9);
    // An already-valid center is untouched.
    expectPointClose(projectCenterOntoBisectorPlane(a, b, p(0, 0, 0)), p(0, 0, 0), 12);
  });

  it('feeds fromStartEndCenter so a slightly-moved center still builds a valid arc', () => {
    const a = p(1000, 0, 0);
    const b = p(0, 1000, 0);
    const dragged = p(3, -2, 1); // a parametric move nudged the center off the bisector
    const arc = Arc3D.fromStartEndCenter(a, b, projectCenterOntoBisectorPlane(a, b, dragged))!;
    expect(arc).not.toBeNull();
    expectPointClose(arc.pointAt(0), a, 6);
    expectPointClose(arc.pointAt(1), b, 6);
  });
});

describe('MemberCurve structural uniformity', () => {
  it('Line3D and Arc3D expose the same parametric surface', () => {
    const line = new Line3D(p(0, 0, 0), p(1000, 0, 0));
    const arc = Arc3D.fromStartEndCenter(p(1000, 0, 0), p(0, 1000, 0), p(0, 0, 0))!;
    for (const curve of [line, arc]) {
      expect(curve.length).toBeGreaterThan(0);
      expect(curve.startPoint).toBeInstanceOf(Point3D);
      expect(curve.endPoint).toBeInstanceOf(Point3D);
      expect(curve.pointAt(0.5)).toBeInstanceOf(Point3D);
      expect(curve.tangentAt(0.5).length).toBeCloseTo(1, 9);
    }
  });
});
