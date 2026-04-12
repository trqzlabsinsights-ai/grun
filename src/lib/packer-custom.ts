// ── Custom Shape Packer — Regular Polygon Stickers (Mixed Gang Run) ────────
//
// Architecture: Multiple projects of the SAME polygon type (e.g., all pentagons)
// share a single sheet. Each project occupies a rectangular block on the sheet,
// and within that block, polygons tessellate using the optimized pattern.
//
// Different polygon types are NEVER mixed on one sheet. This is the gang run
// concept — sharing a sheet among different-sized projects of the same shape
// to maximize material utilization.
//
// Packing strategies per polygon type:
//   3 sides (triangle)  → "alternate-col" ▲▼ alternating columns
//   4 sides (diamond)   → "honeycomb" offset rows
//   5 sides (pentagon)  → "double-lattice" 180° rotation + offset
//   6 sides (hexagon)   → "honeycomb" perfect tessellation
//   7+ sides            → "double-lattice" 180° rotation + offset
//
// The allocation search finds optimal outs-per-project that minimizes total
// sheets (run length), then MaxRect 2D bin packing places rectangular blocks
// for each project on the shared sheet.

import type { GroupShape, PlacedGroup, AllocationEntry, PlateResult, TwoPlateResult, PlateSuggestion } from "./types";

// ── Types ──────────────────────────────────────────────────────────────────

export interface Point {
  x: number;
  y: number;
}

/** Tessellation style determines how shapes interlock */
export type TessStyle = "alternate-col" | "honeycomb" | "double-lattice";

export interface CustomProject {
  name: string;
  quantity: number;
  stickerWidth: number;   // bounding box width (inches)
  stickerHeight: number;  // bounding box height (inches)
}

/** Individual tessellation position for a shape within a group */
export interface TessPosition {
  x: number;      // top-left x of this shape's bounding box
  y: number;      // top-left y of this shape's bounding box
  flip: boolean;  // true = use flipVertices (180° rotated)
}

export interface CustomCalculateResponse {
  capacity: { maxPerSheet: number; sheetWidth: number; sheetHeight: number };
  singlePlateResult: PlateResult | null;
  twoPlateResult: TwoPlateResult | null;
  plateSuggestions: PlateSuggestion[];
  error?: string;
}

// ── Regular Polygon Generation ──────────────────────────────────────────────

/** Generate vertices for a regular polygon with n sides, normalized (0,0)-(1,1) */
export function generateRegularPolygon(sides: number): Point[] {
  if (sides < 3) sides = 3;
  const vertices: Point[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = (2 * Math.PI * i) / sides - Math.PI / 2;
    vertices.push({
      x: 0.5 + 0.5 * Math.cos(angle),
      y: 0.5 + 0.5 * Math.sin(angle),
    });
  }
  return vertices;
}

/** Generate 180° rotated vertices for double-lattice packing */
export function generateFlipPolygon(sides: number): Point[] {
  if (sides < 3) sides = 3;
  const vertices: Point[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = (2 * Math.PI * i) / sides - Math.PI / 2;
    vertices.push({
      x: 0.5 - 0.5 * Math.cos(angle),
      y: 0.5 - 0.5 * Math.sin(angle),
    });
  }
  return vertices;
}

