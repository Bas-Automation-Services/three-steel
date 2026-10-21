// Exhaustive dispatch over the ProfileShape union; adding a shape without a generator becomes a compile error here.
import type { ProfileShape } from '../shapes/profileShape';
import { CrossSection } from './crossSection';
import { buildIShapeOuter } from './curves/iShapeCurves';
import { buildUShapeOuter } from './curves/uShapeCurves';
import { buildTShapeOuter } from './curves/tShapeCurves';
import { buildZShapeOuter } from './curves/zShapeCurves';
import { buildAngleOuter } from './curves/angleCurves';
import { buildRoundEdgedAngleOuter } from './curves/roundEdgedAngleCurves';
import { buildRectangularHollowOuter, buildRectangularHollowInner } from './curves/rectangularHollowCurves';
import { buildCircularHollowOuter, buildCircularHollowInner } from './curves/circularHollowCurves';
import { buildRectangleOuter } from './curves/rectangleCurves';
import { buildCircleOuter } from './curves/circleCurves';
import { buildHexagonOuter } from './curves/hexagonCurves';

export function buildCrossSection(shape: ProfileShape): CrossSection {
  switch (shape.kind) {
    case 'i':
      return new CrossSection(buildIShapeOuter(shape), [], shape);
    case 'u':
      return new CrossSection(buildUShapeOuter(shape), [], shape);
    case 't':
      return new CrossSection(buildTShapeOuter(shape), [], shape);
    case 'z':
      return new CrossSection(buildZShapeOuter(shape), [], shape);
    case 'angle':
      return new CrossSection(buildAngleOuter(shape), [], shape);
    case 'roundEdgedAngle':
      return new CrossSection(buildRoundEdgedAngleOuter(shape), [], shape);
    case 'rectHollow':
      return new CrossSection(buildRectangularHollowOuter(shape), buildRectangularHollowInner(shape), shape);
    case 'circHollow':
      return new CrossSection(buildCircularHollowOuter(shape), buildCircularHollowInner(shape), shape);
    case 'rect':
      return new CrossSection(buildRectangleOuter(shape), [], shape);
    case 'circle':
      return new CrossSection(buildCircleOuter(shape), [], shape);
    case 'hexagon':
      return new CrossSection(buildHexagonOuter(shape), [], shape);
    default: {
      const never: never = shape;
      throw new Error(`Unknown profile shape: ${(never as ProfileShape).kind}`);
    }
  }
}
