import { describe, expect, it } from 'vitest';
import { Arc3D, Helix3D, Line3D, Point3D, Vector3D } from '../geometry';
import { BeamGeometry } from './beamGeometry';
import { buildCrossSection } from '../sections/crossSectionBuilder';
import { getProfile } from '../profiles/euSteelProfiles';

const p = (x: number, y: number, z: number) => new Point3D(x, y, z);
const section = () => buildCrossSection(getProfile('IPE300')!.shape);

const expectUnit = (v: Vector3D) => expect(v.length).toBeCloseTo(1, 9);
const expectPerpendicular = (a: Vector3D, b: Vector3D) => expect(Math.abs(a.dot(b))).toBeLessThan(1e-9);

describe('BeamGeometry with a straight centerline (unchanged behavior)', () => {
  it('keeps the original planes, length and default up', () => {
    const g = new BeamGeometry(new Line3D(p(0, 0, 0), p(1000, 0, 0)), section());
    expect(g.length).toBeCloseTo(1000, 9);
    expect(g.upVector.isEqualTo(Vector3D.Z_AXIS)).toBe(true);
    expect(g.startPlane.normal.isEqualTo(new Vector3D(-1, 0, 0))).toBe(true);
    expect(g.endPlane.normal.isEqualTo(new Vector3D(1, 0, 0))).toBe(true);
    const cs = g.getCoordinateSystemAt(0.5);
    expect(cs.zAxis.isEqualTo(new Vector3D(1, 0, 0))).toBe(true);
    expect(cs.yAxis.isEqualTo(Vector3D.Z_AXIS)).toBe(true);
  });
});

describe('BeamGeometry with an arc centerline', () => {
  // Quarter circle R = 2000 in the XY plane: (2000,0,0) → (0,2000,0), CCW around +Z.
  const arc = () => Arc3D.fromStartEndCenter(p(2000, 0, 0), p(0, 2000, 0), p(0, 0, 0))!;

  it('defaults its up vector to the arc normal (fixed along the sweep)', () => {
    const g = new BeamGeometry(arc(), section());
    expect(g.upVector.isEqualTo(arc().normal, 1e-9)).toBe(true);
    // Explicit up still wins.
    const custom = new BeamGeometry(arc(), section(), Vector3D.X_AXIS);
    expect(custom.upVector.isEqualTo(Vector3D.X_AXIS, 1e-9)).toBe(true);
  });

  it('length and end planes follow the curve', () => {
    const g = new BeamGeometry(arc(), section());
    expect(g.length).toBeCloseTo(Math.PI * 1000, 6);
    // Start tangent is +Y (CCW quarter from the +X axis) → start plane faces −Y, end plane −X.
    expect(g.startPlane.normal.isEqualTo(new Vector3D(0, -1, 0), 1e-9)).toBe(true);
    expect(g.endPlane.normal.isEqualTo(new Vector3D(-1, 0, 0), 1e-9)).toBe(true);
    expect(g.startPlane.origin.isEqualTo(p(2000, 0, 0), 1e-6)).toBe(true);
    expect(g.endPlane.origin.isEqualTo(p(0, 2000, 0), 1e-6)).toBe(true);
  });

  it('frames are orthonormal with Z = tangent at every t', () => {
    const g = new BeamGeometry(arc(), section());
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const cs = g.getCoordinateSystemAt(t);
      expectUnit(cs.xAxis);
      expectUnit(cs.yAxis);
      expectUnit(cs.zAxis);
      expectPerpendicular(cs.xAxis, cs.yAxis);
      expectPerpendicular(cs.yAxis, cs.zAxis);
      expectPerpendicular(cs.zAxis, cs.xAxis);
      expect(cs.zAxis.isEqualTo(g.centerline.tangentAt(t), 1e-9)).toBe(true);
      expect(cs.origin.isEqualTo(g.centerline.pointAt(t), 1e-6)).toBe(true);
    }
  });

  it('does not twist: the frame rotates rigidly by the sweep around the arc normal', () => {
    const g = new BeamGeometry(arc(), section());
    const x0 = g.getCoordinateSystemAt(0).xAxis;
    const x1 = g.getCoordinateSystemAt(1).xAxis;
    // For a flat arc with up = normal, X (binormal) stays in the arc plane: rotating the start
    // frame's X by the sweep around the normal must give the end frame's X exactly.
    const rotated = x0.rotateAroundAxis(arc().normal, arc().sweepAngle);
    expect(rotated.isEqualTo(x1, 1e-9)).toBe(true);
    // And the up (Y) axis stays pinned to the arc normal the whole way.
    expect(g.getCoordinateSystemAt(0.5).yAxis.isEqualTo(arc().normal, 1e-9)).toBe(true);
  });
});

describe('BeamGeometry with a helix centerline', () => {
  const helix = (pitch: number) =>
    new Helix3D(p(0, 0, 0), Vector3D.Z_AXIS, Vector3D.X_AXIS, 1200, 0, 2 * Math.PI, pitch);

  it('defaults its up vector to the helix axis and builds orthonormal frames', () => {
    const g = new BeamGeometry(helix(2800), section());
    expect(g.upVector.isEqualTo(Vector3D.Z_AXIS, 1e-9)).toBe(true);
    for (const t of [0, 0.3, 0.6, 1]) {
      const cs = g.getCoordinateSystemAt(t);
      expectUnit(cs.xAxis);
      expectUnit(cs.yAxis);
      expectUnit(cs.zAxis);
      expectPerpendicular(cs.xAxis, cs.zAxis);
      expect(cs.zAxis.isEqualTo(g.centerline.tangentAt(t), 1e-9)).toBe(true);
    }
  });

  it('steep-pitch fallback: tangent ~parallel to up never produces NaN frames', () => {
    // Tiny radius + huge pitch → tangent within ~1e-5 rad of the axis; up × tangent degenerates
    // numerically, exercising the deterministic-perpendicular fallback path.
    const steep = new Helix3D(p(0, 0, 0), Vector3D.Z_AXIS, Vector3D.X_AXIS, 1e-4, 0, 2 * Math.PI, 1e6);
    const g = new BeamGeometry(steep, section());
    for (const t of [0, 0.5, 1]) {
      const cs = g.getCoordinateSystemAt(t);
      for (const axis of [cs.xAxis, cs.yAxis, cs.zAxis]) {
        expect(Number.isFinite(axis.x)).toBe(true);
        expect(Number.isFinite(axis.y)).toBe(true);
        expect(Number.isFinite(axis.z)).toBe(true);
        expectUnit(axis);
      }
      expectPerpendicular(cs.xAxis, cs.yAxis);
      expectPerpendicular(cs.yAxis, cs.zAxis);
    }
  });
});