/** Triangle ▲ up — fills FULL bounding box for tight tessellation */
function triangleUp(): Point[] {
  return [{ x: 0.5, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
}

/** Triangle ▼ down — fills FULL bounding box for tight tessellation */
function triangleDown(): Point[] {
  return [{ x: 0.5, y: 1 }, { x: 1, y: 0 }, { x: 0, y: 0 }];
}

/** Get polygon icon character */
export function getPolygonIcon(sides: number): string {
  switch (sides) {
    case 3: return "▲";
    case 4: return "◆";
    case 5: return "⬠";
    case 6: return "⬡";
    case 8: return "⯃";
    default: return `${sides}`;
  }
}

/** Get polygon display name */
export function getPolygonName(sides: number): string {
  const names: Record<number, string> = {
    3: "Triangle", 4: "Diamond", 5: "Pentagon", 6: "Hexagon",
    7: "Heptagon", 8: "Octagon", 9: "Nonagon", 10: "Decagon", 12: "Dodecagon",
  };
  return names[sides] || `${sides}-gon`;
}

// ── Polygon Geometry for Optimized Packing ────────────────────────────────

function actualPolygonDims(
  sides: number, bbW: number, bbH: number
): { width: number; height: number } {
  if (sides === 3 || sides === 4 || sides === 6) {
    return { width: bbW, height: bbH };
  }
  let R: number;
  if (sides % 2 === 1) {
    const R_fromH = bbH / (1 + Math.cos(Math.PI / sides));
    const R_fromW = bbW / (2 * Math.sin(2 * Math.PI / sides));
    R = Math.min(R_fromH, R_fromW);
    const actualW = 2 * R * Math.sin(2 * Math.PI / sides);
    const actualH = R * (1 + Math.cos(Math.PI / sides));
    return { width: actualW, height: actualH };
  } else {
    const R_fromH = bbH / (2 * Math.cos(Math.PI / sides));
    const R_fromW = bbW / 2;
    R = Math.min(R_fromH, R_fromW);
    const actualW = Math.min(2 * R, bbW);
    const actualH = 2 * R * Math.cos(Math.PI / sides);
    return { width: actualW, height: actualH };
  }
}

function effectiveCellDims(
  sides: number, bbW: number, bbH: number, bleedIn: number
): { cellW: number; cellH: number } {
  if (sides === 3 || sides === 4 || sides === 6) {
    return { cellW: bbW + 2 * bleedIn, cellH: bbH + 2 * bleedIn };
  }
  const actual = actualPolygonDims(sides, bbW, bbH);
  return { cellW: actual.width + 2 * bleedIn, cellH: actual.height + 2 * bleedIn };
}

// ── Tessellation Parameters Per Polygon Type ──────────────────────────────

export function getTessStyle(sides: number): TessStyle {
  if (sides === 3) return "alternate-col";
  if (sides === 4 || sides === 6) return "honeycomb";
  return "double-lattice";
}

function getRowHeightFactor(sides: number): number {
  switch (sides) {
    case 3: return 1.0;
    case 4: return Math.SQRT2 / 2;
    case 5: return 0.89;
    case 6: return Math.sqrt(3) / 2;
    case 7: return 0.88;
    case 8: return 0.91;
    case 9: return 0.92;
    case 10: return 0.92;
    default: return 0.93;
  }
}

function getHOffsetFactor(sides: number): number {
  switch (sides) {
    case 3: return 0;
    case 4: return 0.5;
    case 5: return 0.30;
    case 6: return 0.5;
    case 7: return 0.35;
    case 8: return 0.42;
    case 9: return 0.45;
    case 10: return 0.47;
    default: return 0.48;
  }
}

function getFlipOddRows(sides: number): boolean {
  if (sides === 3) return true;
  if (sides === 6) return false;
  return true;
}

export function isTessellated(_sides: number): boolean {
  return true;
}

function getPolygonVertices(sides: number): Point[] {
  if (sides === 3) return triangleUp();
  return generateRegularPolygon(sides);
}

function getPolygonFlipVertices(sides: number): Point[] {
  if (sides === 3) return triangleDown();
  return generateFlipPolygon(sides);
}

// ── PRESET_SHAPES (legacy compat) ─────────────────────────────────────────

export const PRESET_SHAPES: Record<string, {
  label: string; vertices: Point[]; flipVertices: Point[];
  icon: string; tessellated: boolean; tessStyle: TessStyle;
}> = {
  triangle: { label: "Triangle", icon: "▲", tessellated: true, tessStyle: "alternate-col", vertices: triangleUp(), flipVertices: triangleDown() },
  diamond: { label: "Diamond", icon: "◆", tessellated: true, tessStyle: "honeycomb", vertices: generateRegularPolygon(4), flipVertices: generateFlipPolygon(4) },
  pentagon: { label: "Pentagon", icon: "⬠", tessellated: true, tessStyle: "double-lattice", vertices: generateRegularPolygon(5), flipVertices: generateFlipPolygon(5) },
  hexagon: { label: "Hexagon", icon: "⬡", tessellated: true, tessStyle: "honeycomb", vertices: generateRegularPolygon(6), flipVertices: generateFlipPolygon(6) },
  heptagon: { label: "Heptagon", icon: "7", tessellated: true, tessStyle: "double-lattice", vertices: generateRegularPolygon(7), flipVertices: generateFlipPolygon(7) },
  octagon: { label: "Octagon", icon: "⯃", tessellated: true, tessStyle: "double-lattice", vertices: generateRegularPolygon(8), flipVertices: generateFlipPolygon(8) },
};

// ── Capacity Calculation (Full Sheet) ──────────────────────────────────────

export function tessCapacity(
  sheetW: number,
  sheetH: number,
  shapeW: number,
  shapeH: number,
  bleedIn: number,
  sides: number
): number {
  const style = getTessStyle(sides);
  const { cellW, cellH } = effectiveCellDims(sides, shapeW, shapeH, bleedIn);

  if (style === "alternate-col") {
    const step = cellW / 2 + bleedIn;
    let count = 0;
    let y = bleedIn;
    while (y + shapeH <= sheetH - bleedIn + 0.001) {
      let x = bleedIn;
      while (x + shapeW <= sheetW - bleedIn + 0.001) {
        count++;
        x += step;
      }
      y += cellH;
    }
    return count;
  }

  const rowHFactor = getRowHeightFactor(sides);
  const rowH = cellH * rowHFactor;
  const hOff = cellW * getHOffsetFactor(sides);
  const actual = actualPolygonDims(sides, shapeW, shapeH);
  const checkW = (sides === 3 || sides === 4 || sides === 6) ? shapeW : actual.width;
  const checkH = (sides === 3 || sides === 4 || sides === 6) ? shapeH : actual.height;

  let count = 0;
  let row = 0;
  let y = bleedIn;
  while (y + checkH <= sheetH - bleedIn + 0.001) {
    const offset = row % 2 === 1 ? hOff : 0;
    let x = bleedIn + offset;
    while (x + checkW <= sheetW - bleedIn + 0.001) {
      count++;
      x += cellW;
    }
    y += rowH;
    row++;
  }
  return count;
}

/**
 * Get the grid dimensions (cols × rows) for the tessellation layout.
 * Used for display in the allocation table.
 */
function tessGridDimensions(
  sheetW: number,
  sheetH: number,
  shapeW: number,
  shapeH: number,
  bleedIn: number,
  sides: number
): GroupShape {
  const style = getTessStyle(sides);
  const { cellW, cellH } = effectiveCellDims(sides, shapeW, shapeH, bleedIn);

  if (style === "alternate-col") {
    const step = cellW / 2 + bleedIn;
    let maxCols = 0;
    let rows = 0;
    let y = bleedIn;
    while (y + shapeH <= sheetH - bleedIn + 0.001) {
      let cols = 0;
      let x = bleedIn;
      while (x + shapeW <= sheetW - bleedIn + 0.001) {
        cols++;
        x += step;
      }
      maxCols = Math.max(maxCols, cols);
      y += cellH;
      rows++;
    }
    return { w: maxCols, h: rows };
  }

  const rowH = cellH * getRowHeightFactor(sides);
  const hOff = cellW * getHOffsetFactor(sides);
  const actual = actualPolygonDims(sides, shapeW, shapeH);
  const checkW = (sides === 3 || sides === 4 || sides === 6) ? shapeW : actual.width;
  const checkH = (sides === 3 || sides === 4 || sides === 6) ? shapeH : actual.height;

  let maxCols = 0;
  let rows = 0;
  let row = 0;
  let y = bleedIn;
  while (y + checkH <= sheetH - bleedIn + 0.001) {
    const offset = row % 2 === 1 ? hOff : 0;
    let cols = 0;
    let x = bleedIn + offset;
    while (x + checkW <= sheetW - bleedIn + 0.001) {
      cols++;
      x += cellW;
    }
    maxCols = Math.max(maxCols, cols);
    y += rowH;
    row++;
    rows++;
  }
  return { w: maxCols, h: rows };
}

// ── Block Dimensions ──────────────────────────────────────────────────────
//
// A "block" is a rectangular region containing a tessellation of one project's
// polygons. For gang run, multiple blocks share a sheet via MaxRect packing.

/** Compute the bounding box of a tessellation block with given cols × rows */
function polygonBlockDimensions(
  sides: number,
  shapeW: number,
  shapeH: number,
  bleedIn: number,
  cols: number,
  rows: number
): { width: number; height: number } {
  const style = getTessStyle(sides);
  const { cellW, cellH } = effectiveCellDims(sides, shapeW, shapeH, bleedIn);

  if (style === "alternate-col") {
    const step = cellW / 2 + bleedIn;
    const width = 2 * bleedIn + (cols - 1) * step + shapeW;
    const height = 2 * bleedIn + (rows - 1) * cellH + shapeH;
    return { width, height };
  }

  // honeycomb / double-lattice
  const rowHFactor = getRowHeightFactor(sides);
  const rowH = cellH * rowHFactor;
  const hOff = cellW * getHOffsetFactor(sides);
  const actual = actualPolygonDims(sides, shapeW, shapeH);
  const checkW = (sides === 3 || sides === 4 || sides === 6) ? shapeW : actual.width;
  const checkH = (sides === 3 || sides === 4 || sides === 6) ? shapeH : actual.height;

  // Odd rows are shifted by hOff, so block width must accommodate that
  const width = 2 * bleedIn + hOff + (cols - 1) * cellW + checkW;
  const height = 2 * bleedIn + (rows - 1) * rowH + checkH;
  return { width, height };
}

/** Count the actual number of items that fit in a block of given dimensions */
function blockCapacity(
  blockW: number,
  blockH: number,
  sides: number,
  shapeW: number,
  shapeH: number,
  bleedIn: number
): number {
  const style = getTessStyle(sides);
  const { cellW, cellH } = effectiveCellDims(sides, shapeW, shapeH, bleedIn);

  if (style === "alternate-col") {
    const step = cellW / 2 + bleedIn;
    let count = 0;
    let y = bleedIn;
    while (y + shapeH <= blockH - bleedIn + 0.001) {
      let x = bleedIn;
      while (x + shapeW <= blockW - bleedIn + 0.001) {
        count++;
        x += step;
      }
      y += cellH;
    }
    return count;
  }

  const rowHFactor = getRowHeightFactor(sides);
  const rowH = cellH * rowHFactor;
  const hOff = cellW * getHOffsetFactor(sides);
  const actual = actualPolygonDims(sides, shapeW, shapeH);
  const checkW = (sides === 3 || sides === 4 || sides === 6) ? shapeW : actual.width;
  const checkH = (sides === 3 || sides === 4 || sides === 6) ? shapeH : actual.height;

  let count = 0;
  let row = 0;
  let y = bleedIn;
  while (y + checkH <= blockH - bleedIn + 0.001) {
    const offset = row % 2 === 1 ? hOff : 0;
    let x = bleedIn + offset;
    while (x + checkW <= blockW - bleedIn + 0.001) {
      count++;
      x += cellW;
    }
    y += rowH;
    row++;
  }
  return count;
}

/** Enumerate possible block shapes (cols × rows) for a target outs count */
function getPolygonBlockShapes(
  outs: number,
  sides: number,
  shapeW: number,
  shapeH: number,
  bleedIn: number
): Array<{ cols: number; rows: number; capacity: number; width: number; height: number }> {
  const shapes: Array<{ cols: number; rows: number; capacity: number; width: number; height: number }> = [];

  for (let rows = 1; rows <= outs; rows++) {
    const cols = Math.ceil(outs / rows);
    const capacity = cols * rows;
    if (capacity < outs) continue;

    const dims = polygonBlockDimensions(sides, shapeW, shapeH, bleedIn, cols, rows);
    shapes.push({ cols, rows, capacity, width: dims.width, height: dims.height });
  }

  // Also try wider layouts (more cols, fewer rows)
  for (let cols = 1; cols <= outs; cols++) {
    const rows = Math.ceil(outs / cols);
    const capacity = cols * rows;
    if (capacity < outs) continue;

    const dims = polygonBlockDimensions(sides, shapeW, shapeH, bleedIn, cols, rows);
    // Avoid duplicates
    if (!shapes.some(s => s.cols === cols && s.rows === rows)) {
      shapes.push({ cols, rows, capacity, width: dims.width, height: dims.height });
    }
  }

  // Sort by area ascending (compact blocks first), then by aspect ratio
  shapes.sort((a, b) => {
    const areaA = a.width * a.height;
    const areaB = b.width * b.height;
    if (Math.abs(areaA - areaB) > 0.01) return areaA - areaB;
    const ratioA = Math.max(a.width, a.height) / Math.min(a.width, a.height);
    const ratioB = Math.max(b.width, b.height) / Math.min(b.width, b.height);
    return ratioA - ratioB;
  });

  return shapes;
}

// ── Tessellation Position Generation ──────────────────────────────────────

/** Generate tessellation positions within a full sheet */
export function tessSheetPositions(
  sheetW: number,
  sheetH: number,
  shapeW: number,
  shapeH: number,
  bleedIn: number,
  sides: number
): TessPosition[] {
  const style = getTessStyle(sides);
  const { cellW, cellH } = effectiveCellDims(sides, shapeW, shapeH, bleedIn);
  const positions: TessPosition[] = [];
  const flipOdd = getFlipOddRows(sides);

  if (style === "alternate-col") {
    const step = cellW / 2 + bleedIn;
    let row = 0;
    let y = bleedIn;
    while (y + shapeH <= sheetH - bleedIn + 0.001) {
      let col = 0;
      let x = bleedIn;
      while (x + shapeW <= sheetW - bleedIn + 0.001) {
        positions.push({ x, y, flip: col % 2 === 1 });
        x += step;
        col++;
      }
      y += cellH;
      row++;
    }
    return positions;
  }

  const rowHFactor = getRowHeightFactor(sides);
  const rowH = cellH * rowHFactor;
  const hOff = cellW * getHOffsetFactor(sides);
  const actual = actualPolygonDims(sides, shapeW, shapeH);
  const checkW = (sides === 3 || sides === 4 || sides === 6) ? shapeW : actual.width;
  const checkH = (sides === 3 || sides === 4 || sides === 6) ? shapeH : actual.height;

  let row = 0;
  let y = bleedIn;
  while (y + checkH <= sheetH - bleedIn + 0.001) {
    const isOddRow = row % 2 === 1;
    const offset = isOddRow ? hOff : 0;
    let x = bleedIn + offset;
    while (x + checkW <= sheetW - bleedIn + 0.001) {
      positions.push({ x, y, flip: flipOdd && isOddRow });
      x += cellW;
    }
    y += rowH;
    row++;
  }
  return positions;
}

/** Generate tessellation positions within a placed block on the sheet */
function tessBlockPositions(
  blockX: number,
  blockY: number,
  blockW: number,
  blockH: number,
  sides: number,
  shapeW: number,
  shapeH: number,
  bleedIn: number
): TessPosition[] {
  const style = getTessStyle(sides);
  const { cellW, cellH } = effectiveCellDims(sides, shapeW, shapeH, bleedIn);
  const positions: TessPosition[] = [];
  const flipOdd = getFlipOddRows(sides);

  if (style === "alternate-col") {
    const step = cellW / 2 + bleedIn;
    let row = 0;
    let y = blockY + bleedIn;
    while (y + shapeH <= blockY + blockH - bleedIn + 0.001) {
      let col = 0;
      let x = blockX + bleedIn;
      while (x + shapeW <= blockX + blockW - bleedIn + 0.001) {
        positions.push({ x, y, flip: col % 2 === 1 });
        x += step;
        col++;
      }
      y += cellH;
      row++;
    }
    return positions;
  }

  const rowHFactor = getRowHeightFactor(sides);
  const rowH = cellH * rowHFactor;
  const hOff = cellW * getHOffsetFactor(sides);
  const actual = actualPolygonDims(sides, shapeW, shapeH);
  const checkW = (sides === 3 || sides === 4 || sides === 6) ? shapeW : actual.width;
  const checkH = (sides === 3 || sides === 4 || sides === 6) ? shapeH : actual.height;

  let row = 0;
  let y = blockY + bleedIn;
  while (y + checkH <= blockY + blockH - bleedIn + 0.001) {
    const isOddRow = row % 2 === 1;
    const offset = isOddRow ? hOff : 0;
    let x = blockX + bleedIn + offset;
    while (x + checkW <= blockX + blockW - bleedIn + 0.001) {
      positions.push({ x, y, flip: flipOdd && isOddRow });
      x += cellW;
    }
    y += rowH;
    row++;
  }
  return positions;
}

// ── MaxRect 2D Bin Packing ────────────────────────────────────────────────

interface MaxRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface BlockToPlace {
  projectIdx: number;
  name: string;
  sides: number;
  stickerWidth: number;
  stickerHeight: number;
  cols: number;
  rows: number;
  outs: number;       // actual capacity of this block
  blockWidth: number;
  blockHeight: number;
}

interface PlacedBlock {
  projectIdx: number;
  name: string;
  sides: number;
  stickerWidth: number;
  stickerHeight: number;
  cols: number;
  rows: number;
  outs: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

function maxRectPackBlocks(
  blocks: BlockToPlace[],
  sheetW: number,
  sheetH: number
): PlacedBlock[] | null {
  const orderings: BlockToPlace[][] = [
    [...blocks].sort((a, b) => b.blockHeight - a.blockHeight),
    [...blocks].sort((a, b) => b.blockWidth - a.blockWidth),
    [...blocks].sort((a, b) => (b.blockWidth * b.blockHeight) - (a.blockWidth * a.blockHeight)),
    [...blocks].sort((a, b) => a.blockHeight - b.blockHeight),
    [...blocks].sort((a, b) => {
      if (b.blockHeight !== a.blockHeight) return b.blockHeight - a.blockHeight;
      return b.blockWidth - a.blockWidth;
    }),
  ];

  for (const ordered of orderings) {
    const result = maxRectPackOneOrder(ordered, sheetW, sheetH);
    if (result) return result;
  }
  return null;
}

function maxRectPackOneOrder(
  blocks: BlockToPlace[],
  sheetW: number,
  sheetH: number
): PlacedBlock[] | null {
  let freeRects: MaxRect[] = [{ x: 0, y: 0, width: sheetW, height: sheetH }];
  const placed: PlacedBlock[] = [];

  for (const block of blocks) {
    const result = findBestFreeRect(freeRects, block.blockWidth, block.blockHeight, sheetW, sheetH);
    if (!result) return null;

    if (result.x + block.blockWidth > sheetW + 0.001 || result.y + block.blockHeight > sheetH + 0.001) return null;

    placed.push({
      projectIdx: block.projectIdx,
      name: block.name,
      sides: block.sides,
      stickerWidth: block.stickerWidth,
      stickerHeight: block.stickerHeight,
      cols: block.cols,
      rows: block.rows,
      outs: block.outs,
      x: result.x,
      y: result.y,
      width: block.blockWidth,
      height: block.blockHeight,
    });

    freeRects = splitFreeRects(freeRects, result.x, result.y, block.blockWidth, block.blockHeight);
    freeRects = pruneFreeRects(freeRects);
  }

  return placed;
}

function findBestFreeRect(
  freeRects: MaxRect[],
  rectW: number,
  rectH: number,
  _sheetW: number,
  _sheetH: number
): { x: number; y: number } | null {
  let bestScore = Infinity;
  let bestRect: { x: number; y: number } | null = null;

  for (const fr of freeRects) {
    if (rectW <= fr.width + 0.001 && rectH <= fr.height + 0.001) {
      const shortSideFit = Math.min(fr.width - rectW, fr.height - rectH);
      if (shortSideFit < bestScore) {
        bestScore = shortSideFit;
        bestRect = { x: fr.x, y: fr.y };
      }
    }
  }

  return bestRect;
}

function splitFreeRects(
  freeRects: MaxRect[],
  placedX: number,
  placedY: number,
  placedW: number,
  placedH: number
): MaxRect[] {
  const result: MaxRect[] = [];
  for (const fr of freeRects) {
    if (
      placedX >= fr.x + fr.width ||
      placedX + placedW <= fr.x ||
      placedY >= fr.y + fr.height ||
      placedY + placedH <= fr.y
    ) {
      result.push(fr);
      continue;
    }
    if (placedX > fr.x) {
      result.push({ x: fr.x, y: fr.y, width: placedX - fr.x, height: fr.height });
    }
    if (placedX + placedW < fr.x + fr.width) {
      result.push({ x: placedX + placedW, y: fr.y, width: fr.x + fr.width - placedX - placedW, height: fr.height });
    }
    if (placedY > fr.y) {
      result.push({ x: fr.x, y: fr.y, width: fr.width, height: placedY - fr.y });
    }
    if (placedY + placedH < fr.y + fr.height) {
      result.push({ x: fr.x, y: placedY + placedH, width: fr.width, height: fr.y + fr.height - placedY - placedH });
    }
  }
  return result;
}

function pruneFreeRects(freeRects: MaxRect[]): MaxRect[] {
  const result: MaxRect[] = [];
  for (let i = 0; i < freeRects.length; i++) {
    let contained = false;
    for (let j = 0; j < freeRects.length; j++) {
      if (i === j) continue;
      if (
        freeRects[i].x >= freeRects[j].x - 0.001 &&
        freeRects[i].y >= freeRects[j].y - 0.001 &&
        freeRects[i].x + freeRects[i].width <= freeRects[j].x + freeRects[j].width + 0.001 &&
        freeRects[i].y + freeRects[i].height <= freeRects[j].y + freeRects[j].height + 0.001
      ) {
        contained = true;
        break;
      }
    }
    if (!contained) result.push(freeRects[i]);
  }
  return result;
}

// ── Allocation Search ──────────────────────────────────────────────────────

interface AllocationWithPacking {
  allocation: number[];      // outs per project per sheet
  runLength: number;
  blocks: PlacedBlock[];
}

/**
 * Find the best allocation of outs per project that:
 * 1. Fits all project blocks on one sheet (MaxRect packing)
 * 2. Minimizes total run length (sheets printed)
 *
 * Strategy: Search over run lengths L from 1 upward. For each L, compute
 * the balanced allocation outs_i = ceil(demand_i / L), then try to pack
 * the blocks. The first L where packing succeeds is optimal.
 * Also try "boosted" allocations (giving extra outs) to find better fits.
 */
function findBestAllocationWithPacking(
  projects: CustomProject[],
  sides: number,
  sheetW: number,
  sheetH: number,
  bleedIn: number
): AllocationWithPacking | null {
  const n = projects.length;
  if (n === 0) return null;

  // Per-project maximum outs on a full sheet
  const perProjectMax: number[] = projects.map((p) =>
    tessCapacity(sheetW, sheetH, p.stickerWidth, p.stickerHeight, bleedIn, sides)
  );

  // Check that each project can fit at least 1 item
  for (let i = 0; i < n; i++) {
    if (perProjectMax[i] < 1) return null;
  }

  const demands = projects.map((p) => p.quantity);
  const maxDemand = Math.max(...demands);

  // Search over run lengths from 1 upward
  for (let L = 1; L <= maxDemand; L++) {
    // Compute balanced allocation for this run length
    const baseAllocation = demands.map((d, i) =>
      Math.max(1, Math.ceil(d / L))
    );

    // Check feasibility: each allocation must not exceed max capacity
    let feasible = true;
    for (let i = 0; i < n; i++) {
      if (baseAllocation[i] > perProjectMax[i]) {
        feasible = false;
        break;
      }
    }
    if (!feasible) continue;

    // Try the base allocation first
    const basePacking = tryPackAllocation(baseAllocation, projects, sides, sheetW, sheetH, bleedIn);
    if (basePacking) {
      return {
        allocation: baseAllocation,
        runLength: L,
        blocks: basePacking,
      };
    }

    // Try boosted allocations: give each project +1 extra outs
    // This can help when a slightly larger block fits better
    for (let boostIdx = 0; boostIdx < n; boostIdx++) {
      const boosted = [...baseAllocation];
      boosted[boostIdx] = Math.min(perProjectMax[boostIdx], boosted[boostIdx] + 1);
      const packing = tryPackAllocation(boosted, projects, sides, sheetW, sheetH, bleedIn);
      if (packing) {
        return {
          allocation: boosted,
          runLength: L,
          blocks: packing,
        };
      }
    }

    // Try giving each project +2 extra outs (to fill block shapes better)
    for (let boostIdx = 0; boostIdx < n; boostIdx++) {
      const boosted = [...baseAllocation];
      boosted[boostIdx] = Math.min(perProjectMax[boostIdx], boosted[boostIdx] + 2);
      const packing = tryPackAllocation(boosted, projects, sides, sheetW, sheetH, bleedIn);
      if (packing) {
        return {
          allocation: boosted,
          runLength: L,
          blocks: packing,
        };
      }
    }
  }

  return null;
}

/** Try to pack blocks for a given allocation onto one sheet */
function tryPackAllocation(
  allocation: number[],
  projects: CustomProject[],
  sides: number,
  sheetW: number,
  sheetH: number,
  bleedIn: number
): PlacedBlock[] | null {
  const n = allocation.length;

  // Special case: single project — block fills entire sheet
  if (n === 1) {
    const outs = allocation[0];
    const p = projects[0];
    const cap = tessCapacity(sheetW, sheetH, p.stickerWidth, p.stickerHeight, bleedIn, sides);
    if (cap < outs) return null;

    // Use full sheet as block
    const gridShape = tessGridDimensions(sheetW, sheetH, p.stickerWidth, p.stickerHeight, bleedIn, sides);
    return [{
      projectIdx: 0,
      name: p.name,
      sides,
      stickerWidth: p.stickerWidth,
      stickerHeight: p.stickerHeight,
      cols: gridShape.w,
      rows: gridShape.h,
      outs: cap,
      x: 0,
      y: 0,
      width: sheetW,
      height: sheetH,
    }];
  }

  const allBlockShapes = allocation.map((outs, i) =>
    getPolygonBlockShapes(outs, sides, projects[i].stickerWidth, projects[i].stickerHeight, bleedIn)
  );

  let attempts = 0;
  const maxAttempts = 200;

  function tryCombo(
    idx: number,
    currentBlocks: BlockToPlace[]
  ): PlacedBlock[] | null {
    if (idx === n) {
      attempts++;
      if (attempts > maxAttempts) return null;

      // Pre-check: no single block exceeds sheet dimensions
      for (const b of currentBlocks) {
        if (b.blockWidth > sheetW + 0.001 || b.blockHeight > sheetH + 0.001) return null;
      }

      const placed = maxRectPackBlocks(currentBlocks, sheetW, sheetH);
      return placed;
    }

    // Try up to 8 best shapes per project (more options = better fit)
    const shapesToTry = allBlockShapes[idx].slice(0, 8);
    for (const shape of shapesToTry) {
      if (shape.width > sheetW + 0.001 || shape.height > sheetH + 0.001) continue;

      const block: BlockToPlace = {
        projectIdx: idx,
        name: projects[idx].name,
        sides,
        stickerWidth: projects[idx].stickerWidth,
        stickerHeight: projects[idx].stickerHeight,
        cols: shape.cols,
        rows: shape.rows,
        outs: shape.capacity,
        blockWidth: shape.width,
        blockHeight: shape.height,
      };

      currentBlocks.push(block);
      const result = tryCombo(idx + 1, currentBlocks);
      if (result) return result;
      currentBlocks.pop();

      if (attempts > maxAttempts) return null;
    }
    return null;
  }

  return tryCombo(0, []);
}

// ── Polygon Area for Material Yield ────────────────────────────────────────

function polygonArea(sides: number, bbW: number, bbH: number): number {
  if (sides === 3) return 0.5 * bbW * bbH;
  if (sides === 4) return 0.5 * bbW * bbH;

  let R: number;
  if (sides % 2 === 1) {
    const R_fromH = bbH / (1 + Math.cos(Math.PI / sides));
    const R_fromW = bbW / (2 * Math.sin(2 * Math.PI / sides));
    R = Math.min(R_fromH, R_fromW);
  } else {
    const R_fromH = bbH / (2 * Math.cos(Math.PI / sides));
    const R_fromW = bbW / 2;
    R = Math.min(R_fromH, R_fromW);
  }
  return (sides / 2) * R * R * Math.sin((2 * Math.PI) / sides);
}

// ── Build Plate Result from Packing ────────────────────────────────────────

function buildPlateResult(
  projects: CustomProject[],
  indices: number[],
  allocation: number[],
  runLength: number,
  sheetW: number,
  sheetH: number,
  bleedIn: number,
  sides: number,
  placedBlocks: PlacedBlock[]
): PlateResult {
  // Build placed groups with tessellation positions first
  // to get actual outs counts
  const placedGroups: PlacedGroup[] = placedBlocks.map((block) => {
    const projIdx = indices[block.projectIdx];

    // Generate tessellation positions within the block
    const tessPositions = tessBlockPositions(
      block.x, block.y, block.width, block.height,
      sides, block.stickerWidth, block.stickerHeight, bleedIn
    );

    // Actual outs = number of tessellation positions
    const actualOuts = tessPositions.length;

    return {
      name: projects[projIdx].name,
      projectIdx: projIdx,
      shape: { w: block.cols, h: block.rows },
      outs: actualOuts,
      x: block.x,
      y: block.y,
      width: block.width,
      height: block.height,
      stickerWidth: block.stickerWidth,
      stickerHeight: block.stickerHeight,
      sides,
      vertices: getPolygonVertices(sides),
      flipVertices: getPolygonFlipVertices(sides),
      tessellated: true,
      tessPositions,
      itemType: "custom" as const,
    };
  });

  // Build allocation entries using actual outs from placed groups
  let totalOrderQty = 0;
  const allocationEntries: AllocationEntry[] = indices.map((projIdx, i) => {
    const qty = projects[projIdx].quantity;
    const group = placedGroups.find(g => g.projectIdx === projIdx);
    const outs = group?.outs || allocation[i];
    const produced = outs * runLength;
    const overage = produced - qty;
    const overagePct = qty > 0 ? (overage / qty) * 100 : 0;
    totalOrderQty += qty;

    return {
      name: projects[projIdx].name,
      quantity: qty,
      outs,
      produced,
      overage,
      overagePct,
      groupShape: group?.shape || { w: 1, h: 1 },
      stickerWidth: projects[projIdx].stickerWidth,
      stickerHeight: projects[projIdx].stickerHeight,
      sides,
      tessellated: true,
    };
  });

  let totalProduced = 0;
  for (const entry of allocationEntries) {
    totalProduced += entry.produced;
  }

  // Material yield: actual polygon area / sheet area
  let totalUsedArea = 0;
  for (const entry of allocationEntries) {
    const area = polygonArea(sides, entry.stickerWidth || 0, entry.stickerHeight || 0);
    totalUsedArea += area * entry.produced;
  }
  const totalSheetArea = runLength * sheetW * sheetH;
  const materialYield = totalSheetArea > 0 ? (totalUsedArea / totalSheetArea) * 100 : 0;

  return {
    allocation: allocationEntries,
    runLength,
    totalSheets: runLength,
    totalProduced,
    totalOverage: totalProduced - totalOrderQty,
    materialYield,
    placedGroups,
  };
}

// ── Two-Plate Optimization ────────────────────────────────────────────────

function findBestTwoPlate(
  projects: CustomProject[],
  sides: number,
  sheetW: number,
  sheetH: number,
  bleedIn: number
): TwoPlateResult | null {
  const n = projects.length;
  if (n < 2) return null;

  let bestTotal = Infinity;
  let bestResult: TwoPlateResult | null = null;

  const totalMasks = 1 << n;
  for (let mask = 1; mask < totalMasks - 1; mask++) {
    if (!(mask & 1)) continue;

    const plate1Indices: number[] = [];
    const plate2Indices: number[] = [];
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) plate1Indices.push(i);
      else plate2Indices.push(i);
    }

    if (plate1Indices.length === 0 || plate2Indices.length === 0) continue;

    const p1Projects = plate1Indices.map(i => projects[i]);
    const p1Result = findBestAllocationWithPacking(p1Projects, sides, sheetW, sheetH, bleedIn);
    if (!p1Result) continue;

    const p2Projects = plate2Indices.map(i => projects[i]);
    const p2Result = findBestAllocationWithPacking(p2Projects, sides, sheetW, sheetH, bleedIn);
    if (!p2Result) continue;

    const totalSheets = p1Result.runLength + p2Result.runLength;
    if (totalSheets >= bestTotal) continue;

    bestTotal = totalSheets;

    const plate1Res = buildPlateResult(projects, plate1Indices, p1Result.allocation, p1Result.runLength, sheetW, sheetH, bleedIn, sides, p1Result.blocks);
    const plate2Res = buildPlateResult(projects, plate2Indices, p2Result.allocation, p2Result.runLength, sheetW, sheetH, bleedIn, sides, p2Result.blocks);

    const combinedProduced = plate1Res.totalProduced + plate2Res.totalProduced;
    const totalOrderQty = projects.reduce((s, p) => s + p.quantity, 0);

    let combinedUsedArea = 0;
    for (const a of [...plate1Res.allocation, ...plate2Res.allocation]) {
      combinedUsedArea += polygonArea(sides, a.stickerWidth || 0, a.stickerHeight || 0) * a.produced;
    }
    const combinedSheetArea = totalSheets * sheetW * sheetH;
    const combinedYield = combinedSheetArea > 0 ? (combinedUsedArea / combinedSheetArea) * 100 : 0;

    bestResult = {
      plate1: plate1Res,
      plate2: plate2Res,
      totalSheets,
      totalProduced: combinedProduced,
      totalOverage: combinedProduced - totalOrderQty,
      materialYield: combinedYield,
      sheetsSaved: 0,
      plate1ProjectIndices: plate1Indices,
      plate2ProjectIndices: plate2Indices,
    };
  }

  return bestResult;
}

// ── Main Calculation ───────────────────────────────────────────────────────

export function calculateCustom(req: {
  sheetWidth: number;
  sheetHeight: number;
  bleed: number;
  sides: number;
  projects: CustomProject[];
}): CustomCalculateResponse {
  const { sheetWidth, sheetHeight, bleed, sides: rawSides, projects: rawProjects } = req;
  const emptySuggestions: PlateSuggestion[] = [];

  if (!sheetWidth || !sheetHeight || bleed == null) {
    return {
      capacity: { maxPerSheet: 0, sheetWidth, sheetHeight },
      singlePlateResult: null, twoPlateResult: null, plateSuggestions: emptySuggestions,
      error: "Missing required dimension parameters.",
    };
  }

  const sides = Math.max(3, rawSides || 4);
  const projects = rawProjects.filter((p) => p.quantity > 0 && p.stickerWidth > 0 && p.stickerHeight > 0);

  if (projects.length === 0) {
    return {
      capacity: { maxPerSheet: 0, sheetWidth, sheetHeight },
      singlePlateResult: null, twoPlateResult: null, plateSuggestions: emptySuggestions,
      error: "No projects with positive quantities and valid sticker sizes.",
    };
  }

  const bleedIn = bleed / 25.4;

  // Check which projects can fit on the sheet
  const tooLargeProjects: string[] = [];
  for (const p of projects) {
    const cap = tessCapacity(sheetWidth, sheetHeight, p.stickerWidth, p.stickerHeight, bleedIn, sides);
    if (cap < 1) {
      tooLargeProjects.push(`"${p.name}" (${getPolygonName(sides)} ${p.stickerWidth}"×${p.stickerHeight}")`);
    }
  }
  if (tooLargeProjects.length > 0) {
    const suggestions: PlateSuggestion[] = [1, 2, 3, 4].map(k => ({ plateCount: k, feasible: false, totalSheets: 0, description: "Cannot fit" }));
    return {
      capacity: { maxPerSheet: 0, sheetWidth, sheetHeight },
      singlePlateResult: null, twoPlateResult: null, plateSuggestions: suggestions,
      error: `Projects too large for sheet: ${tooLargeProjects.join(", ")}. Try increasing sheet size or reducing sticker dimensions.`,
    };
  }

  // ── Single plate: all projects share one sheet (gang run) ────────────
  const allIndices = projects.map((_, i) => i);

  let singlePlateResult: PlateResult | null = null;
  const singleResult = findBestAllocationWithPacking(projects, sides, sheetWidth, sheetHeight, bleedIn);

  if (singleResult) {
    singlePlateResult = buildPlateResult(
      projects, allIndices, singleResult.allocation, singleResult.runLength,
      sheetWidth, sheetHeight, bleedIn, sides, singleResult.blocks
    );
  }

  // ── Two-plate optimization ───────────────────────────────────────────
  let twoPlateResult: TwoPlateResult | null = null;
  if (projects.length >= 2) {
    twoPlateResult = findBestTwoPlate(projects, sides, sheetWidth, sheetHeight, bleedIn);
  }

  if (twoPlateResult && singlePlateResult) {
    twoPlateResult.sheetsSaved = singlePlateResult.totalSheets - twoPlateResult.totalSheets;
  }

  // ── Capacity info ────────────────────────────────────────────────────
  const maxPerSheet = Math.max(...projects.map((p) =>
    tessCapacity(sheetWidth, sheetHeight, p.stickerWidth, p.stickerHeight, bleedIn, sides)
  ));

  // ── Plate suggestions ────────────────────────────────────────────────
  const plateSuggestions: PlateSuggestion[] = [];

  if (singlePlateResult) {
    plateSuggestions.push({
      plateCount: 1,
      feasible: true,
      totalSheets: singlePlateResult.totalSheets,
      description: `${singlePlateResult.totalSheets.toLocaleString()} ${singlePlateResult.totalSheets === 1 ? "sheet" : "sheets"} — all ${getPolygonName(sides)} projects gang-run`,
    });
  } else {
    plateSuggestions.push({
      plateCount: 1,
      feasible: false,
      totalSheets: 0,
      description: "Cannot fit all projects on one plate",
    });
  }

  if (twoPlateResult) {
    plateSuggestions.push({
      plateCount: 2,
      feasible: true,
      totalSheets: twoPlateResult.totalSheets,
      description: `${twoPlateResult.totalSheets.toLocaleString()} sheets (P1: ${twoPlateResult.plate1.runLength} | P2: ${twoPlateResult.plate2.runLength})`,
    });
  } else {
    plateSuggestions.push({
      plateCount: 2,
      feasible: false,
      totalSheets: 0,
      description: projects.length < 2 ? "Need at least 2 projects" : "Two-plate split not found",
    });
  }

  for (let k = 3; k <= 4; k++) {
    plateSuggestions.push({
      plateCount: k,
      feasible: singlePlateResult !== null,
      totalSheets: singlePlateResult?.totalSheets || 0,
      description: singlePlateResult ? "Same total sheets, separate plate setups" : "Cannot fit",
    });
  }

  return {
    capacity: { maxPerSheet, sheetWidth, sheetHeight },
    singlePlateResult,
    twoPlateResult,
    plateSuggestions,
  };
}
