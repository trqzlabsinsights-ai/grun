// ── Custom Shape Packer — Self-Drawn Polygon Stickers ────────────────────────
// Supports hex-like tessellation for interlocking shapes (triangle, diamond).
// Non-tessellating shapes use bounding-rect packing.
// Tessellating shapes: each position = 1 full-size sticker, arranged in
// hex-offset rows (even rows upright, odd rows inverted + offset by half).

import {
  maxRectPack,
  type GroupWithDims,
} from "./gang-run-calculator-v2";

// ── Types ──────────────────────────────────────────────────────────────────

export interface Point {
  x: number;
  y: number;
}

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
  tessellated: boolean;    // true = hex tessellation packing
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

export interface CustomCalculateResponse {
  capacity: { maxPerSheet: number; sheetWidth: number; sheetHeight: number };
  singlePlateResult: CustomPlateResult | null;
  twoPlateResult: CustomTwoPlateResult | null;
  error?: string;
}

// ── Preset Shapes ──────────────────────────────────────────────────────────
// All vertices are in normalized coordinates (0,0) to (1,1)
// tessellated: true means hex-like offset packing (each position = 1 sticker)

export const PRESET_SHAPES: Record<string, { label: string; vertices: Point[]; flipVertices: Point[]; icon: string; tessellated: boolean }> = {
  star: {
    label: "Star",
    icon: "★",
    tessellated: false,
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
    tessellated: true, // hex tessellation — offset rows
    vertices: [
      { x: 0.5, y: 0 }, { x: 1, y: 0.5 }, { x: 0.5, y: 1 }, { x: 0, y: 0.5 },
    ],
    flipVertices: [], // diamonds don't need flip — same shape in all rows
  },
  hexagon: {
    label: "Hexagon",
    icon: "⬡",
    tessellated: false,
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
    tessellated: true, // hex tessellation — ▲ even rows, ▼ odd rows
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
    vertices: [
      { x: 0.3, y: 0 }, { x: 0.7, y: 0 }, { x: 1, y: 0.3 },
      { x: 1, y: 0.7 }, { x: 0.7, y: 1 }, { x: 0.3, y: 1 },
      { x: 0, y: 0.7 }, { x: 0, y: 0.3 },
    ],
    flipVertices: [],
  },
};

// ── Tessellation Helpers ──────────────────────────────────────────────────

/** Check if a shape name supports hex tessellation */
export function isTessellated(shapeName: string): boolean {
  return PRESET_SHAPES[shapeName]?.tessellated ?? false;
}

/** Check if a shape needs flip vertices (triangle) vs no flip (diamond) */
function needsFlip(shapeName: string): boolean {
  const preset = PRESET_SHAPES[shapeName];
  return preset ? preset.flipVertices.length >= 3 : false;
}

/**
 * Count shapes that fit on a sheet using hex-like tessellation packing.
 * Even rows: full column count. Odd rows: offset by half, one fewer.
 * Row height = cellH * sqrt(3) / 2 (hex factor).
 */
