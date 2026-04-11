// ── Custom Shape Packer — Self-Drawn Polygon Stickers ────────────────────────
// Supports two tessellation styles:
//   "alternate-col" — alternating ▲▼ within each row (triangles)
//   "hex-offset"    — hex-like offset rows (diamonds)
// Non-tessellating shapes use bounding-rect packing.

import {
  maxRectPack,
  type GroupWithDims,
} from "./gang-run-calculator-v2";

// ── Types ──────────────────────────────────────────────────────────────────

export interface Point {
  x: number;
  y: number;
}

/** Tessellation style determines how shapes interlock */
export type TessStyle = "alternate-col" | "hex-offset";

export interface CustomProject {
  name: string;
  quantity: number;
  stickerWidth: number;   // bounding box width (inches)
  stickerHeight: number;  // bounding box height (inches)
  shapeName: string;      // preset name or "custom"
  vertices: Point[];      // normalized 0-1 coordinates, scaled by stickerW×H
}

/** Individual tessellation position for a shape within a group */
export interface TessPosition {
  x: number;      // top-left x of this shape's bounding box
  y: number;      // top-left y of this shape's bounding box
  flip: boolean;  // true = use flipVertices (▼ inverted)
}

export interface PlacedCustomGroup {
  name: string;
  projectIdx: number;
  outs: number;
  x: number;
  y: number;
  width: number;
  height: number;
  stickerWidth: number;
  stickerHeight: number;
  shapeName: string;
  vertices: Point[];       // normalized 0-1 for "up" orientation
  flipVertices: Point[];   // normalized 0-1 for "down" orientation (tessellation)
  tessellated: boolean;    // true = tessellation packing
  itemType: "custom";
  /** For tessellated shapes: absolute positions of each individual shape */
  tessPositions?: TessPosition[];
  /** Group shape (w = columns, h = rows) */
  shape: { w: number; h: number };
}

export interface CustomAllocationEntry {
  name: string;
  quantity: number;
  outs: number;
  produced: number;
  overage: number;
  overagePct: number;
  groupShape: { w: number; h: number };
  stickerWidth: number;
  stickerHeight: number;
  shapeName: string;
  tessellated: boolean;
}

export interface CustomPlateResult {
  allocation: CustomAllocationEntry[];
  runLength: number;
  totalSheets: number;
  totalProduced: number;
  totalOverage: number;
  materialYield: number;
  placedGroups: PlacedCustomGroup[];
}

export interface CustomTwoPlateResult {
  plate1: CustomPlateResult;
  plate2: CustomPlateResult;
  totalSheets: number;
  totalProduced: number;
  totalOverage: number;
  materialYield: number;
  sheetsSaved: number;
  plate1ProjectIndices: number[];
  plate2ProjectIndices: number[];
}

export interface PlateSuggestion {
  plateCount: number;
  feasible: boolean;
  totalSheets: number;
  description: string;
}

export interface CustomCalculateResponse {
  capacity: { maxPerSheet: number; sheetWidth: number; sheetHeight: number };
  singlePlateResult: CustomPlateResult | null;
  twoPlateResult: CustomTwoPlateResult | null;
  plateSuggestions: PlateSuggestion[];
  error?: string;
}

// ── Preset Shapes ──────────────────────────────────────────────────────────
// All vertices are in normalized coordinates (0,0) to (1,1)
// tessellated: true means tessellation packing (each position = 1 sticker)
// tessStyle: "alternate-col" = ▲▼▲▼ within row; "hex-offset" = offset rows

