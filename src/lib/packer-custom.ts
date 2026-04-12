// ── Custom Shape Packer — Regular Polygon Stickers ──────────────────────────
// Supports regular polygons defined by number of sides (3+).
// Tessellation:
//   3 sides (triangle)  → "alternate-col" ▲▼▲▼ within each row
//   4 sides (diamond)   → "hex-offset" offset rows
//   6 sides (hexagon)   → "hex-offset" honeycomb
//   other sides         → "hex-offset" grid with offset rows
// Non-tessellating polygons (5, 7, 8+ sides) use bounding-rect packing.

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
  sides: number;          // number of polygon sides (3=triangle, 4=diamond, etc.)
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
  sides: number;
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
  sides: number;
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

/** Generate flip (inverted) vertices for tessellation */
export function generateFlipPolygon(sides: number): Point[] {
  if (sides < 3) sides = 3;
  const vertices: Point[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = (2 * Math.PI * i) / sides - Math.PI / 2;
    vertices.push({
      x: 0.5 + 0.5 * Math.cos(angle),
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

/** Check if a polygon with given sides supports tessellation */
export function isTessellated(sides: number): boolean {
  return sides === 3 || sides === 4 || sides === 6;
}

/** Get tessellation style for a polygon */
export function getTessStyle(sides: number): TessStyle {
  if (sides === 3) return "alternate-col";
  return "hex-offset";
}

/** Check if a polygon needs flip vertices */
function needsFlip(sides: number): boolean {
  return sides === 3;
}

/** Get vertices for a polygon, using optimized tessellation vertices where applicable */
function getPolygonVertices(sides: number): Point[] {
  if (sides === 3) return triangleUp();
  return generateRegularPolygon(sides);
}

/** Get flip vertices for a polygon */
function getPolygonFlipVertices(sides: number): Point[] {
  if (sides === 3) return triangleDown();
  if (needsFlip(sides)) return generateFlipPolygon(sides);
  return [];
}

/** Convert sides number to shapeName key for PRESET_SHAPES lookup (legacy compat) */
export function sidesToShapeName(sides: number): string {
  const map: Record<number, string> = {
    3: "triangle", 4: "diamond", 5: "pentagon", 6: "hexagon",
    7: "heptagon", 8: "octagon", 9: "nonagon", 10: "decagon",
  };
  return map[sides] || `${sides}-gon`;
}

// ── Legacy PRESET_SHAPES for backward compat (SVG viz, allocation table) ──

export const PRESET_SHAPES: Record<string, { label: string; vertices: Point[]; flipVertices: Point[]; icon: string; tessellated: boolean; tessStyle: TessStyle }> = {
  triangle: { label: "Triangle", icon: "▲", tessellated: true, tessStyle: "alternate-col", vertices: triangleUp(), flipVertices: triangleDown() },
  diamond: { label: "Diamond", icon: "◆", tessellated: true, tessStyle: "hex-offset", vertices: generateRegularPolygon(4), flipVertices: [] },
  pentagon: { label: "Pentagon", icon: "⬠", tessellated: false, tessStyle: "hex-offset", vertices: generateRegularPolygon(5), flipVertices: [] },
  hexagon: { label: "Hexagon", icon: "⬡", tessellated: true, tessStyle: "hex-offset", vertices: generateRegularPolygon(6), flipVertices: [] },
  heptagon: { label: "Heptagon", icon: "7", tessellated: false, tessStyle: "hex-offset", vertices: generateRegularPolygon(7), flipVertices: [] },
  octagon: { label: "Octagon", icon: "⯃", tessellated: false, tessStyle: "hex-offset", vertices: generateRegularPolygon(8), flipVertices: [] },
  nonagon: { label: "Nonagon", icon: "9", tessellated: false, tessStyle: "hex-offset", vertices: generateRegularPolygon(9), flipVertices: [] },
  decagon: { label: "Decagon", icon: "10", tessellated: false, tessStyle: "hex-offset", vertices: generateRegularPolygon(10), flipVertices: [] },
};

// ── Tessellation Helpers ──────────────────────────────────────────────────

/** Count shapes that fit on a sheet using tessellation packing */
export function tessCapacity(
  sheetW: number,
  sheetH: number,
  shapeW: number,
  shapeH: number,
  bleedIn: number,
  sides: number
): number {
  const style = getTessStyle(sides);
  const cellW = shapeW + 2 * bleedIn;
  const cellH = shapeH + 2 * bleedIn;

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

  // Hex-offset
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

/** Count shapes in a tessellation group of w columns × h rows */
export function tessGroupCount(w: number, h: number, sides: number): number {
  const style = getTessStyle(sides);
  if (style === "alternate-col") return w * h;

  let count = 0;
  for (let row = 0; row < h; row++) {
    count += row % 2 === 1 ? Math.max(w - 1, 0) : w;
  }
  return count;
}

/** Compute bounding-box dimensions for a tessellation group */
export function tessGroupDimensions(
  w: number, h: number,
  shapeW: number, shapeH: number,
  bleedIn: number, sides: number
): { width: number; height: number } {
  const style = getTessStyle(sides);
  const cellW = shapeW + 2 * bleedIn;
  const cellH = shapeH + 2 * bleedIn;

  if (style === "alternate-col") {
    const step = cellW / 2 + bleedIn;
    return {
      width: 2 * bleedIn + (w - 1) * step + shapeW,
      height: h * cellH + 2 * bleedIn,
    };
  }

  const rowHeight = cellH * Math.sqrt(3) / 2;
  return {
    width: w * cellW + 2 * bleedIn,
    height: (h - 1) * rowHeight + cellH + 2 * bleedIn,
  };
}

/** Generate absolute positions for shapes in a tessellation group */
export function tessGroupPositions(
  w: number, h: number,
  shapeW: number, shapeH: number,
  bleedIn: number,
  x0: number, y0: number,
  sides: number
): TessPosition[] {
  const style = getTessStyle(sides);
  const cellW = shapeW + 2 * bleedIn;
  const cellH = shapeH + 2 * bleedIn;
  const useFlip = needsFlip(sides);
  const positions: TessPosition[] = [];

  if (style === "alternate-col") {
    const step = cellW / 2 + bleedIn;
    for (let row = 0; row < h; row++) {
      for (let col = 0; col < w; col++) {
        positions.push({
          x: x0 + bleedIn + col * step,
          y: y0 + bleedIn + row * cellH,
          flip: useFlip ? (col % 2 === 1) : false,
        });
      }
    }
    return positions;
  }

  // Hex-offset
  const rowHeight = cellH * Math.sqrt(3) / 2;
  for (let row = 0; row < h; row++) {
    const colsInRow = row % 2 === 1 ? Math.max(w - 1, 0) : w;
    const offset = row % 2 === 1 ? cellW / 2 : 0;
    const flip = useFlip ? row % 2 === 1 : false;
    for (let col = 0; col < colsInRow; col++) {
      positions.push({
        x: x0 + bleedIn + col * cellW + offset,
        y: y0 + bleedIn + row * rowHeight,
        flip,
      });
    }
  }
  return positions;
}

/** Enumerate valid tessellation group shapes for a given number of outs */
export function getTessGroupShapes(outs: number, sides: number): { w: number; h: number }[] {
  const style = getTessStyle(sides);

  if (style === "alternate-col") {
    const shapes: { w: number; h: number }[] = [];
    for (let w = 1; w <= outs; w++) {
      if (outs % w === 0) shapes.push({ w, h: outs / w });
    }
    shapes.sort((a, b) => {
      const ratioA = Math.max(a.w, a.h) / Math.min(a.w, a.h);
      const ratioB = Math.max(b.w, b.h) / Math.min(b.w, b.h);
      if (ratioA !== ratioB) return ratioA - ratioB;
      return b.w - a.w;
    });
    return shapes;
  }

  const shapes: { w: number; h: number }[] = [];
  for (let h = 1; h <= outs + 2; h++) {
    for (let w = 1; w <= outs + 2; w++) {
      const count = tessGroupCount(w, h, sides);
      if (count >= outs) shapes.push({ w, h });
      if (count > outs + 4) break;
    }
  }
  shapes.sort((a, b) => {
    const wastedA = tessGroupCount(a.w, a.h, sides) - outs;
    const wastedB = tessGroupCount(b.w, b.h, sides) - outs;
    if (wastedA !== wastedB) return wastedA - wastedB;
    const ratioA = Math.max(a.w, a.h) / Math.min(a.w, a.h);
    const ratioB = Math.max(b.w, b.h) / Math.min(b.w, b.h);
    return ratioA - ratioB;
  });
  return shapes.slice(0, 8);
}

// ── Grid Helpers (for non-tessellating polygons) ───────────────────────────

function gridGroupDimensions(
  w: number, h: number,
  shapeW: number, shapeH: number,
  bleedIn: number
): { width: number; height: number } {
  return { width: w * shapeW + 2 * bleedIn, height: h * shapeH + 2 * bleedIn };
}

function getGridGroupShapes(outs: number): { w: number; h: number }[] {
  const shapes: { w: number; h: number }[] = [];
  for (let w = 1; w <= outs; w++) {
    if (outs % w === 0) shapes.push({ w, h: outs / w });
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

interface CustomGroupInfo {
  name: string;
  projectIdx: number;
  outs: number;
  width: number;
  height: number;
  stickerWidth: number;
  stickerHeight: number;
  sides: number;
  tessellated: boolean;
  shape: { w: number; h: number };
}

function tryPackCustomGroups(
  groups: CustomGroupInfo[],
  sheetW: number, sheetH: number
): PlacedCustomGroup[] | null {
  const genericGroups: GroupWithDims[] = groups.map((g) => ({
    name: g.name, projectIdx: g.projectIdx, shape: g.shape,
    outs: g.outs, width: g.width, height: g.height,
    stickerWidth: g.stickerWidth, stickerHeight: g.stickerHeight,
  }));

  const placed = maxRectPack(genericGroups, sheetW, sheetH);
  if (!placed) return null;

  return placed.map((pg) => {
    const group = groups.find(
      (g) => g.name === pg.name && g.projectIdx === pg.projectIdx
    )!;

    const tessPositions = group.tessellated
      ? tessGroupPositions(pg.shape.w, pg.shape.h, group.stickerWidth, group.stickerHeight, 0, pg.x, pg.y, group.sides)
      : undefined;

    return {
      name: pg.name, projectIdx: pg.projectIdx, outs: pg.outs,
      x: pg.x, y: pg.y, width: pg.width, height: pg.height,
      stickerWidth: group.stickerWidth, stickerHeight: group.stickerHeight,
      sides: group.sides,
      vertices: getPolygonVertices(group.sides),
      flipVertices: getPolygonFlipVertices(group.sides),
      tessellated: group.tessellated,
      itemType: "custom" as const, shape: pg.shape, tessPositions,
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
  sides: number;
  tessellated: boolean;
}

function findValidCustomPacking(
  allocation: CustomAllocItem[],
  sheetW: number, sheetH: number,
  bleedIn: number, deadline?: number
): { shapes: { w: number; h: number }[]; placedGroups: PlacedCustomGroup[] } | null {
  const n = allocation.length;
  const allShapes = allocation.map((a) =>
    a.tessellated ? getTessGroupShapes(a.outs, a.sides) : getGridGroupShapes(a.outs)
  );

  let attempts = 0;
  const maxAttempts = 200;
  let stackDepth = 0;
  const maxStackDepth = 50;

  function tryCombo(
    idx: number, currentShapes: { w: number; h: number }[]
  ): { shapes: { w: number; h: number }[]; placedGroups: PlacedCustomGroup[] } | null {
    stackDepth++;
    if (stackDepth > maxStackDepth || attempts > maxAttempts || (deadline && Date.now() > deadline)) {
      stackDepth--;
      return null;
    }
    if (idx === n) {
      attempts++;
      if (attempts > maxAttempts || (deadline && Date.now() > deadline)) { stackDepth--; return null; }

      const groupsWithDims: CustomGroupInfo[] = currentShapes.map((shape, i) => {
        const a = allocation[i];
        const dims = a.tessellated
          ? tessGroupDimensions(shape.w, shape.h, a.stickerWidth, a.stickerHeight, bleedIn, a.sides)
          : gridGroupDimensions(shape.w, shape.h, a.stickerWidth, a.stickerHeight, bleedIn);
        return {
          name: a.name, projectIdx: a.projectIdx, outs: a.outs,
          width: dims.width, height: dims.height,
          stickerWidth: a.stickerWidth, stickerHeight: a.stickerHeight,
          sides: a.sides, tessellated: a.tessellated, shape,
        };
      });

      for (const g of groupsWithDims) {
        if (g.width > sheetW || g.height > sheetH) return null;
      }

      const placed = tryPackCustomGroups(groupsWithDims, sheetW, sheetH);
      if (placed) {
        const correctedPlaced = placed.map((pg) => {
          if (pg.tessellated) {
            pg.tessPositions = tessGroupPositions(pg.shape.w, pg.shape.h, pg.stickerWidth, pg.stickerHeight, bleedIn, pg.x, pg.y, groupsWithDims.find(g => g.name === pg.name)?.sides || 4);
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
        ? tessGroupDimensions(shape.w, shape.h, a.stickerWidth, a.stickerHeight, bleedIn, a.sides)
        : gridGroupDimensions(shape.w, shape.h, a.stickerWidth, a.stickerHeight, bleedIn);
      if (dims.width > sheetW || dims.height > sheetH) continue;

      currentShapes.push(shape);
      const result = tryCombo(idx + 1, currentShapes);
      if (result) { stackDepth--; return result; }
      currentShapes.pop();

      if (attempts > maxAttempts || (deadline && Date.now() > deadline)) { stackDepth--; return null; }
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
  sheetW: number, sheetH: number,
  bleedIn: number, maxSlots: number,
  deadline?: number
): CustomAllocationWithPacking | null {
  const n = indices.length;
  if (n === 0) return null;

  const demands = indices.map((i) => projects[i].quantity);
  const minOuts = 2;
  const minTotal = n * minOuts;

  const perProjectMax = indices.map((i) => {
    const p = projects[i];
    if (isTessellated(p.sides)) {
      return Math.max(tessCapacity(sheetW, sheetH, p.stickerWidth, p.stickerHeight, bleedIn, p.sides), minOuts);
    }
    const cellW = p.stickerWidth + 2 * bleedIn;
    const cellH = p.stickerHeight + 2 * bleedIn;
    return Math.max(Math.floor(sheetW / cellW) * Math.floor(sheetH / cellH), minOuts);
  });

  if (minTotal > maxSlots) return null;

  const totalsToTry: number[] = [];
  for (let L = 1; L <= Math.max(...demands); L++) {
    let total = 0;
    for (let i = 0; i < n; i++) total += Math.max(minOuts, Math.ceil(demands[i] / L));
    if (total >= minTotal && total <= maxSlots && !totalsToTry.includes(total)) totalsToTry.push(total);
    if (total > maxSlots) break;
  }
  const midTotal = Math.ceil((minTotal + maxSlots) / 2);
  for (const t of [minTotal, midTotal, maxSlots]) {
    if (!totalsToTry.includes(t) && t >= minTotal && t <= maxSlots) totalsToTry.push(t);
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
    if (bestL <= 1) break;
    if (deadline && Date.now() > deadline) break;

    const current = new Array(n).fill(0);

    function search(idx: number, remaining: number): void {
      if (searchIterations > maxSearchIterations || (deadline && Date.now() > deadline)) return;
      searchIterations++;

      if (idx === n - 1) {
        current[idx] = remaining;
        if (remaining < minOuts || remaining > perProjectMax[idx]) return;

        let L = 0;
        for (let i = 0; i < n; i++) L = Math.max(L, Math.ceil(demands[i] / current[i]));
        if (L >= bestL) return;

        const allocInfo: CustomAllocItem[] = current.map((outs, i) => ({
          name: `p${i}`, projectIdx: i, outs,
          stickerWidth: projects[indices[i]].stickerWidth,
          stickerHeight: projects[indices[i]].stickerHeight,
          sides: projects[indices[i]].sides,
          tessellated: isTessellated(projects[indices[i]].sides),
        }));

        const packing = findValidCustomPacking(allocInfo, sheetW, sheetH, bleedIn, deadline);
        if (packing) {
          bestL = L;
          bestResult = { allocation: [...current], runLength: L, shapes: packing.shapes, placedGroups: packing.placedGroups };
        }
        return;
      }

      const minRemaining = (n - idx - 1) * minOuts;
      const maxVal = Math.min(remaining - minRemaining, perProjectMax[idx]);
      for (let val = minOuts; val <= maxVal; val++) {
        if (searchIterations > maxSearchIterations || (deadline && Date.now() > deadline)) break;
        current[idx] = val;
        let partialL = 0;
        for (let i = 0; i <= idx; i++) partialL = Math.max(partialL, Math.ceil(demands[i] / current[i]));
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
  projects: CustomProject[], indices: number[],
  allocation: number[], shapes: { w: number; h: number }[],
  runLength: number, sheetW: number, sheetH: number,
  bleedIn: number, placedGroups: PlacedCustomGroup[]
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
      name: projects[projIdx].name, quantity: qty, outs, produced, overage, overagePct,
      groupShape: shapes[i], stickerWidth: projects[projIdx].stickerWidth,
      stickerHeight: projects[projIdx].stickerHeight, sides: projects[projIdx].sides,
      tessellated: isTessellated(projects[projIdx].sides),
    };
  });

  const totalProduced = allocationEntries.reduce((sum, a) => sum + a.produced, 0);

  const remappedGroups: PlacedCustomGroup[] = placedGroups.map((pg) => {
    const localIdx = pg.projectIdx;
    const projIdx = indices[localIdx];
    const proj = projects[projIdx];
    const tessellated = isTessellated(proj.sides);

    let tessPositions: TessPosition[] | undefined;
    if (tessellated) {
      tessPositions = tessGroupPositions(pg.shape.w, pg.shape.h, proj.stickerWidth, proj.stickerHeight, bleedIn, pg.x, pg.y, proj.sides);
    }

    return {
      name: proj.name, projectIdx: projIdx, outs: pg.outs,
      x: pg.x, y: pg.y, width: pg.width, height: pg.height,
      stickerWidth: proj.stickerWidth, stickerHeight: proj.stickerHeight,
      sides: proj.sides,
      vertices: getPolygonVertices(proj.sides),
      flipVertices: getPolygonFlipVertices(proj.sides),
      tessellated, itemType: "custom" as const, shape: pg.shape, tessPositions,
    };
  });

  let usedArea = 0;
  for (const alloc of allocationEntries) {
    usedArea += alloc.produced * alloc.stickerWidth * alloc.stickerHeight;
  }
  const totalSheetArea = runLength * sheetW * sheetH;
  const materialYield = totalSheetArea > 0 ? (usedArea / totalSheetArea) * 100 : 0;

  return {
    allocation: allocationEntries, runLength, totalSheets: runLength,
    totalProduced, totalOverage: totalProduced - totalOrderQty,
    materialYield, placedGroups: remappedGroups,
  };
}

// ── Two-Plate Optimization ────────────────────────────────────────────────

function findBestCustomTwoPlate(
  projects: CustomProject[], maxSlots: number,
  sheetW: number, sheetH: number, bleedIn: number, deadline?: number
): CustomTwoPlateResult | null {
  const n = projects.length;
  if (n < 2) return null;

  let bestTotal = Infinity;
  let bestResult: CustomTwoPlateResult | null = null;
  let partitionAttempts = 0;
  const maxPartitionAttempts = 64;

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

    const p1Result = findBestCustomAllocation(projects, p1Indices, sheetW, sheetH, bleedIn, maxSlots, deadline);
    if (!p1Result) continue;
    const p2Result = findBestCustomAllocation(projects, p2Indices, sheetW, sheetH, bleedIn, maxSlots, deadline);
    if (!p2Result) continue;

    const totalSheets = p1Result.runLength + p2Result.runLength;
    if (totalSheets >= bestTotal) continue;
    bestTotal = totalSheets;

    const plate1 = buildCustomPlateResult(projects, p1Indices, p1Result.allocation, p1Result.shapes, p1Result.runLength, sheetW, sheetH, bleedIn, p1Result.placedGroups);
    const plate2 = buildCustomPlateResult(projects, p2Indices, p2Result.allocation, p2Result.shapes, p2Result.runLength, sheetW, sheetH, bleedIn, p2Result.placedGroups);

    const combinedProduced = plate1.totalProduced + plate2.totalProduced;
    const totalOrderQty = projects.reduce((s, p) => s + p.quantity, 0);
    let totalUsedArea = 0;
    for (const alloc of [...plate1.allocation, ...plate2.allocation]) totalUsedArea += alloc.produced * alloc.stickerWidth * alloc.stickerHeight;
    const totalSheetArea = totalSheets * sheetW * sheetH;
    const materialYield = totalSheetArea > 0 ? (totalUsedArea / totalSheetArea) * 100 : 0;

    bestResult = {
      plate1, plate2, totalSheets, totalProduced: combinedProduced,
      totalOverage: combinedProduced - totalOrderQty, materialYield,
      sheetsSaved: 0, plate1ProjectIndices: p1Indices, plate2ProjectIndices: p2Indices,
    };
  }
  return bestResult;
}

// ── Full Calculation ───────────────────────────────────────────────────────

function canProjectFit(p: CustomProject, sheetW: number, sheetH: number, bleedIn: number): boolean {
  if (isTessellated(p.sides)) {
    return tessCapacity(sheetW, sheetH, p.stickerWidth, p.stickerHeight, bleedIn, p.sides) >= 2;
  }
  const cellW = p.stickerWidth + 2 * bleedIn;
  const cellH = p.stickerHeight + 2 * bleedIn;
  return Math.floor(sheetW / cellW) * Math.floor(sheetH / cellH) >= 2;
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
      singlePlateResult: null, twoPlateResult: null, plateSuggestions: emptySuggestions,
      error: "Missing required dimension parameters.",
    };
  }

  const projects = rawProjects.filter((p) => p.quantity > 0 && p.stickerWidth > 0 && p.stickerHeight > 0);
  if (projects.length === 0) {
    return {
      capacity: { maxPerSheet: 0, sheetWidth, sheetHeight },
      singlePlateResult: null, twoPlateResult: null, plateSuggestions: emptySuggestions,
      error: "No projects with positive quantities and valid sticker sizes.",
    };
  }

  // Ensure sides >= 3
  for (const p of projects) {
    if (!p.sides || p.sides < 3) p.sides = 4;
  }

  const bleedIn = bleed / 25.4;

  // Early bail-out: check if each project can fit on the sheet
  const tooLargeProjects: string[] = [];
  for (const p of projects) {
    if (!canProjectFit(p, sheetWidth, sheetHeight, bleedIn)) {
      tooLargeProjects.push(`"${p.name}" (${getPolygonName(p.sides)} ${p.stickerWidth}"×${p.stickerHeight}")`);
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

  // Capacity and max slots
  const minW = Math.min(...projects.map((p) => p.stickerWidth));
  const minH = Math.min(...projects.map((p) => p.stickerHeight));
  const hasTess = projects.some((p) => isTessellated(p.sides));
  const tessSides = projects.find((p) => isTessellated(p.sides))?.sides || 4;
  const maxPerSheet = hasTess
    ? tessCapacity(sheetWidth, sheetHeight, minW, minH, bleedIn, tessSides)
    : Math.floor(sheetWidth / (minW + 2 * bleedIn)) * Math.floor(sheetHeight / (minH + 2 * bleedIn));
  const maxSlots = Math.max(maxPerSheet, projects.length * 2);

  // Build plate suggestions progressively
  const plateSuggestions: PlateSuggestion[] = [];

  let singlePlateResult: CustomPlateResult | null = null;
  if (projects.length * 2 <= maxSlots) {
    const allIndices = projects.map((_, i) => i);
    const result = findBestCustomAllocation(projects, allIndices, sheetWidth, sheetHeight, bleedIn, maxSlots);
    if (result) {
      singlePlateResult = buildCustomPlateResult(projects, allIndices, result.allocation, result.shapes, result.runLength, sheetWidth, sheetHeight, bleedIn, result.placedGroups);
      plateSuggestions.push({ plateCount: 1, feasible: true, totalSheets: singlePlateResult.totalSheets, description: `${singlePlateResult.totalSheets.toLocaleString()} sheets, ${singlePlateResult.runLength.toLocaleString()} run length` });
    } else {
      plateSuggestions.push({ plateCount: 1, feasible: false, totalSheets: 0, description: "Cannot fit all projects on one plate" });
    }
  } else {
    plateSuggestions.push({ plateCount: 1, feasible: false, totalSheets: 0, description: "Cannot fit all projects on one plate" });
  }

  // Two plates
  let twoPlateResult: CustomTwoPlateResult | null = null;
  if (projects.length >= 2) {
    const result = findBestCustomTwoPlate(projects, maxSlots, sheetWidth, sheetHeight, bleedIn);
    if (result) {
      // Calculate sheets saved vs single plate
      if (singlePlateResult) {
        result.sheetsSaved = singlePlateResult.totalSheets - result.totalSheets;
      }
      twoPlateResult = result;
      plateSuggestions.push({ plateCount: 2, feasible: true, totalSheets: result.totalSheets, description: `${result.totalSheets.toLocaleString()} sheets (P1: ${result.plate1.runLength.toLocaleString()} | P2: ${result.plate2.runLength.toLocaleString()})` });
    } else {
      plateSuggestions.push({ plateCount: 2, feasible: false, totalSheets: 0, description: "Two-plate split not found" });
    }
  } else {
    plateSuggestions.push({ plateCount: 2, feasible: false, totalSheets: 0, description: "Need at least 2 projects" });
  }

  // 3+ plate estimates
  for (let k = 3; k <= 4; k++) {
    if (singlePlateResult) {
      plateSuggestions.push({ plateCount: k, feasible: true, totalSheets: singlePlateResult.totalSheets, description: "Unlikely to save sheets vs 1-2 plates" });
    } else if (twoPlateResult) {
      plateSuggestions.push({ plateCount: k, feasible: true, totalSheets: twoPlateResult.totalSheets, description: `Estimated ~${twoPlateResult.totalSheets.toLocaleString()} sheets` });
    } else {
      plateSuggestions.push({ plateCount: k, feasible: false, totalSheets: 0, description: "Cannot fit" });
    }
  }

  return {
    capacity: { maxPerSheet, sheetWidth, sheetHeight },
    singlePlateResult, twoPlateResult, plateSuggestions,
  };
}