export function tessCapacity(
  sheetW: number,
  sheetH: number,
  shapeW: number,
  shapeH: number,
  bleedIn: number
): number {
  const cellW = shapeW + 2 * bleedIn;
  const cellH = shapeH + 2 * bleedIn;
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
 * Even rows: w shapes. Odd rows: w-1 shapes (offset by half).
 */
export function tessGroupCount(w: number, h: number): number {
  let count = 0;
  for (let row = 0; row < h; row++) {
    count += row % 2 === 1 ? Math.max(w - 1, 0) : w;
  }
  return count;
}

/**
 * Compute bounding-box dimensions for a tessellation group of w×h shapes.
 */
export function tessGroupDimensions(
  w: number,
  h: number,
  shapeW: number,
  shapeH: number,
  bleedIn: number
): { width: number; height: number } {
  const cellW = shapeW + 2 * bleedIn;
  const cellH = shapeH + 2 * bleedIn;
  const rowHeight = cellH * Math.sqrt(3) / 2;

  // Width: even rows span w * cellW, odd rows are offset but within same span
  // Plus bleed margins on both sides
  const width = w * cellW + 2 * bleedIn;
  // Height: first row full cellH, subsequent rows at rowHeight spacing, plus bleed
  const height = (h - 1) * rowHeight + cellH + 2 * bleedIn;

  return { width, height };
}

/**
 * Generate absolute positions for shapes in a tessellation group placed at (x0, y0).
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
  const cellW = shapeW + 2 * bleedIn;
  const cellH = shapeH + 2 * bleedIn;
  const rowHeight = cellH * Math.sqrt(3) / 2;
  const useFlip = needsFlip(shapeName);
  const positions: TessPosition[] = [];

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
export function getTessGroupShapes(outs: number): { w: number; h: number }[] {
  const shapes: { w: number; h: number }[] = [];

  for (let h = 1; h <= outs + 2; h++) {
    for (let w = 1; w <= outs + 2; w++) {
      const count = tessGroupCount(w, h);
      if (count >= outs) {
        shapes.push({ w, h });
      }
      if (count > outs + 4) break;
    }
  }

  shapes.sort((a, b) => {
    const wastedA = tessGroupCount(a.w, a.h) - outs;
    const wastedB = tessGroupCount(b.w, b.h) - outs;
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

    // Generate tessellation positions if needed
    const tessPositions = group.tessellated
      ? tessGroupPositions(
          pg.shape.w, pg.shape.h,
          group.stickerWidth, group.stickerHeight,
          0, // bleedIn already factored into group dimensions
          pg.x, pg.y,
          group.shapeName
        )
      : undefined;

    // For tessellated shapes, we need to recalculate bleedIn for positions
    // The group's bounding box already has bleed, so positions are relative to the group
    let finalTessPositions = tessPositions;
    if (group.tessellated && tessPositions) {
      // Recalculate with proper bleed
      finalTessPositions = tessGroupPositions(
        pg.shape.w, pg.shape.h,
        group.stickerWidth, group.stickerHeight,
        0.197, // approximate bleedIn — will be recalculated properly in buildCustomPlateResult
        pg.x, pg.y,
        group.shapeName
      );
    }

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
      tessPositions: finalTessPositions,
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
  bleedIn: number
): { shapes: { w: number; h: number }[]; placedGroups: PlacedCustomGroup[] } | null {
  const n = allocation.length;

  // Get group shapes for each project based on its tessellation mode
  const allShapes = allocation.map((a) => {
    if (a.tessellated) {
      return getTessGroupShapes(a.outs);
    } else {
      return getGridGroupShapes(a.outs);
    }
  });

  let attempts = 0;
  const maxAttempts = 500;

  function tryCombo(
    idx: number,
    currentShapes: { w: number; h: number }[]
  ): { shapes: { w: number; h: number }[]; placedGroups: PlacedCustomGroup[] } | null {
    if (idx === n) {
      attempts++;
      if (attempts > maxAttempts) return null;

      const groupsWithDims: CustomGroupInfo[] = currentShapes.map((shape, i) => {
        const a = allocation[i];
        const dims = a.tessellated
          ? tessGroupDimensions(shape.w, shape.h, a.stickerWidth, a.stickerHeight, bleedIn)
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
            const preset = PRESET_SHAPES[pg.shapeName] || PRESET_SHAPES.diamond;
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
        ? tessGroupDimensions(shape.w, shape.h, a.stickerWidth, a.stickerHeight, bleedIn)
        : gridGroupDimensions(shape.w, shape.h, a.stickerWidth, a.stickerHeight, bleedIn);
      if (dims.width > sheetW || dims.height > sheetH) continue;

      currentShapes.push(shape);
      const result = tryCombo(idx + 1, currentShapes);
      if (result) return result;
      currentShapes.pop();

      if (attempts > maxAttempts) return null;
    }
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
  maxSlots: number
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
      return Math.max(tessCapacity(sheetW, sheetH, p.stickerWidth, p.stickerHeight, bleedIn), minOuts);
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

  for (const totalOuts of totalsToTry) {
    if (totalOuts < minTotal || totalOuts > maxSlots) continue;

    const current = new Array(n).fill(0);

    function search(idx: number, remaining: number): void {
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

        const packing = findValidCustomPacking(allocInfo, sheetW, sheetH, bleedIn);

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
  bleedIn: number
): CustomTwoPlateResult | null {
  const n = projects.length;
  if (n < 2) return null;

  let bestTotal = Infinity;
  let bestResult: CustomTwoPlateResult | null = null;

  const totalMasks = 1 << n;
  for (let mask = 1; mask < totalMasks - 1; mask++) {
    if (!(mask & 1)) continue;

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

export function calculateCustom(req: {
  sheetWidth: number;
  sheetHeight: number;
  bleed: number;
  projects: CustomProject[];
}): CustomCalculateResponse {
  const { sheetWidth, sheetHeight, bleed, projects: rawProjects } = req;

  if (!sheetWidth || !sheetHeight || bleed == null) {
    return {
      capacity: { maxPerSheet: 0, sheetWidth, sheetHeight },
      singlePlateResult: null,
      twoPlateResult: null,
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

  // Capacity and max slots
  const minW = Math.min(...projects.map((p) => p.stickerWidth));
  const minH = Math.min(...projects.map((p) => p.stickerHeight));
  const hasTess = projects.some((p) => isTessellated(p.shapeName));

  const maxPerSheet = hasTess
    ? tessCapacity(sheetWidth, sheetHeight, minW, minH, bleedIn)
    : Math.floor(sheetWidth / (minW + 2 * bleedIn)) * Math.floor(sheetHeight / (minH + 2 * bleedIn));

  const maxSlots = Math.max(maxPerSheet, projects.length * 2);

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
    }
  }

  // Two plate
  let twoPlateResult: CustomTwoPlateResult | null = null;
  if (projects.length >= 2) {
    twoPlateResult = findBestCustomTwoPlate(projects, maxSlots, sheetWidth, sheetHeight, bleedIn);
  }

  if (twoPlateResult && singlePlateResult) {
    twoPlateResult.sheetsSaved = singlePlateResult.totalSheets - twoPlateResult.totalSheets;
  }

  return {
    capacity: { maxPerSheet, sheetWidth, sheetHeight },
    singlePlateResult,
    twoPlateResult,
  };
}