export const PRESET_SHAPES: Record<string, { label: string; vertices: Point[]; flipVertices: Point[]; icon: string; tessellated: boolean; tessStyle: TessStyle }> = {
  star: {
    label: "Star",
    icon: "★",
    tessellated: false,
    tessStyle: "hex-offset",
    vertices: [
      { x: 0.5, y: 0 }, { x: 0.618, y: 0.382 }, { x: 1, y: 0.382 },
      { x: 0.691, y: 0.618 }, { x: 0.809, y: 1 }, { x: 0.5, y: 0.764 },
      { x: 0.191, y: 1 }, { x: 0.309, y: 0.618 }, { x: 0, y: 0.382 },
      { x: 0.382, y: 0.382 },
    ],
    flipVertices: [],
  },
  heart: {
    label: "Heart",
    icon: "♥",
    tessellated: false,
    tessStyle: "hex-offset",
    vertices: [
      { x: 0.5, y: 0.9 }, { x: 0.1, y: 0.5 }, { x: 0, y: 0.3 },
      { x: 0.05, y: 0.1 }, { x: 0.2, y: 0 }, { x: 0.35, y: 0.05 },
      { x: 0.5, y: 0.25 }, { x: 0.65, y: 0.05 }, { x: 0.8, y: 0 },
      { x: 0.95, y: 0.1 }, { x: 1, y: 0.3 }, { x: 0.9, y: 0.5 },
    ],
    flipVertices: [],
  },
  diamond: {
    label: "Diamond",
    icon: "◆",
    tessellated: true,
    tessStyle: "hex-offset", // hex tessellation — offset rows
    vertices: [
      { x: 0.5, y: 0 }, { x: 1, y: 0.5 }, { x: 0.5, y: 1 }, { x: 0, y: 0.5 },
    ],
    flipVertices: [], // diamonds don't need flip — same shape in all rows
  },
  hexagon: {
    label: "Hexagon",
    icon: "⬡",
    tessellated: false,
    tessStyle: "hex-offset",
    vertices: [
      { x: 0.25, y: 0 }, { x: 0.75, y: 0 }, { x: 1, y: 0.5 },
      { x: 0.75, y: 1 }, { x: 0.25, y: 1 }, { x: 0, y: 0.5 },
    ],
    flipVertices: [],
  },
  shield: {
    label: "Shield",
    icon: "🛡",
    tessellated: false,
    tessStyle: "hex-offset",
    vertices: [
      { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 0.55 },
      { x: 0.5, y: 1 }, { x: 0, y: 0.55 },
    ],
    flipVertices: [],
  },
  arrow: {
    label: "Arrow",
    icon: "▶",
    tessellated: false,
    tessStyle: "hex-offset",
    vertices: [
      { x: 0, y: 0.3 }, { x: 0.6, y: 0.3 }, { x: 0.6, y: 0 },
      { x: 1, y: 0.5 }, { x: 0.6, y: 1 }, { x: 0.6, y: 0.7 },
      { x: 0, y: 0.7 },
    ],
    flipVertices: [],
  },
  cross: {
    label: "Cross",
    icon: "✚",
    tessellated: false,
    tessStyle: "hex-offset",
    vertices: [
      { x: 0.35, y: 0 }, { x: 0.65, y: 0 }, { x: 0.65, y: 0.35 },
      { x: 1, y: 0.35 }, { x: 1, y: 0.65 }, { x: 0.65, y: 0.65 },
      { x: 0.65, y: 1 }, { x: 0.35, y: 1 }, { x: 0.35, y: 0.65 },
      { x: 0, y: 0.65 }, { x: 0, y: 0.35 }, { x: 0.35, y: 0.35 },
    ],
    flipVertices: [],
  },
  oval: {
    label: "Oval",
    icon: "⬭",
    tessellated: false,
    tessStyle: "hex-offset",
    vertices: (() => {
      const pts: Point[] = [];
      const steps = 24;
      for (let i = 0; i < steps; i++) {
        const angle = (2 * Math.PI * i) / steps;
        pts.push({
          x: 0.5 + 0.5 * Math.cos(angle),
          y: 0.5 + 0.5 * Math.sin(angle),
        });
      }
      return pts;
    })(),
    flipVertices: [],
  },
  triangle: {
    label: "Triangle",
    icon: "▲",
    tessellated: true,
    tessStyle: "alternate-col", // ▲▼▲▼ within each row — much tighter packing
    vertices: [
      // ▲ pointing up — fills FULL bounding box
      { x: 0.5, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 },
    ],
    flipVertices: [
      // ▼ pointing down — fills FULL bounding box
      { x: 0.5, y: 1 }, { x: 1, y: 0 }, { x: 0, y: 0 },
    ],
  },
  octagon: {
    label: "Octagon",
    icon: "⯃",
    tessellated: false,
    tessStyle: "hex-offset",
    vertices: [
      { x: 0.3, y: 0 }, { x: 0.7, y: 0 }, { x: 1, y: 0.3 },
      { x: 1, y: 0.7 }, { x: 0.7, y: 1 }, { x: 0.3, y: 1 },
      { x: 0, y: 0.7 }, { x: 0, y: 0.3 },
    ],
    flipVertices: [],
  },
};

// ── Tessellation Helpers ──────────────────────────────────────────────────

/** Check if a shape name supports tessellation */
export function isTessellated(shapeName: string): boolean {
  return PRESET_SHAPES[shapeName]?.tessellated ?? false;
}

/** Get tessellation style for a shape */
export function getTessStyle(shapeName: string): TessStyle {
  return PRESET_SHAPES[shapeName]?.tessStyle ?? "hex-offset";
}

/** Check if a shape needs flip vertices (triangle) vs no flip (diamond) */
function needsFlip(shapeName: string): boolean {
  const preset = PRESET_SHAPES[shapeName];
  return preset ? preset.flipVertices.length >= 3 : false;
}

/**
 * Count shapes that fit on a sheet using tessellation packing.
 * Supports "alternate-col" (▲▼ within row, tighter step) and "hex-offset" styles.
 */
