// Insert position names are persisted verbatim in documents, so keep them stable.
export type InsertPosition =
  | 'TopLeft'
  | 'TopCenter'
  | 'TopRight'
  | 'CenterLeft'
  | 'CenterCenter'
  | 'CenterRight'
  | 'BottomLeft'
  | 'BottomCenter'
  | 'BottomRight';

/**
 * ROW-MAJOR, and deliberately so: this is the reading order of the 3×3 anchor grid the UI draws
 * over the section (row 0 = Top = max Y, col 0 = Left = min X), so `INSERT_POSITIONS[row*3+col]`
 * IS the grid. insertPositionCell/insertPositionAt below are the only sanctioned way to rely on
 * that — they keep the index arithmetic in one tested place instead of scattered through widgets.
 */
export const INSERT_POSITIONS: InsertPosition[] = [
  'TopLeft',
  'TopCenter',
  'TopRight',
  'CenterLeft',
  'CenterCenter',
  'CenterRight',
  'BottomLeft',
  'BottomCenter',
  'BottomRight',
];

/** A cell of the 3×3 anchor grid. row 0 = Top (max Y) … 2 = Bottom; col 0 = Left (min X) … 2 = Right. */
export interface InsertCell {
  row: 0 | 1 | 2;
  col: 0 | 1 | 2;
}

/** Where an anchor sits in the 3×3 grid — the picker's dot placement and arrow-key navigation. */
export function insertPositionCell(position: InsertPosition): InsertCell {
  const i = INSERT_POSITIONS.indexOf(position);
  // An unknown string (a hand-edited document) reads as the centre rather than throwing: the
  // resolver already treats anything it doesn't recognise as CenterCenter (getInsertPoint's
  // default arm), and the picker must stay renderable for whatever the document holds.
  if (i < 0) return { row: 1, col: 1 };
  return { row: ((i / 3) | 0) as 0 | 1 | 2, col: (i % 3) as 0 | 1 | 2 };
}

/** The anchor at a grid cell — out-of-range rows/cols clamp, so arrow keys stop at the edges. */
export function insertPositionAt(row: number, col: number): InsertPosition {
  const clamp = (n: number): number => (n < 0 ? 0 : n > 2 ? 2 : Math.trunc(n));
  return INSERT_POSITIONS[clamp(row) * 3 + clamp(col)];
}
