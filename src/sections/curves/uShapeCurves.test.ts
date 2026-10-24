import { describe, expect, it } from 'vitest';
import type { UShape } from '../../shapes/profileShape';
import { buildUShapeOuter } from './uShapeCurves';

const upn: UShape = {
  kind: 'u',
  height: 320,
  flangeWidth: 100,
  webThickness: 14,
  flangeThickness: 17.5,
  innerFilletRadius: 17.5,
  outerFilletRadius: 8.8,
  flangeSlope: 5,
};

/** The bottom flange's sloped inner face. */
function bottomFace(shape: UShape) {
  const face = buildUShapeOuter(shape).find(
    (c) => c.kind === 'line' && c.startPoint.y < 0 && c.endPoint.y < 0 && c.startPoint.x !== c.endPoint.x && c.startPoint.y !== c.endPoint.y,
  );
  if (!face || face.kind !== 'line') throw new Error('no sloped bottom flange face');
  return face;
}

/** Flange thickness of the bottom flange's inner face at `fromTip` mm from the flange tip. */
function thicknessFromTip(shape: UShape, fromTip: number): number {
  const { startPoint: a, endPoint: b } = bottomFace(shape);
  const x = shape.flangeWidth / 2 - fromTip;
  return a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x) + shape.height / 2;
}

describe('UShape sloped flange', () => {
  it('slopes the inner face at flangeSlope', () => {
    const { startPoint: a, endPoint: b } = bottomFace(upn);
    expect((b.y - a.y) / (b.x - a.x)).toBeCloseTo(-0.05, 12);
  });

  it('measures tf at the middle of b by default', () => {
    expect(thicknessFromTip(upn, 50)).toBeCloseTo(17.5, 9);
  });
});