export function tessCapacity(
  sheetW: number,
  sheetH: number,
  shapeW: number,
  shapeH: number,
  bleedIn: number,
  shapeName?: string
): number {
  const style = shapeName ? getTessStyle(shapeName) : "hex-offset";
  const cellW = shapeW + 2 * bleedIn;
  const cellH = shapeH + 2 * bleedIn;

  if (style === "alternate-col") {
    // Alternate-col: ▲▼▲▼ within each row, tighter horizontal step
    // Step = cellW/2 + bleedIn ensures 2*bleedIn gap between cut lines
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

  // Hex-offset: original hex-like offset rows
  const rowHeight = cellH * Math.sqrt(3) / 2;
  let count = 0;
  let y = bleedIn;
  let row = 0;

  while (y + cellH <= sheetH - bleedIn + 0.001) {
    const offset = row % 2 === 1 ? cellW / 2 : 0;
    let x = bleedIn + offset;

    while (x + shapeW <= sheetW - bleedIn + 0.001) {
      count++;
      x += cellW;
    }

    y += rowHeight;
    row++;
  }

  return count;
}

/**
 * Count shapes in a tessellation group of w columns × h rows.
 * alternate-col: w × h (all rows same count)
 * hex-offset: even rows w, odd rows w-1
 */
export function tessGroupCount(w: number, h: number, shapeName?: string): number {
  const style = shapeName ? getTessStyle(shapeName) : "hex-offset";

  if (style === "alternate-col") {
    return w * h;
  }

  // Hex-offset
  let count = 0;
  for (let row = 0; row < h; row++) {
    count += row % 2 === 1 ? Math.max(w - 1, 0) : w;
  }
  return count;
}

/**
 * Compute bounding-box dimensions for a tessellation group of w×h shapes.
 * alternate-col: step = cellW/2 + bleedIn, rowHeight = cellH
 * hex-offset: step = cellW, rowHeight = cellH * √3/2
 */
export function tessGroupDimensions(
  w: number,
  h: number,
  shapeW: number,
  shapeH: number,
  bleedIn: number,
  shapeName?: string
): { width: number; height: number } {
  const style = shapeName ? getTessStyle(shapeName) : "hex-offset";
  const cellW = shapeW + 2 * bleedIn;
  const cellH = shapeH + 2 * bleedIn;

  if (style === "alternate-col") {
    // Horizontal: first sticker at bleedIn, each additional at step, last sticker extends cellW
    // Step between positions = cellW/2 + bleedIn (ensures proper bleed gap between cut lines)
    const step = cellW / 2 + bleedIn;
    const width = 2 * bleedIn + (w - 1) * step + shapeW;
    // Vertical: same as grid, each row is cellH tall
    const height = h * cellH + 2 * bleedIn;
    return { width, height };
  }

  // Hex-offset (original)
  const rowHeight = cellH * Math.sqrt(3) / 2;
  const width = w * cellW + 2 * bleedIn;
  const height = (h - 1) * rowHeight + cellH + 2 * bleedIn;
  return { width, height };
}

/**
 * Generate absolute positions for shapes in a tessellation group placed at (x0, y0).
 * alternate-col: ▲▼▲▼ within each row, step = cellW/2 + bleedIn
 * hex-offset: offset odd rows by cellW/2, rowHeight = cellH * √3/2
 */
export function tessGroupPositions(
  w: number,
  h: number,
  shapeW: number,
  shapeH: number,
  bleedIn: number,
  x0: number,
  y0: number,
  shapeName: string
): TessPosition[] {
  const style = getTessStyle(shapeName);
  const cellW = shapeW + 2 * bleedIn;
  const cellH = shapeH + 2 * bleedIn;
  const useFlip = needsFlip(shapeName);
  const positions: TessPosition[] = [];

  if (style === "alternate-col") {
    // Alternate-col: ▲▼▲▼ within each row
    // Step between positions = cellW/2 + bleedIn
    const step = cellW / 2 + bleedIn;

    for (let row = 0; row < h; row++) {
      for (let col = 0; col < w; col++) {
        const x = x0 + bleedIn + col * step;
        const y = y0 + bleedIn + row * cellH;
        // For shapes with flip (triangle): alternate orientation within row
        // For shapes without flip (diamond): all same orientation
        const flip = useFlip ? (col % 2 === 1) : false;
        positions.push({ x, y, flip });
      }
    }

    return positions;
  }

  // Hex-offset (original)
  const rowHeight = cellH * Math.sqrt(3) / 2;

  for (let row = 0; row < h; row++) {
    const colsInRow = row % 2 === 1 ? Math.max(w - 1, 0) : w;
    const offset = row % 2 === 1 ? cellW / 2 : 0;
    // For shapes with flip (triangle): odd rows are inverted
    // For shapes without flip (diamond): all rows same orientation
    const flip = useFlip ? row % 2 === 1 : false;

    for (let col = 0; col < colsInRow; col++) {
      const x = x0 + bleedIn + col * cellW + offset;
      const y = y0 + bleedIn + row * rowHeight;
      positions.push({ x, y, flip });
    }
  }

  return positions;
}

/**
 * Enumerate valid tessellation group shapes for a given number of outs.
 * Returns shapes sorted by compactness (closest to square ratio).
 */
export function getTessGroupShapes(outs: number, shapeName?: string): { w: number; h: number }[] {
  const style = shapeName ? getTessStyle(shapeName) : "hex-offset";

  if (style === "alternate-col") {
    // Same as grid: count = w * h
    const shapes: { w: number; h: number }[] = [];
    for (let w = 1; w <= outs; w++) {
      if (outs % w === 0) {
        shapes.push({ w, h: outs / w });
      }
    }
    shapes.sort((a, b) => {
      const ratioA = Math.max(a.w, a.h) / Math.min(a.w, a.h);
      const ratioB = Math.max(b.w, b.h) / Math.min(b.w, b.h);
      if (ratioA !== ratioB) return ratioA - ratioB;
      return b.w - a.w;
    });
    return shapes;
  }

  // Hex-offset: count depends on odd rows having w-1
  const shapes: { w: number; h: number }[] = [];

  for (let h = 1; h <= outs + 2; h++) {
    for (let w = 1; w <= outs + 2; w++) {
      const count = tessGroupCount(w, h, shapeName);
      if (count >= outs) {
        shapes.push({ w, h });
      }
      if (count > outs + 4) break;
    }
  }

  shapes.sort((a, b) => {
    const wastedA = tessGroupCount(a.w, a.h, shapeName) - outs;
    const wastedB = tessGroupCount(b.w, b.h, shapeName) - outs;
    if (wastedA !== wastedB) return wastedA - wastedB;
    const ratioA = Math.max(a.w, a.h) / Math.min(a.w, a.h);
    const ratioB = Math.max(b.w, b.h) / Math.min(b.w, b.h);
    return ratioA - ratioB;
  });

  return shapes.slice(0, 8);
}

// ── Grid Helpers (for non-tessellating shapes) ──────────────────────────────

function gridGroupDimensions(
  w: number,
  h: number,
  shapeW: number,
  shapeH: number,
  bleedIn: number
): { width: number; height: number } {
  return {
    width: w * shapeW + 2 * bleedIn,
    height: h * shapeH + 2 * bleedIn,
  };
}

function getGridGroupShapes(outs: number): { w: number; h: number }[] {
  const shapes: { w: number; h: number }[] = [];
  for (let w = 1; w <= outs; w++) {
    if (outs % w === 0) {
      shapes.push({ w, h: outs / w });
    }
  }
  shapes.sort((a, b) => {
    const ratioA = Math.max(a.w, a.h) / Math.min(a.w, a.h);
    const ratioB = Math.max(b.w, b.h) / Math.min(b.w, b.h);
    if (ratioA !== ratioB) return ratioA - ratioB;
    return b.w - a.w;
  });
  return shapes;
}

// ── Mixed Shape Packing ────────────────────────────────────────────────────
// Handles both tessellating and non-tessellating shapes on the same sheet.

interface CustomGroupInfo {
  name: string;
  projectIdx: number;
  outs: number;
  width: number;
  height: number;
  stickerWidth: number;
  stickerHeight: number;
  shapeName: string;
  tessellated: boolean;
  shape: { w: number; h: number };
}

function tryPackCustomGroups(
  groups: CustomGroupInfo[],
  sheetW: number,
  sheetH: number
): PlacedCustomGroup[] | null {
  // Convert to generic GroupWithDims for MaxRect
  const genericGroups: GroupWithDims[] = groups.map((g) => ({
    name: g.name,
    projectIdx: g.projectIdx,
    shape: g.shape,
    outs: g.outs,
    width: g.width,
    height: g.height,
    stickerWidth: g.stickerWidth,
    stickerHeight: g.stickerHeight,
  }));

  const placed = maxRectPack(genericGroups, sheetW, sheetH);
  if (!placed) return null;

  // Convert back to PlacedCustomGroup with tessellation positions
  return placed.map((pg) => {
    const group = groups.find(
      (g) => g.name === pg.name && g.projectIdx === pg.projectIdx
    )!;
    const preset = PRESET_SHAPES[group.shapeName] || PRESET_SHAPES.diamond;

    // Generate tessellation positions
    const tessPositions = group.tessellated
      ? tessGroupPositions(
          pg.shape.w, pg.shape.h,
          group.stickerWidth, group.stickerHeight,
          0, // bleedIn already factored into group dimensions
          pg.x, pg.y,
          group.shapeName
        )
      : undefined;

    return {
      name: pg.name,
      projectIdx: pg.projectIdx,
      outs: pg.outs,
      x: pg.x,
      y: pg.y,
      width: pg.width,
      height: pg.height,
      stickerWidth: group.stickerWidth,
      stickerHeight: group.stickerHeight,
      shapeName: group.shapeName,
      vertices: preset.vertices,
      flipVertices: preset.flipVertices,
      tessellated: group.tessellated,
      itemType: "custom" as const,
      shape: pg.shape,
      tessPositions,
    };
  });
}

// ── Shape Combination Packing ──────────────────────────────────────────────

interface CustomAllocItem {
  name: string;
  projectIdx: number;
  outs: number;
  stickerWidth: number;
  stickerHeight: number;
  shapeName: string;
  tessellated: boolean;
}

function findValidCustomPacking(
  allocation: CustomAllocItem[],
  sheetW: number,
  sheetH: number,
  bleedIn: number,
  deadline?: number
): { shapes: { w: number; h: number }[]; placedGroups: PlacedCustomGroup[] } | null {
  const n = allocation.length;

  // Get group shapes for each project based on its tessellation mode
  const allShapes = allocation.map((a) => {
    if (a.tessellated) {
      return getTessGroupShapes(a.outs, a.shapeName);
    } else {
      return getGridGroupShapes(a.outs);
    }
  });

  let attempts = 0;
  const maxAttempts = 200;
  let stackDepth = 0;
  const maxStackDepth = 50;

  function tryCombo(
    idx: number,
    currentShapes: { w: number; h: number }[]
  ): { shapes: { w: number; h: number }[]; placedGroups: PlacedCustomGroup[] } | null {
    stackDepth++;
    if (stackDepth > maxStackDepth || attempts > maxAttempts || (deadline && Date.now() > deadline)) {
      stackDepth--;
      return null;
    }
    if (idx === n) {
      attempts++;
      if (attempts > maxAttempts || (deadline && Date.now() > deadline)) {
        stackDepth--;
        return null;
      }

      const groupsWithDims: CustomGroupInfo[] = currentShapes.map((shape, i) => {
        const a = allocation[i];
        const dims = a.tessellated
          ? tessGroupDimensions(shape.w, shape.h, a.stickerWidth, a.stickerHeight, bleedIn, a.shapeName)
          : gridGroupDimensions(shape.w, shape.h, a.stickerWidth, a.stickerHeight, bleedIn);
        return {
          name: a.name,
          projectIdx: a.projectIdx,
          outs: a.outs,
          width: dims.width,
          height: dims.height,
          stickerWidth: a.stickerWidth,
          stickerHeight: a.stickerHeight,
          shapeName: a.shapeName,
          tessellated: a.tessellated,
          shape,
        };
      });

      for (const g of groupsWithDims) {
        if (g.width > sheetW || g.height > sheetH) return null;
      }

      const placed = tryPackCustomGroups(groupsWithDims, sheetW, sheetH);
      if (placed) {
        // Recalculate tessellation positions with correct bleedIn
        const correctedPlaced = placed.map((pg) => {
          if (pg.tessellated) {
            pg.tessPositions = tessGroupPositions(
              pg.shape.w, pg.shape.h,
              pg.stickerWidth, pg.stickerHeight,
              bleedIn,
              pg.x, pg.y,
              pg.shapeName
            );
          }
          return pg;
        });
        return { shapes: [...currentShapes], placedGroups: correctedPlaced };
      }
      return null;
    }

    const shapesToTry = allShapes[idx].slice(0, 4);
    for (const shape of shapesToTry) {
      const a = allocation[idx];
      const dims = a.tessellated
        ? tessGroupDimensions(shape.w, shape.h, a.stickerWidth, a.stickerHeight, bleedIn, a.shapeName)
        : gridGroupDimensions(shape.w, shape.h, a.stickerWidth, a.stickerHeight, bleedIn);
      if (dims.width > sheetW || dims.height > sheetH) continue;

      currentShapes.push(shape);
      const result = tryCombo(idx + 1, currentShapes);
      if (result) {
        stackDepth--;
        return result;
      }
      currentShapes.pop();

      if (attempts > maxAttempts || (deadline && Date.now() > deadline)) {
        stackDepth--;
        return null;
      }
    }
    stackDepth--;
    return null;
  }

  return tryCombo(0, []);
}

// ── Allocation with Custom Packing ─────────────────────────────────────────

interface CustomAllocationWithPacking {
  allocation: number[];
  runLength: number;
  shapes: { w: number; h: number }[];
  placedGroups: PlacedCustomGroup[];
}

function findBestCustomAllocation(
  projects: CustomProject[],
  indices: number[],
  sheetW: number,
  sheetH: number,
  bleedIn: number,
  maxSlots: number,
  deadline?: number
): CustomAllocationWithPacking | null {
  const n = indices.length;
  if (n === 0) return null;

  const demands = indices.map((i) => projects[i].quantity);
  const minOuts = 2;
  const minTotal = n * minOuts;

  // Per-project max outs based on capacity
  const perProjectMax = indices.map((i) => {
    const p = projects[i];
    if (isTessellated(p.shapeName)) {
      return Math.max(tessCapacity(sheetW, sheetH, p.stickerWidth, p.stickerHeight, bleedIn, p.shapeName), minOuts);
    } else {
      const cellW = p.stickerWidth + 2 * bleedIn;
      const cellH = p.stickerHeight + 2 * bleedIn;
      return Math.max(Math.floor(sheetW / cellW) * Math.floor(sheetH / cellH), minOuts);
    }
  });

  if (minTotal > maxSlots) return null;

  // Build priority list of total outs to try
  const totalsToTry: number[] = [];
  for (let L = 1; L <= Math.max(...demands); L++) {
    let total = 0;
    for (let i = 0; i < n; i++) {
      total += Math.max(minOuts, Math.ceil(demands[i] / L));
    }
    if (total >= minTotal && total <= maxSlots && !totalsToTry.includes(total)) {
      totalsToTry.push(total);
    }
    if (total > maxSlots) break;
  }

  const midTotal = Math.ceil((minTotal + maxSlots) / 2);
  for (const t of [minTotal, midTotal, maxSlots]) {
    if (!totalsToTry.includes(t) && t >= minTotal && t <= maxSlots) {
      totalsToTry.push(t);
    }
  }

  totalsToTry.sort((a, b) => {
    if (a === maxSlots) return -1;
    if (b === maxSlots) return 1;
    return b - a;
  });

  let bestL = Infinity;
  let bestResult: CustomAllocationWithPacking | null = null;
  let searchIterations = 0;
  const maxSearchIterations = 10000;

  for (const totalOuts of totalsToTry) {
    if (totalOuts < minTotal || totalOuts > maxSlots) continue;
    if (bestL <= 1) break; // Early exit: can't beat run length of 1
    if (deadline && Date.now() > deadline) break; // Time-based cutoff

    const current = new Array(n).fill(0);

    function search(idx: number, remaining: number): void {
      if (searchIterations > maxSearchIterations || (deadline && Date.now() > deadline)) return;
      searchIterations++;

      if (idx === n - 1) {
        current[idx] = remaining;
        if (remaining < minOuts) return;
        if (remaining > perProjectMax[idx]) return;

        let L = 0;
        for (let i = 0; i < n; i++) {
          L = Math.max(L, Math.ceil(demands[i] / current[i]));
        }
        if (L >= bestL) return;

        const allocInfo: CustomAllocItem[] = current.map((outs, i) => ({
          name: `p${i}`,
          projectIdx: i,
          outs,
          stickerWidth: projects[indices[i]].stickerWidth,
          stickerHeight: projects[indices[i]].stickerHeight,
          shapeName: projects[indices[i]].shapeName,
          tessellated: isTessellated(projects[indices[i]].shapeName),
        }));

        const packing = findValidCustomPacking(allocInfo, sheetW, sheetH, bleedIn, deadline);

        if (packing) {
          bestL = L;
          bestResult = {
            allocation: [...current],
            runLength: L,
            shapes: packing.shapes,
            placedGroups: packing.placedGroups,
          };
        }
        return;
      }

      const minRemaining = (n - idx - 1) * minOuts;
      const maxVal = Math.min(remaining - minRemaining, perProjectMax[idx]);
      for (let val = minOuts; val <= maxVal; val++) {
        if (searchIterations > maxSearchIterations || (deadline && Date.now() > deadline)) break;
        current[idx] = val;
        let partialL = 0;
        for (let i = 0; i <= idx; i++) {
          partialL = Math.max(partialL, Math.ceil(demands[i] / current[i]));
        }
        if (partialL >= bestL) continue;
        search(idx + 1, remaining - val);
      }
    }

    search(0, totalOuts);
  }

  return bestResult;
}

// ── Build Plate Result ─────────────────────────────────────────────────────

function buildCustomPlateResult(
  projects: CustomProject[],
  indices: number[],
  allocation: number[],
  shapes: { w: number; h: number }[],
  runLength: number,
  sheetW: number,
  sheetH: number,
  bleedIn: number,
  placedGroups: PlacedCustomGroup[]
): CustomPlateResult {
  let totalOrderQty = 0;

  const allocationEntries: CustomAllocationEntry[] = indices.map((projIdx, i) => {
    const qty = projects[projIdx].quantity;
    const outs = allocation[i];
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
      groupShape: shapes[i],
      stickerWidth: projects[projIdx].stickerWidth,
      stickerHeight: projects[projIdx].stickerHeight,
      shapeName: projects[projIdx].shapeName,
      tessellated: isTessellated(projects[projIdx].shapeName),
    };
  });

  const totalProduced = allocationEntries.reduce((sum, a) => sum + a.produced, 0);

  // Remap placed groups to use actual project names and correct indices
  const remappedGroups: PlacedCustomGroup[] = placedGroups.map((pg) => {
    const localIdx = pg.projectIdx;
    const projIdx = indices[localIdx];
    const proj = projects[projIdx];
    const preset = PRESET_SHAPES[proj.shapeName] || PRESET_SHAPES.diamond;
    const tessellated = isTessellated(proj.shapeName);

    // Recalculate tessellation positions with correct project index and bleedIn
    let tessPositions: TessPosition[] | undefined;
    if (tessellated) {
      tessPositions = tessGroupPositions(
        pg.shape.w, pg.shape.h,
        proj.stickerWidth, proj.stickerHeight,
        bleedIn,
        pg.x, pg.y,
        proj.shapeName
      );
    }

    return {
      name: proj.name,
      projectIdx: projIdx,
      outs: pg.outs,
      x: pg.x,
      y: pg.y,
      width: pg.width,
      height: pg.height,
      stickerWidth: proj.stickerWidth,
      stickerHeight: proj.stickerHeight,
      shapeName: proj.shapeName,
      vertices: tessellated ? preset.vertices : (proj.vertices.length >= 3 ? proj.vertices : preset.vertices),
      flipVertices: tessellated ? preset.flipVertices : [],
      tessellated,
      itemType: "custom" as const,
      shape: pg.shape,
      tessPositions,
    };
  });

  // Material yield: total shape area / total sheet area
  let usedArea = 0;
  for (const alloc of allocationEntries) {
    // Use actual shape area (bounding box area)
    usedArea += alloc.produced * alloc.stickerWidth * alloc.stickerHeight;
  }
  const totalSheetArea = runLength * sheetW * sheetH;
  const materialYield = totalSheetArea > 0 ? (usedArea / totalSheetArea) * 100 : 0;

  return {
    allocation: allocationEntries,
    runLength,
    totalSheets: runLength,
    totalProduced,
    totalOverage: totalProduced - totalOrderQty,
    materialYield,
    placedGroups: remappedGroups,
  };
}

