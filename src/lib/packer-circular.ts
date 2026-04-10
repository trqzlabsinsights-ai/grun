// ── Circular Packer — Hexagonal/Diamond Packing for Circle Stickers ──────────
// Each project has a circle diameter. Groups are rectangular regions of
// hex-packed circles. Groups are placed on the sheet using MaxRect.
// Supports equal and mixed circle diameters.

import {
  maxRectPack,
  type GroupWithDims,
} from "./gang-run-calculator-v2";

// ── Types ──────────────────────────────────────────────────────────────────

export interface CircleProject {
  name: string;
  quantity: number;
  diameter: number; // inches
}

export interface HexGroupShape {
  w: number; // columns (even rows)
  h: number; // rows
}

export interface PlacedCircleGroup {
  name: string;
  projectIdx: number;
  shape: HexGroupShape;
  outs: number;
  x: number;           // bounding box top-left x
  y: number;           // bounding box top-left y
  width: number;       // bounding box width
  height: number;      // bounding box height
  diameter: number;    // circle diameter (sticker, no bleed)
  bleedIn: number;     // bleed in inches
  itemType: "circle";
  circles: { cx: number; cy: number }[]; // absolute positions on sheet
}

export interface CircleAllocationEntry {
  name: string;
  quantity: number;
  outs: number;
  produced: number;
  overage: number;
  overagePct: number;
  groupShape: HexGroupShape;
  diameter: number;
}

export interface CirclePlateResult {
  allocation: CircleAllocationEntry[];
  runLength: number;
  totalSheets: number;
  totalProduced: number;
  totalOverage: number;
  materialYield: number;
  placedGroups: PlacedCircleGroup[];
}

export interface CircleTwoPlateResult {
  plate1: CirclePlateResult;
  plate2: CirclePlateResult;
  totalSheets: number;
  totalProduced: number;
  totalOverage: number;
  materialYield: number;
  sheetsSaved: number;
  plate1ProjectIndices: number[];
  plate2ProjectIndices: number[];
}

export interface CircleCalculateResponse {
  capacity: { maxPerSheet: number; diameter: number; bleedInches: number; sheetWidth: number; sheetHeight: number };
  singlePlateResult: CirclePlateResult | null;
  twoPlateResult: CircleTwoPlateResult | null;
  error?: string;
}

// ── Hex Packing Utilities ──────────────────────────────────────────────────

/**
 * Count circles that fit on a sheet using hexagonal/diamond packing.
 * Even rows start at x = cellD/2; odd rows offset by cellD/2 (diamond pattern).
 */
export function hexCapacity(
  sheetW: number,
  sheetH: number,
  diameter: number,
  bleedIn: number
): number {
  const cellD = diameter + 2 * bleedIn;
  const rowHeight = cellD * Math.sqrt(3) / 2;

  let count = 0;
  let y = cellD / 2;
  let row = 0;

  while (y + cellD / 2 <= sheetH + 0.001) {
    const offset = row % 2 === 1 ? cellD / 2 : 0;
    let x = cellD / 2 + offset;

    while (x + cellD / 2 <= sheetW + 0.001) {
      count++;
      x += cellD;
    }

    y += rowHeight;
    row++;
  }

  return count;
}

/**
 * Count circles in a hex group of w columns × h rows.
 * Even rows: w circles. Odd rows: w-1 circles (offset).
 */
export function hexGroupCount(w: number, h: number): number {
  let count = 0;
  for (let row = 0; row < h; row++) {
    count += row % 2 === 1 ? Math.max(w - 1, 0) : w;
  }
  return count;
}

/**
 * Compute bounding-box dimensions for a hex group of w×h circles.
 */
export function hexGroupDimensions(
  w: number,
  h: number,
  diameter: number,
  bleedIn: number
): { width: number; height: number } {
  const cellD = diameter + 2 * bleedIn;
  const rowHeight = cellD * Math.sqrt(3) / 2;

  // Width: even rows span w * cellD, odd rows (offset) are within that span
  // plus bleed margins on both sides
  const width = w * cellD + 2 * bleedIn;
  // Height: first row full cellD, subsequent rows at rowHeight spacing, plus bleed
  const height = (h - 1) * rowHeight + cellD + 2 * bleedIn;

  return { width, height };
}

/**
 * Generate absolute circle center positions for a hex group placed at (x0, y0).
 */
