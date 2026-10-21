// The 3×3 grid decomposition the anchor picker navigates by. Pinned here (rather than left to the
// widget) because the ROW-MAJOR order of INSERT_POSITIONS is load-bearing: the picker reads
// row 0 as the TOP of the section (max Y) and col 0 as the LEFT (min X), and getInsertPoint()
// must agree — otherwise the dots and the geometry disagree about what "TopLeft" means.
import { describe, expect, it } from 'vitest';
import {
  INSERT_POSITIONS,
  insertPositionAt,
  insertPositionCell,
  type InsertPosition,
} from './insertPosition';
import { buildCrossSection } from './crossSectionBuilder';
import { getProfile } from '../profiles/euSteelProfiles';

describe('insert position grid', () => {
  it('is row-major with row 0 = Top and col 0 = Left', () => {
    expect(insertPositionAt(0, 0)).toBe('TopLeft');
    expect(insertPositionAt(0, 2)).toBe('TopRight');
    expect(insertPositionAt(1, 1)).toBe('CenterCenter');
    expect(insertPositionAt(2, 0)).toBe('BottomLeft');
    expect(insertPositionAt(2, 2)).toBe('BottomRight');
  });

  it('cell ↔ position round-trips for all nine anchors', () => {
    for (const position of INSERT_POSITIONS) {
      const { row, col } = insertPositionCell(position);
      expect(insertPositionAt(row, col)).toBe(position);
    }
  });

  it('clamps out-of-range cells, so arrow keys stop at the edges instead of wrapping', () => {
    expect(insertPositionAt(-1, 1)).toBe('TopCenter'); // up from the top row stays on it
    expect(insertPositionAt(3, 1)).toBe('BottomCenter');
    expect(insertPositionAt(1, -1)).toBe('CenterLeft');
    expect(insertPositionAt(1, 3)).toBe('CenterRight');
  });

  it('reads an unknown persisted anchor as the centre rather than throwing', () => {
    // A hand-edited document: the resolver already falls back to the centre (getInsertPoint's
    // default arm), so the picker must stay renderable on the same value.
    expect(insertPositionCell('Nonsense' as InsertPosition)).toEqual({ row: 1, col: 1 });
  });

  /**
   * The grid's meaning must match the geometry's. For every anchor, the cell the picker draws the
   * dot in has to land on the same bbox corner/edge getInsertPoint() anchors the section by —
   * this is the one test that would catch a Y-flip creeping into either side.
   */
  it('every cell agrees with getInsertPoint on the section bounding box', () => {
    const section = buildCrossSection(getProfile('IPE300')!.shape);
    const box = section.boundingBox;
    const xs = [box.min.x, box.center.x, box.max.x];
    const ys = [box.max.y, box.center.y, box.min.y]; // row 0 = TOP = max Y

    for (const position of INSERT_POSITIONS) {
      const { row, col } = insertPositionCell(position);
      const point = section.getInsertPoint(position);
      expect(point.x).toBeCloseTo(xs[col], 9);
      expect(point.y).toBeCloseTo(ys[row], 9);
    }
  });
});