// ── Two-Plate Optimization ────────────────────────────────────────────────

function findBestCustomTwoPlate(
  projects: CustomProject[],
  maxSlots: number,
  sheetW: number,
  sheetH: number,
  bleedIn: number,
  deadline?: number
): CustomTwoPlateResult | null {
  const n = projects.length;
  if (n < 2) return null;

  let bestTotal = Infinity;
  let bestResult: CustomTwoPlateResult | null = null;
  let partitionAttempts = 0;
  const maxPartitionAttempts = 64; // Limit partition evaluations

  const totalMasks = 1 << n;
  for (let mask = 1; mask < totalMasks - 1; mask++) {
    if (!(mask & 1)) continue;
    partitionAttempts++;
    if (partitionAttempts > maxPartitionAttempts) break;

    const p1Indices: number[] = [];
    const p2Indices: number[] = [];
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) p1Indices.push(i);
      else p2Indices.push(i);
    }

    if (p1Indices.length === 0 || p2Indices.length === 0) continue;
    if (p1Indices.length * 2 > maxSlots || p2Indices.length * 2 > maxSlots) continue;

    const p1Result = findBestCustomAllocation(projects, p1Indices, sheetW, sheetH, bleedIn, maxSlots);
    if (!p1Result) continue;

    const p2Result = findBestCustomAllocation(projects, p2Indices, sheetW, sheetH, bleedIn, maxSlots);
    if (!p2Result) continue;

    const totalSheets = p1Result.runLength + p2Result.runLength;
    if (totalSheets >= bestTotal) continue;

    bestTotal = totalSheets;

    const plate1 = buildCustomPlateResult(
      projects, p1Indices,
      p1Result.allocation, p1Result.shapes,
      p1Result.runLength,
      sheetW, sheetH, bleedIn,
      p1Result.placedGroups
    );
    const plate2 = buildCustomPlateResult(
      projects, p2Indices,
      p2Result.allocation, p2Result.shapes,
      p2Result.runLength,
      sheetW, sheetH, bleedIn,
      p2Result.placedGroups
    );

    const combinedProduced = plate1.totalProduced + plate2.totalProduced;
    const totalOrderQty = projects.reduce((s, p) => s + p.quantity, 0);

    let totalUsedArea = 0;
    for (const alloc of [...plate1.allocation, ...plate2.allocation]) {
      totalUsedArea += alloc.produced * alloc.stickerWidth * alloc.stickerHeight;
    }
    const totalSheetArea = totalSheets * sheetW * sheetH;
    const materialYield = totalSheetArea > 0 ? (totalUsedArea / totalSheetArea) * 100 : 0;

    bestResult = {
      plate1, plate2,
      totalSheets,
      totalProduced: combinedProduced,
      totalOverage: combinedProduced - totalOrderQty,
      materialYield,
      sheetsSaved: 0,
      plate1ProjectIndices: p1Indices,
      plate2ProjectIndices: p2Indices,
    };
  }

  return bestResult;
}