export function hexGroupCircles(
  w: number,
  h: number,
  diameter: number,
  bleedIn: number,
  x0: number,
  y0: number
): { cx: number; cy: number }[] {
  const cellD = diameter + 2 * bleedIn;
  const rowHeight = cellD * Math.sqrt(3) / 2;
  const circles: { cx: number; cy: number }[] = [];

  for (let row = 0; row < h; row++) {
    const colsInRow = row % 2 === 1 ? Math.max(w - 1, 0) : w;
    const offset = row % 2 === 1 ? cellD / 2 : 0;

    for (let col = 0; col < colsInRow; col++) {
      const cx = x0 + bleedIn + cellD / 2 + col * cellD + offset;
      const cy = y0 + bleedIn + cellD / 2 + row * rowHeight;
      circles.push({ cx, cy });
    }
  }

  return circles;
}

/**
 * Enumerate valid hex group shapes for a given number of outs.
 * Returns shapes sorted by compactness (closest to square ratio).
 */
export function getHexGroupShapes(outs: number): HexGroupShape[] {
  const shapes: HexGroupShape[] = [];

  for (let h = 1; h <= outs; h++) {
    for (let w = 1; w <= outs; w++) {
      const count = hexGroupCount(w, h);
      if (count >= outs) {
        shapes.push({ w, h });
      }
      if (count > outs + 4) break; // don't go too far past target
    }
  }

  shapes.sort((a, b) => {
    const wastedA = hexGroupCount(a.w, a.h) - outs;
    const wastedB = hexGroupCount(b.w, b.h) - outs;
    if (wastedA !== wastedB) return wastedA - wastedB;
    const ratioA = Math.max(a.w, a.h) / Math.min(a.w, a.h);
    const ratioB = Math.max(b.w, b.h) / Math.min(b.w, b.h);
    return ratioA - ratioB;
  });

  return shapes.slice(0, 8);
}

// ── Circle-Specific MaxRect Packing ────────────────────────────────────────

interface CircleGroupWithDims {
  name: string;
  projectIdx: number;
  shape: HexGroupShape;
  outs: number;
  width: number;
  height: number;
  diameter: number;
  bleedIn: number;
}

function tryPackCircleGroups(
  groups: CircleGroupWithDims[],
  sheetW: number,
  sheetH: number
): PlacedCircleGroup[] | null {
  // Convert to generic GroupWithDims for MaxRect
  const genericGroups: GroupWithDims[] = groups.map((g) => ({
    name: g.name,
    projectIdx: g.projectIdx,
    shape: { w: g.shape.w, h: g.shape.h },
    outs: g.outs,
    width: g.width,
    height: g.height,
    stickerWidth: g.diameter,
    stickerHeight: g.diameter,
  }));

  const placed = maxRectPack(genericGroups, sheetW, sheetH);
  if (!placed) return null;

  // Convert back to PlacedCircleGroup with circle positions
  return placed.map((pg) => {
    const group = groups.find(
      (g) => g.name === pg.name && g.projectIdx === pg.projectIdx
    )!;
    const circles = hexGroupCircles(
      pg.shape.w, pg.shape.h,
      group.diameter, group.bleedIn,
      pg.x, pg.y
    );
    return {
      name: pg.name,
      projectIdx: pg.projectIdx,
      shape: { w: pg.shape.w, h: pg.shape.h },
      outs: pg.outs,
      x: pg.x,
      y: pg.y,
      width: pg.width,
      height: pg.height,
      diameter: group.diameter,
      bleedIn: group.bleedIn,
      itemType: "circle" as const,
      circles,
    };
  });
}

// ── Shape Combination Packing ──────────────────────────────────────────────

