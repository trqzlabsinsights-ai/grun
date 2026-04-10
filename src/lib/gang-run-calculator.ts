// ── Gang Run Calculator — Core Logic ────────────────────────────────────────
// Extracted from route.ts for testability. Pure functions, no Next.js deps.

// ── Types ──────────────────────────────────────────────────────────────────

export interface ProjectInput {
  name: string;
  quantity: number;
}

export interface GroupShape {
  w: number; // stickers across
  h: number; // stickers down
}

export interface PlacedGroup {
  name: string;
  projectIdx: number;
  shape: GroupShape;
  outs: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AllocationEntry {
  name: string;
  quantity: number;
  outs: number;
  produced: number;
  overage: number;
  overagePct: number;
  groupShape: GroupShape;
}

export interface PlateResult {
  allocation: AllocationEntry[];
  runLength: number;
  totalSheets: number;
  totalProduced: number;
  totalOverage: number;
  materialYield: number;
  placedGroups: PlacedGroup[];
}

export interface TwoPlateResult {
  plate1: PlateResult;
  plate2: PlateResult;
  totalSheets: number;
  totalProduced: number;
  totalOverage: number;
  materialYield: number;
  sheetsSaved: number;
  plate1ProjectIndices: number[];
  plate2ProjectIndices: number[];
}

export interface CapacityResult {
  cols: number;
  rows: number;
  maxPerSheet: number;
  cellWidth: number;
  cellHeight: number;
  stickerWidth: number;
  stickerHeight: number;
  bleedInches: number;
  sheetWidth: number;
  sheetHeight: number;
}

// ── Group Shape Utilities ──────────────────────────────────────────────────

interface GroupWithDims {
  name: string;
  projectIdx: number;
  shape: GroupShape;
  outs: number;
  width: number;
  height: number;
}

export function getGroupShapes(outs: number): GroupShape[] {
  const shapes: GroupShape[] = [];
  for (let w = 1; w <= outs; w++) {
    if (outs % w === 0) {
      shapes.push({ w, h: outs / w });
    }
  }
  // Sort by compactness (more square-like first), then by width descending
  shapes.sort((a, b) => {
    const ratioA = Math.max(a.w, a.h) / Math.min(a.w, a.h);
    const ratioB = Math.max(b.w, b.h) / Math.min(b.w, b.h);
    if (ratioA !== ratioB) return ratioA - ratioB;
    return b.w - a.w; // prefer wider shapes
  });
  return shapes;
}

export function groupDimensions(
  shape: GroupShape,
  stickerW: number,
  stickerH: number,
  bleedIn: number
): { width: number; height: number } {
  return {
    width: shape.w * stickerW + 2 * bleedIn,
    height: shape.h * stickerH + 2 * bleedIn,
  };
}

// ── 2D Shelf-Based Packing ─────────────────────────────────────────────────

function shelfPack(
  groups: GroupWithDims[],
  sheetW: number,
  sheetH: number
): PlacedGroup[] | null {
  const placed: PlacedGroup[] = [];
  let shelfY = 0;
  let shelfHeight = 0;
  let cursorX = 0;

  for (const g of groups) {
    if (cursorX + g.width <= sheetW) {
      placed.push({
        name: g.name,
        projectIdx: g.projectIdx,
        shape: g.shape,
        outs: g.outs,
        x: cursorX,
        y: shelfY,
        width: g.width,
        height: g.height,
      });
      cursorX += g.width;
      shelfHeight = Math.max(shelfHeight, g.height);
    } else {
      // Start new shelf
      shelfY += shelfHeight;
      shelfHeight = 0;
      cursorX = 0;

      if (g.width > sheetW) return null;
      if (shelfY + g.height > sheetH) return null;

      placed.push({
        name: g.name,
        projectIdx: g.projectIdx,
        shape: g.shape,
        outs: g.outs,
        x: cursorX,
        y: shelfY,
        width: g.width,
        height: g.height,
      });
      cursorX += g.width;
      shelfHeight = Math.max(shelfHeight, g.height);
    }
  }

  if (shelfY + shelfHeight > sheetH) return null;
  return placed;
}

// Try multiple orderings to find a valid packing
function tryPackGroups(
  groups: GroupWithDims[],
  sheetW: number,
  sheetH: number
): PlacedGroup[] | null {
  // Try multiple sort orderings
  const orderings: GroupWithDims[][] = [
    [...groups].sort((a, b) => b.height - a.height), // tallest first
    [...groups].sort((a, b) => b.width - a.width),   // widest first
    [...groups].sort((a, b) => (b.width * b.height) - (a.width * a.height)), // largest area first
    [...groups].sort((a, b) => a.height - b.height), // shortest first (fill bottom)
    [...groups].sort((a, b) => a.width - b.width),   // narrowest first
  ];

  for (const ordered of orderings) {
    const result = shelfPack(ordered, sheetW, sheetH);
    if (result) return result;
  }
  return null;
}

// ── Shape Combination Packing ──────────────────────────────────────────────

// Try to find a valid packing for a given allocation by trying different shape combinations
function findValidPacking(
  allocation: { name: string; projectIdx: number; outs: number }[],
  sheetW: number,
  sheetH: number,
  stickerW: number,
  stickerH: number,
  bleedIn: number
): { shapes: GroupShape[]; placedGroups: PlacedGroup[] } | null {
  const n = allocation.length;
  const allShapes = allocation.map((a) => getGroupShapes(a.outs));

  // Try shape combinations with a cap on total attempts
  let attempts = 0;
  const maxAttempts = 500;

  function tryCombo(
    idx: number,
    currentShapes: GroupShape[]
  ): { shapes: GroupShape[]; placedGroups: PlacedGroup[] } | null {
    if (idx === n) {
      attempts++;
      if (attempts > maxAttempts) return null;

      const groupsWithDims: GroupWithDims[] = currentShapes.map((shape, i) => {
        const dims = groupDimensions(shape, stickerW, stickerH, bleedIn);
        return {
          name: allocation[i].name,
          projectIdx: allocation[i].projectIdx,
          shape,
          outs: allocation[i].outs,
          width: dims.width,
          height: dims.height,
        };
      });

      // Quick pre-check: no single group can exceed sheet dimensions
      for (const g of groupsWithDims) {
        if (g.width > sheetW || g.height > sheetH) return null;
      }

      const placed = tryPackGroups(groupsWithDims, sheetW, sheetH);
      if (placed) {
        return { shapes: [...currentShapes], placedGroups: placed };
      }
      return null;
    }

    // Try each shape for this project
    const shapesToTry = allShapes[idx].slice(0, 4); // try up to 4 shapes
    for (const shape of shapesToTry) {
      // Pre-check: does this shape fit on the sheet at all?
      const dims = groupDimensions(shape, stickerW, stickerH, bleedIn);
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

// ── Allocation with Group Packing ──────────────────────────────────────────

interface AllocationWithPacking {
  allocation: number[];
  runLength: number;
  shapes: GroupShape[];
  placedGroups: PlacedGroup[];
}

export function findBestAllocationWithPacking(
  demands: number[],
  sheetW: number,
  sheetH: number,
  stickerW: number,
  stickerH: number,
  bleedIn: number,
  maxSlots: number
): AllocationWithPacking | null {
  const n = demands.length;
  if (n === 0) return null;

  const minOuts = 2;
  if (n * minOuts > maxSlots) return null;

  let bestL = Infinity;
  let bestResult: AllocationWithPacking | null = null;
  const current = new Array(n).fill(0);

  function search(idx: number, remaining: number): void {
    if (idx === n - 1) {
      current[idx] = remaining;
      if (remaining < minOuts) return;

      let L = 0;
      for (let i = 0; i < n; i++) {
        L = Math.max(L, Math.ceil(demands[i] / current[i]));
      }
      if (L >= bestL) return;

      // Try to find a valid packing
      const allocInfo = current.map((outs, i) => ({
        name: `p${i}`,
        projectIdx: i,
        outs,
      }));

      const packing = findValidPacking(
        allocInfo, sheetW, sheetH, stickerW, stickerH, bleedIn
      );

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
    const maxVal = remaining - minRemaining;
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

  search(0, maxSlots);
  return bestResult;
}

// ── Build Plate Result ─────────────────────────────────────────────────────

export function buildPlateResult(
  projects: ProjectInput[],
  indices: number[],
  allocation: number[],
  shapes: GroupShape[],
  runLength: number,
  capacity: CapacityResult,
  placedGroups: PlacedGroup[]
): PlateResult {
  const totalProduced = allocation.reduce(
    (sum, outs) => sum + outs * runLength,
    0
  );

  let totalOrderQty = 0;
  const allocationEntries: AllocationEntry[] = indices.map((projIdx, i) => {
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
    };
  });

  const remappedGroups: PlacedGroup[] = placedGroups.map((pg) => {
    const localIdx = parseInt(pg.name.replace("p", ""));
    return {
      ...pg,
      name: projects[indices[localIdx]].name,
      projectIdx: indices[localIdx],
    };
  });

  const stickerArea = capacity.stickerWidth * capacity.stickerHeight;
  const sheetArea = capacity.sheetWidth * capacity.sheetHeight;
  const usedStickerArea = totalProduced * stickerArea;
  const totalSheetArea = runLength * sheetArea;
  const materialYield =
    totalSheetArea > 0 ? (usedStickerArea / totalSheetArea) * 100 : 0;

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

// ── Sheet Capacity ─────────────────────────────────────────────────────────

export function calculateCapacity(
  sheetW: number,
  sheetH: number,
  stickerW: number,
  stickerH: number,
  bleedMm: number
): CapacityResult {
  const bleedIn = bleedMm / 25.4;
  const cellW = stickerW + 2 * bleedIn;
  const cellH = stickerH + 2 * bleedIn;
  const cols = Math.floor(sheetW / cellW);
  const rows = Math.floor(sheetH / cellH);
  return {
    cols,
    rows,
    maxPerSheet: cols * rows,
    cellWidth: cellW,
    cellHeight: cellH,
    stickerWidth: stickerW,
    stickerHeight: stickerH,
    bleedInches: bleedIn,
    sheetWidth: sheetW,
    sheetHeight: sheetH,
  };
}

// ── Two-Plate Optimization with Group Packing ──────────────────────────────

export function findBestTwoPlate(
  projects: ProjectInput[],
  maxSlots: number,
  capacity: CapacityResult
): TwoPlateResult | null {
  const n = projects.length;
  if (n < 2) return null;

  const demands = projects.map((p) => p.quantity);
  let bestTotal = Infinity;
  let bestResult: TwoPlateResult | null = null;

  const totalMasks = 1 << n;
  for (let mask = 1; mask < totalMasks - 1; mask++) {
    if (!(mask & 1)) continue;

    const plate1Indices: number[] = [];
    const plate2Indices: number[] = [];
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) {
        plate1Indices.push(i);
      } else {
        plate2Indices.push(i);
      }
    }

    if (plate1Indices.length === 0 || plate2Indices.length === 0) continue;
    if (plate1Indices.length * 2 > maxSlots || plate2Indices.length * 2 > maxSlots) continue;

    const p1Demands = plate1Indices.map((i) => demands[i]);
    const p1Result = findBestAllocationWithPacking(
      p1Demands,
      capacity.sheetWidth,
      capacity.sheetHeight,
      capacity.stickerWidth,
      capacity.stickerHeight,
      capacity.bleedInches,
      maxSlots
    );
    if (!p1Result) continue;

    const p2Demands = plate2Indices.map((i) => demands[i]);
    const p2Result = findBestAllocationWithPacking(
      p2Demands,
      capacity.sheetWidth,
      capacity.sheetHeight,
      capacity.stickerWidth,
      capacity.stickerHeight,
      capacity.bleedInches,
      maxSlots
    );
    if (!p2Result) continue;

    const totalSheets = p1Result.runLength + p2Result.runLength;
    if (totalSheets >= bestTotal) continue;

    bestTotal = totalSheets;

    const plate1Res = buildPlateResult(
      projects, plate1Indices,
      p1Result.allocation, p1Result.shapes,
      p1Result.runLength, capacity, p1Result.placedGroups
    );
    const plate2Res = buildPlateResult(
      projects, plate2Indices,
      p2Result.allocation, p2Result.shapes,
      p2Result.runLength, capacity, p2Result.placedGroups
    );

    const combinedProduced = plate1Res.totalProduced + plate2Res.totalProduced;
    const totalOrderQty = demands.reduce((s, q) => s + q, 0);
    const stickerArea = capacity.stickerWidth * capacity.stickerHeight;
    const sheetArea = capacity.sheetWidth * capacity.sheetHeight;
    const usedStickerArea = combinedProduced * stickerArea;
    const totalSheetArea = totalSheets * sheetArea;
    const materialYield =
      totalSheetArea > 0 ? (usedStickerArea / totalSheetArea) * 100 : 0;

    bestResult = {
      plate1: plate1Res,
      plate2: plate2Res,
      totalSheets,
      totalProduced: combinedProduced,
      totalOverage: combinedProduced - totalOrderQty,
      materialYield,
      sheetsSaved: 0,
      plate1ProjectIndices: plate1Indices,
      plate2ProjectIndices: plate2Indices,
    };
  }

  return bestResult;
}

// ── Full Calculation ───────────────────────────────────────────────────────

export interface CalculateResponse {
  capacity: CapacityResult;
  singlePlateResult: PlateResult | null;
  twoPlateResult: TwoPlateResult | null;
  error?: string;
}

export function calculate(req: {
  sheetWidth: number;
  sheetHeight: number;
  stickerWidth: number;
  stickerHeight: number;
  bleed: number;
  projects: ProjectInput[];
}): CalculateResponse {
  const { sheetWidth, sheetHeight, stickerWidth, stickerHeight, bleed, projects: rawProjects } = req;

  if (!sheetWidth || !sheetHeight || !stickerWidth || !stickerHeight || bleed == null) {
    return { capacity: {} as CapacityResult, singlePlateResult: null, twoPlateResult: null, error: "Missing required dimension parameters." };
  }

  const projects = rawProjects.filter((p) => p.quantity > 0);
  if (projects.length === 0) {
    return { capacity: {} as CapacityResult, singlePlateResult: null, twoPlateResult: null, error: "No projects with positive quantities." };
  }

  const capacity = calculateCapacity(sheetWidth, sheetHeight, stickerWidth, stickerHeight, bleed);

  if (capacity.maxPerSheet === 0) {
    return { capacity, singlePlateResult: null, twoPlateResult: null, error: "Sticker size exceeds sheet capacity." };
  }

  // Single plate optimization with group packing
  let singlePlateResult: PlateResult | null = null;
  if (projects.length * 2 <= capacity.maxPerSheet) {
    const demands = projects.map((p) => p.quantity);
    const result = findBestAllocationWithPacking(
      demands,
      capacity.sheetWidth,
      capacity.sheetHeight,
      capacity.stickerWidth,
      capacity.stickerHeight,
      capacity.bleedInches,
      capacity.maxPerSheet
    );
    if (result) {
      singlePlateResult = buildPlateResult(
        projects,
        projects.map((_, i) => i),
        result.allocation,
        result.shapes,
        result.runLength,
        capacity,
        result.placedGroups
      );
    }
  }

  // Two plate optimization with group packing
  let twoPlateResult: TwoPlateResult | null = null;
  if (projects.length >= 2) {
    twoPlateResult = findBestTwoPlate(projects, capacity.maxPerSheet, capacity);
  }

  if (twoPlateResult && singlePlateResult) {
    twoPlateResult.sheetsSaved = singlePlateResult.totalSheets - twoPlateResult.totalSheets;
  }

  return { capacity, singlePlateResult, twoPlateResult };
}