// ── Full Calculation ───────────────────────────────────────────────────────

/** Check if a single project can even fit on the sheet (minimum 2 outs) */
function canProjectFit(
  p: CustomProject,
  sheetW: number,
  sheetH: number,
  bleedIn: number
): boolean {
  if (isTessellated(p.shapeName)) {
    return tessCapacity(sheetW, sheetH, p.stickerWidth, p.stickerHeight, bleedIn, p.shapeName) >= 2;
  } else {
    const cellW = p.stickerWidth + 2 * bleedIn;
    const cellH = p.stickerHeight + 2 * bleedIn;
    return Math.floor(sheetW / cellW) * Math.floor(sheetH / cellH) >= 2;
  }
}

/** Try packing with k plates using greedy assignment (for 3+ plates) */
function tryKPlatePacking(
  projects: CustomProject[],
  k: number,
  maxSlots: number,
  sheetW: number,
  sheetH: number,
  bleedIn: number
): { feasible: boolean; totalSheets: number } {
  if (k > projects.length) {
    // More plates than projects — each project gets its own plate
    let totalSheets = 0;
    for (const p of projects) {
      const result = findBestCustomAllocation([p], [0], sheetW, sheetH, bleedIn, maxSlots);
      if (result) {
        totalSheets += result.runLength;
      } else {
        return { feasible: false, totalSheets: 0 };
      }
    }
    return { feasible: totalSheets > 0, totalSheets };
  }

  // Greedy approach: sort projects by "size" (area * quantity) descending,
  // assign each to the plate with the fewest total sheets so far
  const sortedIndices = projects
    .map((p, i) => ({ i, size: p.stickerWidth * p.stickerHeight * p.quantity }))
    .sort((a, b) => b.size - a.size)
    .map((x) => x.i);

  // Initialize k plates
  const plates: number[][] = Array.from({ length: k }, () => []);
  const plateSheets: number[] = new Array(k).fill(0);

  for (const projIdx of sortedIndices) {
    // Try adding to each plate, pick the one that increases total sheets the least
    let bestPlate = -1;
    let bestNewTotal = Infinity;

    for (let pi = 0; pi < k; pi++) {
      const testIndices = [...plates[pi], projIdx];
      const result = findBestCustomAllocation(projects, testIndices, sheetW, sheetH, bleedIn, maxSlots);
      if (result) {
        const otherSheets = plateSheets.reduce((sum, s, idx) => idx === pi ? 0 : sum + s, 0);
        const newTotal = otherSheets + result.runLength;
        if (newTotal < bestNewTotal) {
          bestNewTotal = newTotal;
          bestPlate = pi;
        }
      }
    }

    if (bestPlate === -1) {
      return { feasible: false, totalSheets: 0 };
    }

    plates[bestPlate].push(projIdx);
    const result = findBestCustomAllocation(projects, plates[bestPlate], sheetW, sheetH, bleedIn, maxSlots);
    plateSheets[bestPlate] = result ? result.runLength : Infinity;
  }

  const totalSheets = plateSheets.reduce((s, v) => s + v, 0);
  return { feasible: totalSheets > 0 && totalSheets < Infinity, totalSheets };
}

