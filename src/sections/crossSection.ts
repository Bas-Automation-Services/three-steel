import { Box2D, type Curve2D, Point2D, Vector2D } from '../geometry';
import type { ProfileShape } from '../shapes/profileShape';
import type { InsertPosition } from './insertPosition';

export class CrossSection {
  readonly shape?: ProfileShape;
  private readonly outer: Curve2D[];
  private readonly inner: Curve2D[][];
  private cachedBoundingBox: Box2D | null = null;

  constructor(outerCurves: Curve2D[], innerContours: Curve2D[][] = [], shape?: ProfileShape) {
    if (outerCurves.length === 0) {
      throw new Error('Cross section must have at least one outer curve.');
    }
    this.outer = outerCurves;
    this.inner = innerContours;
    this.shape = shape;
  }

  get outerCurves(): readonly Curve2D[] {
    return this.outer;
  }

  get innerContours(): readonly (readonly Curve2D[])[] {
    return this.inner;
  }

  get isHollow(): boolean {
    return this.inner.length > 0;
  }

  get boundingBox(): Box2D {
    if (!this.cachedBoundingBox) {
      let box = this.outer[0].boundingBox;
      for (let i = 1; i < this.outer.length; i++) {
        box = box.union(this.outer[i].boundingBox);
      }
      this.cachedBoundingBox = box;
    }
    return this.cachedBoundingBox;
  }

  /** Diagonal of the bounding box — used when a section must be cut through completely. */
  get boundingBoxDiagonal(): number {
    const box = this.boundingBox;
    const width = box.max.x - box.min.x;
    const height = box.max.y - box.min.y;
    return Math.sqrt(width * width + height * height);
  }

  get centroid(): Point2D {
    return this.boundingBox.center;
  }

  getInsertPoint(position: InsertPosition): Point2D {
    const box = this.boundingBox;
    switch (position) {
      case 'TopLeft': return new Point2D(box.min.x, box.max.y);
      case 'TopCenter': return new Point2D(box.center.x, box.max.y);
      case 'TopRight': return new Point2D(box.max.x, box.max.y);
      case 'CenterLeft': return new Point2D(box.min.x, box.center.y);
      case 'CenterCenter': return box.center;
      case 'CenterRight': return new Point2D(box.max.x, box.center.y);
      case 'BottomLeft': return box.min;
      case 'BottomCenter': return new Point2D(box.center.x, box.min.y);
      case 'BottomRight': return new Point2D(box.max.x, box.min.y);
      default: return box.center;
    }
  }

  getInsertOffset(insertPosition: InsertPosition): Vector2D {
    const insertPoint = this.getInsertPoint(insertPosition);
    const centerPoint = this.getInsertPoint('CenterCenter');
    return insertPoint.sub(centerPoint);
  }

  /** Copy with only the outer contour — the solid envelope, for use as a cutting tool. */
  outerOnly(): CrossSection {
    return this.inner.length === 0 ? this : new CrossSection([...this.outer], [], this.shape);
  }
}