function findValidCirclePacking(
  allocation: { name: string; projectIdx: number; outs: number; diameter: number }[],
  sheetW: number,
  sheetH: number,
  bleedIn: number
): { shapes: HexGroupShape[]; placedGroups: PlacedCircleGroup[] } | null {
  const n = allocation.length;
  const allShapes = allocation.map((a) => getHexGroupShapes(a.outs));

  let attempts = 0;
  const maxAttempts = 500;

  function tryCombo(
    idx: number,
    currentShapes: HexGroupShape[]
  ): { shapes: HexGroupShape[]; placedGroups: PlacedCircleGroup[] } | null {
    if (idx === n) {
      attempts++;
      if (attempts > maxAttempts) return null;

      const groupsWithDims: CircleGroupWithDims[] = currentShapes.map((shape, i) => {
        const dims = hexGroupDimensions(shape.w, shape.h, allocation[i].diameter, bleedIn);
        return {
          name: allocation[i].name,
          projectIdx: allocation[i].projectIdx,
          shape,
          outs: allocation[i].outs,
          width: dims.width,
          height: dims.height,
          diameter: allocation[i].diameter,
          bleedIn,
        };
      });

      for (const g of groupsWithDims) {
        if (g.width > sheetW || g.height > sheetH) return null;
      }

      const placed = tryPackCircleGroups(groupsWithDims, sheetW, sheetH);
      if (placed) {
        return { shapes: [...currentShapes], placedGroups: placed };
      }
      return null;
    }

    const shapesToTry = allShapes[idx].slice(0, 4);
    for (const shape of shapesToTry) {
      const dims = hexGroupDimensions(shape.w, shape.h, allocation[idx].diameter, bleedIn);
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

// ── Allocation with Circle Packing ─────────────────────────────────────────

interface CircleAllocationWithPacking {
  allocation: number[];
  runLength: number;
  shapes: HexGroupShape[];
  placedGroups: PlacedCircleGroup[];
}

function findBestCircleAllocation(
  demands: number[],
  diameters: number[],
  sheetW: number,
  sheetH: number,
  bleedIn: number,
  maxSlots: number
): CircleAllocationWithPacking | null {
  const n = demands.length;
  if (n === 0) return null;

  const minOuts = 2;
  const minTotal = n * minOuts;
  if (minTotal > maxSlots) return null;

  // Per-project max outs based on hex capacity for that diameter alone
  const perProjectMax = diameters.map((d) => {
    const cap = hexCapacity(sheetW, sheetH, d, bleedIn);
    return Math.max(cap, minOuts);
  });

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
  let bestResult: CircleAllocationWithPacking | null = null;

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

        const allocInfo = current.map((outs, i) => ({
          name: `p${i}`,
          projectIdx: i,
          outs,
          diameter: diameters[i],
        }));

        const packing = findValidCirclePacking(allocInfo, sheetW, sheetH, bleedIn);

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

function buildCirclePlateResult(
  projects: CircleProject[],
  indices: number[],
  allocation: number[],
  shapes: HexGroupShape[],
  runLength: number,
  sheetW: number,
  sheetH: number,
  bleedIn: number,
  placedGroups: PlacedCircleGroup[]
): CirclePlateResult {
  const totalProduced = allocation.reduce((sum, outs) => sum + outs * runLength, 0);
  let totalOrderQty = 0;

  const allocationEntries: CircleAllocationEntry[] = indices.map((projIdx, i) => {
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
      diameter: projects[projIdx].diameter,
    };
  });

  // Remap placed groups to use actual project names
  const remappedGroups: PlacedCircleGroup[] = placedGroups.map((pg) => {
    const localIdx = parseInt(pg.name.replace("p", ""));
    return {
      ...pg,
      name: projects[indices[localIdx]].name,
      projectIdx: indices[localIdx],
    };
  });

  // Material yield: total circle area / total sheet area
  let totalCircleArea = 0;
  for (const alloc of allocationEntries) {
    totalCircleArea += alloc.produced * Math.PI * (alloc.diameter / 2) ** 2;
  }
  const totalSheetArea = runLength * sheetW * sheetH;
  const materialYield = totalSheetArea > 0 ? (totalCircleArea / totalSheetArea) * 100 : 0;

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

function findBestCircleTwoPlate(
  projects: CircleProject[],
  maxSlots: number,
  sheetW: number,
  sheetH: number,
  bleedIn: number
): CircleTwoPlateResult | null {
  const n = projects.length;
  if (n < 2) return null;

  const demands = projects.map((p) => p.quantity);
  const diameters = projects.map((p) => p.diameter);

  let bestTotal = Infinity;
  let bestResult: CircleTwoPlateResult | null = null;

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

    const p1Demands = p1Indices.map((i) => demands[i]);
    const p1Diameters = p1Indices.map((i) => diameters[i]);
    const p1MaxSlots = Math.min(maxSlots, hexCapacity(sheetW, sheetH, Math.min(...p1Diameters), bleedIn) * 2);
    const p1Result = findBestCircleAllocation(p1Demands, p1Diameters, sheetW, sheetH, bleedIn, p1MaxSlots);
    if (!p1Result) continue;

    const p2Demands = p2Indices.map((i) => demands[i]);
    const p2Diameters = p2Indices.map((i) => diameters[i]);
    const p2MaxSlots = Math.min(maxSlots, hexCapacity(sheetW, sheetH, Math.min(...p2Diameters), bleedIn) * 2);
    const p2Result = findBestCircleAllocation(p2Demands, p2Diameters, sheetW, sheetH, bleedIn, p2MaxSlots);
    if (!p2Result) continue;

    const totalSheets = p1Result.runLength + p2Result.runLength;
    if (totalSheets >= bestTotal) continue;

    bestTotal = totalSheets;

    const plate1Res = buildCirclePlateResult(
      projects, p1Indices, p1Result.allocation, p1Result.shapes,
      p1Result.runLength, sheetW, sheetH, bleedIn, p1Result.placedGroups
    );
    const plate2Res = buildCirclePlateResult(
      projects, p2Indices, p2Result.allocation, p2Result.shapes,
      p2Result.runLength, sheetW, sheetH, bleedIn, p2Result.placedGroups
    );

    const combinedProduced = plate1Res.totalProduced + plate2Res.totalProduced;
    const totalOrderQty = demands.reduce((s, q) => s + q, 0);

    let totalCircleArea = 0;
    for (const alloc of [...plate1Res.allocation, ...plate2Res.allocation]) {
      totalCircleArea += alloc.produced * Math.PI * (alloc.diameter / 2) ** 2;
    }
    const totalSheetArea = totalSheets * sheetW * sheetH;
    const materialYield = totalSheetArea > 0 ? (totalCircleArea / totalSheetArea) * 100 : 0;

    bestResult = {
      plate1: plate1Res,
      plate2: plate2Res,
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

export function calculateCircular(req: {
  sheetWidth: number;
  sheetHeight: number;
  bleed: number;
  projects: CircleProject[];
}): CircleCalculateResponse {
  const { sheetWidth, sheetHeight, bleed, projects: rawProjects } = req;

  if (!sheetWidth || !sheetHeight || bleed == null) {
    return {
      capacity: { maxPerSheet: 0, diameter: 0, bleedInches: 0, sheetWidth, sheetHeight },
      singlePlateResult: null,
      twoPlateResult: null,
      error: "Missing required dimension parameters.",
    };
  }

  const projects = rawProjects.filter((p) => p.quantity > 0 && p.diameter > 0);
  if (projects.length === 0) {
    return {
      capacity: { maxPerSheet: 0, diameter: 0, bleedInches: 0, sheetWidth, sheetHeight },
      singlePlateResult: null,
      twoPlateResult: null,
      error: "No projects with positive quantities and valid diameters.",
    };
  }

  const bleedIn = bleed / 25.4;

  // Capacity based on first project's diameter
  const capDiameter = projects[0].diameter;
  const maxPerSheet = hexCapacity(sheetWidth, sheetHeight, capDiameter, bleedIn);

  // Max slots: based on smallest diameter (most circles possible)
  const minDiameter = Math.min(...projects.map((p) => p.diameter));
  const maxSlots = Math.max(
    hexCapacity(sheetWidth, sheetHeight, minDiameter, bleedIn),
    projects.length * 2
  );

  // Single plate
  let singlePlateResult: CirclePlateResult | null = null;
  if (projects.length * 2 <= maxSlots) {
    const demands = projects.map((p) => p.quantity);
    const diameters = projects.map((p) => p.diameter);
    const result = findBestCircleAllocation(demands, diameters, sheetWidth, sheetHeight, bleedIn, maxSlots);
    if (result) {
      singlePlateResult = buildCirclePlateResult(
        projects,
        projects.map((_, i) => i),
        result.allocation,
        result.shapes,
        result.runLength,
        sheetWidth, sheetHeight, bleedIn,
        result.placedGroups
      );
    }
  }

  // Two plate
  let twoPlateResult: CircleTwoPlateResult | null = null;
  if (projects.length >= 2) {
    twoPlateResult = findBestCircleTwoPlate(projects, maxSlots, sheetWidth, sheetHeight, bleedIn);
  }

  if (twoPlateResult && singlePlateResult) {
    twoPlateResult.sheetsSaved = singlePlateResult.totalSheets - twoPlateResult.totalSheets;
  }

  return {
    capacity: { maxPerSheet, diameter: capDiameter, bleedInches: bleedIn, sheetWidth, sheetHeight },
    singlePlateResult,
    twoPlateResult,
  };
}