export function calculateCustom(req: {
  sheetWidth: number;
  sheetHeight: number;
  bleed: number;
  projects: CustomProject[];
}): CustomCalculateResponse {
  const { sheetWidth, sheetHeight, bleed, projects: rawProjects } = req;

  const emptySuggestions: PlateSuggestion[] = [];

  if (!sheetWidth || !sheetHeight || bleed == null) {
    return {
      capacity: { maxPerSheet: 0, sheetWidth, sheetHeight },
      singlePlateResult: null,
      twoPlateResult: null,
      plateSuggestions: emptySuggestions,
      error: "Missing required dimension parameters.",
    };
  }

  const projects = rawProjects.filter(
    (p) => p.quantity > 0 && p.stickerWidth > 0 && p.stickerHeight > 0
  );
  if (projects.length === 0) {
    return {
      capacity: { maxPerSheet: 0, sheetWidth, sheetHeight },
      singlePlateResult: null,
      twoPlateResult: null,
      plateSuggestions: emptySuggestions,
      error: "No projects with positive quantities and valid sticker sizes.",
    };
  }

  // Apply default shape if none specified
  for (const p of projects) {
    if (!p.shapeName || p.shapeName === "") p.shapeName = "diamond";
    if (!p.vertices || p.vertices.length < 3) {
      const preset = PRESET_SHAPES[p.shapeName] || PRESET_SHAPES.diamond;
      p.vertices = preset.vertices;
    }
  }

  const bleedIn = bleed / 25.4;

  // ── Early bail-out: check if each project can fit on the sheet ──
  const tooLargeProjects: string[] = [];
  for (const p of projects) {
    if (!canProjectFit(p, sheetWidth, sheetHeight, bleedIn)) {
      tooLargeProjects.push(
        `"${p.name}" (${p.shapeName} ${p.stickerWidth}"×${p.stickerHeight}")`
      );
    }
  }

  if (tooLargeProjects.length > 0) {
    const suggestions: PlateSuggestion[] = [
      { plateCount: 1, feasible: false, totalSheets: 0, description: "Cannot fit" },
      { plateCount: 2, feasible: false, totalSheets: 0, description: "Cannot fit" },
      { plateCount: 3, feasible: false, totalSheets: 0, description: "Cannot fit" },
      { plateCount: 4, feasible: false, totalSheets: 0, description: "Cannot fit" },
    ];
    return {
      capacity: { maxPerSheet: 0, sheetWidth, sheetHeight },
      singlePlateResult: null,
      twoPlateResult: null,
      plateSuggestions: suggestions,
      error: `Projects too large for sheet: ${tooLargeProjects.join(", ")}. Try increasing sheet size or reducing sticker dimensions.`,
    };
  }

  // Capacity and max slots
  const minW = Math.min(...projects.map((p) => p.stickerWidth));
  const minH = Math.min(...projects.map((p) => p.stickerHeight));
  const hasTess = projects.some((p) => isTessellated(p.shapeName));

  // Use the first tessellated shape's name for capacity estimate, or fall back
  const tessShapeName = projects.find((p) => isTessellated(p.shapeName))?.shapeName;

  const maxPerSheet = hasTess
    ? tessCapacity(sheetWidth, sheetHeight, minW, minH, bleedIn, tessShapeName)
    : Math.floor(sheetWidth / (minW + 2 * bleedIn)) * Math.floor(sheetHeight / (minH + 2 * bleedIn));

  const maxSlots = Math.max(maxPerSheet, projects.length * 2);

  // ── Build plate suggestions progressively ──
  const plateSuggestions: PlateSuggestion[] = [];

  // Single plate
  let singlePlateResult: CustomPlateResult | null = null;
  if (projects.length * 2 <= maxSlots) {
    const allIndices = projects.map((_, i) => i);
    const result = findBestCustomAllocation(projects, allIndices, sheetWidth, sheetHeight, bleedIn, maxSlots);
    if (result) {
      singlePlateResult = buildCustomPlateResult(
        projects,
        allIndices,
        result.allocation,
        result.shapes,
        result.runLength,
        sheetWidth, sheetHeight, bleedIn,
        result.placedGroups
      );
      plateSuggestions.push({
        plateCount: 1,
        feasible: true,
        totalSheets: singlePlateResult.totalSheets,
        description: `${singlePlateResult.totalSheets.toLocaleString()} sheets, ${singlePlateResult.runLength.toLocaleString()} run length`,
      });
    } else {
      plateSuggestions.push({
        plateCount: 1,
        feasible: false,
        totalSheets: 0,
        description: "Cannot fit all projects on one plate",
      });
    }
  } else {
    plateSuggestions.push({
      plateCount: 1,
      feasible: false,
      totalSheets: 0,
      description: "Too many projects for single plate",
    });
  }

  // Two plate
  let twoPlateResult: CustomTwoPlateResult | null = null;
  if (projects.length >= 2) {
    twoPlateResult = findBestCustomTwoPlate(projects, maxSlots, sheetWidth, sheetHeight, bleedIn);
  }

  if (twoPlateResult) {
    if (singlePlateResult) {
      twoPlateResult.sheetsSaved = singlePlateResult.totalSheets - twoPlateResult.totalSheets;
    }
    plateSuggestions.push({
      plateCount: 2,
      feasible: true,
      totalSheets: twoPlateResult.totalSheets,
      description: `${twoPlateResult.totalSheets.toLocaleString()} sheets (P1: ${twoPlateResult.plate1.runLength}, P2: ${twoPlateResult.plate2.runLength})${twoPlateResult.sheetsSaved > 0 ? `, saves ${twoPlateResult.sheetsSaved} sheets` : ""}`,
    });
  } else {
    plateSuggestions.push({
      plateCount: 2,
      feasible: false,
      totalSheets: 0,
      description: "Cannot split into 2 plates",
    });
  }

  // 3 plates — greedy approach
  const k3 = tryKPlatePacking(projects, 3, maxSlots, sheetWidth, sheetHeight, bleedIn);
  plateSuggestions.push({
    plateCount: 3,
    feasible: k3.feasible,
    totalSheets: k3.totalSheets,
    description: k3.feasible ? `${k3.totalSheets.toLocaleString()} sheets across 3 plates` : "Cannot split into 3 plates",
  });

  // 4 plates — greedy approach
  const k4 = tryKPlatePacking(projects, 4, maxSlots, sheetWidth, sheetHeight, bleedIn);
  plateSuggestions.push({
    plateCount: 4,
    feasible: k4.feasible,
    totalSheets: k4.totalSheets,
    description: k4.feasible ? `${k4.totalSheets.toLocaleString()} sheets across 4 plates` : "Cannot split into 4 plates",
  });

  // Check if nothing works at all
  const anyFeasible = plateSuggestions.some((s) => s.feasible);
  if (!anyFeasible) {
    return {
      capacity: { maxPerSheet, sheetWidth, sheetHeight },
      singlePlateResult: null,
      twoPlateResult: null,
      plateSuggestions,
      error: "Projects too large for sheet. Try increasing sheet size or reducing sticker dimensions.",
    };
  }

  return {
    capacity: { maxPerSheet, sheetWidth, sheetHeight },
    singlePlateResult,
    twoPlateResult,
    plateSuggestions,
  };
}
