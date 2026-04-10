// ── Same-Size Rectangle Packer ───────────────────────────────────────────────
// All stickers have the same W×H dimensions. Uses grid-based capacity
// with exhaustive allocation search. Clean standalone file.

// ── Types ──────────────────────────────────────────────────────────────────

export interface SameRectProject {
  name: string;
  quantity: number;
  // stickerWidth and stickerHeight are the SAME for all projects
}

export interface GroupShape {
  w: number;
  h: number;
}

export interface SameRectAllocationEntry {
  name: string;
  quantity: number;
  outs: number;
  produced: number;
  overage: number;
  overagePct: number;
  groupShape: GroupShape;
}

export interface PlacedRectGroup {
  name: string;
  projectIdx: number;
  shape: GroupShape;
  outs: number;
  x: number;
  y: number;
  width: number;
  height: number;
  itemType: "rect-same";
}

export interface SameRectPlateResult {
  allocation: SameRectAllocationEntry[];
  runLength: number;
  totalSheets: number;
  totalProduced: number;
  totalOverage: number;
  materialYield: number;
  placedGroups: PlacedRectGroup[];
}

export interface SameRectTwoPlateResult {
  plate1: SameRectPlateResult;
  plate2: SameRectPlateResult;
  totalSheets: number;
  totalProduced: number;
  totalOverage: number;
  materialYield: number;
  sheetsSaved: number;
  plate1ProjectIndices: number[];
  plate2ProjectIndices: number[];
}

export interface SameRectCalculateResponse {
  capacity: { cols: number; rows: number; maxPerSheet: number; stickerWidth: number; stickerHeight: number; bleedInches: number; sheetWidth: number; sheetHeight: number };
  singlePlateResult: SameRectPlateResult | null;
  twoPlateResult: SameRectTwoPlateResult | null;
  error?: string;
}

// ── Capacity ───────────────────────────────────────────────────────────────

function calculateCapacity(
  sheetW: number,
  sheetH: number,
  stickerW: number,
  stickerH: number,
  bleedMm: number
) {
  const bleedIn = bleedMm / 25.4;
  const cellW = stickerW + 2 * bleedIn;
  const cellH = stickerH + 2 * bleedIn;
  const cols = Math.floor(sheetW / cellW);
  const rows = Math.floor(sheetH / cellH);
  return { cols, rows, maxPerSheet: cols * rows, cellW, cellH, bleedIn };
}

// ── Group Shapes ───────────────────────────────────────────────────────────

function getGroupShapes(outs: number): GroupShape[] {
  const shapes: GroupShape[] = [];
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

function groupDims(shape: GroupShape, stickerW: number, stickerH: number, bleedIn: number) {
  return {
    width: shape.w * stickerW + 2 * bleedIn,
    height: shape.h * stickerH + 2 * bleedIn,
  };
}

// ── Grid Packing (same-size stickers) ──────────────────────────────────────

function gridPack(
  allocation: { name: string; projectIdx: number; outs: number; shape: GroupShape }[],
  sheetW: number,
  sheetH: number,
  stickerW: number,
  stickerH: number,
  bleedIn: number
): PlacedRectGroup[] | null {
  const placed: PlacedRectGroup[] = [];
  let cursorX = 0;
  let cursorY = 0;
  let rowHeight = 0;

  const sorted = [...allocation].sort((a, b) => {
    const dimsA = groupDims(a.shape, stickerW, stickerH, bleedIn);
    const dimsB = groupDims(b.shape, stickerW, stickerH, bleedIn);
    return dimsB.height - dimsA.height;
  });

  for (const alloc of sorted) {
    const dims = groupDims(alloc.shape, stickerW, stickerH, bleedIn);

    if (cursorX + dims.width > sheetW) {
      cursorX = 0;
      cursorY += rowHeight;
      rowHeight = 0;
    }

    if (cursorY + dims.height > sheetH) return null;
    if (dims.width > sheetW) return null;

    placed.push({
      name: alloc.name,
      projectIdx: alloc.projectIdx,
      shape: alloc.shape,
      outs: alloc.outs,
      x: cursorX,
      y: cursorY,
      width: dims.width,
      height: dims.height,
      itemType: "rect-same",
    });

    cursorX += dims.width;
    rowHeight = Math.max(rowHeight, dims.height);
  }

  return placed;
}

// ── Allocation Search ──────────────────────────────────────────────────────

function findBestAllocation(
  demands: number[],
  maxSlots: number,
  sheetW: number,
  sheetH: number,
  stickerW: number,
  stickerH: number,
  bleedIn: number
): { allocation: number[]; runLength: number; shapes: GroupShape[]; placedGroups: PlacedRectGroup[] } | null {
  const n = demands.length;
  const minOuts = 2;
  const minTotal = n * minOuts;
  if (minTotal > maxSlots) return null;

  let bestL = Infinity;
  let bestResult: any = null;

  for (let total = maxSlots; total >= minTotal; total--) {
    const current = new Array(n).fill(0);

    function search(idx: number, remaining: number): void {
      if (idx === n - 1) {
        current[idx] = remaining;
        if (remaining < minOuts || remaining > maxSlots) return;

        let L = 0;
        for (let i = 0; i < n; i++) L = Math.max(L, Math.ceil(demands[i] / current[i]));
        if (L >= bestL) return;

        // Try group shapes and pack
        const allShapes = current.map((outs) => getGroupShapes(outs));
        const tryShapes = (si: number, shapes: GroupShape[]): boolean => {
          if (si === n) {
            const allocInfo = current.map((outs, i) => ({
              name: `p${i}`, projectIdx: i, outs, shape: shapes[i],
            }));
            const placed = gridPack(allocInfo, sheetW, sheetH, stickerW, stickerH, bleedIn);
            if (placed) {
              bestL = L;
              bestResult = { allocation: [...current], runLength: L, shapes: [...shapes], placedGroups: placed };
              return true;
            }
            return false;
          }
          for (const shape of allShapes[si].slice(0, 4)) {
            shapes.push(shape);
            if (tryShapes(si + 1, shapes)) return true;
            shapes.pop();
          }
          return false;
        };

        tryShapes(0, []);
        return;
      }

      const minRemaining = (n - idx - 1) * minOuts;
      for (let val = minOuts; val <= remaining - minRemaining; val++) {
        current[idx] = val;
        let partialL = 0;
        for (let i = 0; i <= idx; i++) partialL = Math.max(partialL, Math.ceil(demands[i] / current[i]));
        if (partialL >= bestL) continue;
        search(idx + 1, remaining - val);
      }
    }

    search(0, total);
  }

  return bestResult;
}

// ── Build Plate Result ─────────────────────────────────────────────────────

function buildResult(
  projects: SameRectProject[],
  indices: number[],
  allocation: number[],
  shapes: GroupShape[],
  runLength: number,
  stickerW: number,
  stickerH: number,
  sheetW: number,
  sheetH: number,
  bleedIn: number,
  placedGroups: PlacedRectGroup[]
): SameRectPlateResult {
  const totalProduced = allocation.reduce((s, o) => s + o * runLength, 0);
  let totalQty = 0;

  const entries: SameRectAllocationEntry[] = indices.map((pi, i) => {
    const qty = projects[pi].quantity;
    const outs = allocation[i];
    const produced = outs * runLength;
    totalQty += qty;
    return {
      name: projects[pi].name, quantity: qty, outs, produced,
      overage: produced - qty, overagePct: qty > 0 ? ((produced - qty) / qty) * 100 : 0,
      groupShape: shapes[i],
    };
  });

  const remapped = placedGroups.map((pg) => {
    const li = parseInt(pg.name.replace("p", ""));
    return { ...pg, name: projects[indices[li]].name, projectIdx: indices[li] };
  });

  const stickerArea = totalProduced * stickerW * stickerH;
  const sheetArea = runLength * sheetW * sheetH;

  return {
    allocation: entries, runLength, totalSheets: runLength, totalProduced,
    totalOverage: totalProduced - totalQty,
    materialYield: sheetArea > 0 ? (stickerArea / sheetArea) * 100 : 0,
    placedGroups: remapped,
  };
}

// ── Two-Plate Optimization ────────────────────────────────────────────────

function findTwoPlate(
  projects: SameRectProject[],
  maxSlots: number,
  sheetW: number,
  sheetH: number,
  stickerW: number,
  stickerH: number,
  bleedIn: number
): SameRectTwoPlateResult | null {
  const n = projects.length;
  if (n < 2) return null;

  let bestTotal = Infinity;
  let bestResult: SameRectTwoPlateResult | null = null;

  for (let mask = 1; mask < (1 << n) - 1; mask++) {
    if (!(mask & 1)) continue;
    const p1: number[] = [], p2: number[] = [];
    for (let i = 0; i < n; i++) (mask & (1 << i) ? p1 : p2).push(i);
    if (!p1.length || !p2.length) continue;

    const r1 = findBestAllocation(p1.map(i => projects[i].quantity), maxSlots, sheetW, sheetH, stickerW, stickerH, bleedIn);
    if (!r1) continue;
    const r2 = findBestAllocation(p2.map(i => projects[i].quantity), maxSlots, sheetW, sheetH, stickerW, stickerH, bleedIn);
    if (!r2) continue;

    const total = r1.runLength + r2.runLength;
    if (total >= bestTotal) continue;
    bestTotal = total;

    const plate1 = buildResult(projects, p1, r1.allocation, r1.shapes, r1.runLength, stickerW, stickerH, sheetW, sheetH, bleedIn, r1.placedGroups);
    const plate2 = buildResult(projects, p2, r2.allocation, r2.shapes, r2.runLength, stickerW, stickerH, sheetW, sheetH, bleedIn, r2.placedGroups);

    const combined = plate1.totalProduced + plate2.totalProduced;
    const totalQty = projects.reduce((s, p) => s + p.quantity, 0);
    const stickerArea = combined * stickerW * stickerH;
    const sheetArea = total * sheetW * sheetH;

    bestResult = {
      plate1, plate2, totalSheets: total, totalProduced: combined,
      totalOverage: combined - totalQty,
      materialYield: sheetArea > 0 ? (stickerArea / sheetArea) * 100 : 0,
      sheetsSaved: 0, plate1ProjectIndices: p1, plate2ProjectIndices: p2,
    };
  }
  return bestResult;
}

// ── Full Calculation ───────────────────────────────────────────────────────

export function calculateSameRect(req: {
  sheetWidth: number;
  sheetHeight: number;
  bleed: number;
  stickerWidth: number;
  stickerHeight: number;
  projects: SameRectProject[];
}): SameRectCalculateResponse {
  const { sheetWidth, sheetHeight, bleed, stickerWidth, stickerHeight, projects: rawProjects } = req;

  if (!sheetWidth || !sheetHeight || !stickerWidth || !stickerHeight) {
    return { capacity: { cols: 0, rows: 0, maxPerSheet: 0, stickerWidth, stickerHeight, bleedInches: 0, sheetWidth, sheetHeight }, singlePlateResult: null, twoPlateResult: null, error: "Missing required parameters." };
  }

  const projects = rawProjects.filter((p) => p.quantity > 0);
  if (projects.length === 0) {
    return { capacity: { cols: 0, rows: 0, maxPerSheet: 0, stickerWidth, stickerHeight, bleedInches: 0, sheetWidth, sheetHeight }, singlePlateResult: null, twoPlateResult: null, error: "No projects with positive quantities." };
  }

  const { cols, rows, maxPerSheet, bleedIn } = calculateCapacity(sheetWidth, sheetHeight, stickerWidth, stickerHeight, bleed);

  let singlePlateResult: SameRectPlateResult | null = null;
  const demands = projects.map((p) => p.quantity);
  const result = findBestAllocation(demands, maxPerSheet, sheetWidth, sheetHeight, stickerWidth, stickerHeight, bleedIn);
  if (result) {
    singlePlateResult = buildResult(projects, projects.map((_, i) => i), result.allocation, result.shapes, result.runLength, stickerWidth, stickerHeight, sheetWidth, sheetHeight, bleedIn, result.placedGroups);
  }

  let twoPlateResult: SameRectTwoPlateResult | null = null;
  if (projects.length >= 2) {
    twoPlateResult = findTwoPlate(projects, maxPerSheet, sheetWidth, sheetHeight, stickerWidth, stickerHeight, bleedIn);
  }

  if (twoPlateResult && singlePlateResult) {
    twoPlateResult.sheetsSaved = singlePlateResult.totalSheets - twoPlateResult.totalSheets;
  }

  return {
    capacity: { cols, rows, maxPerSheet, stickerWidth, stickerHeight, bleedInches: bleedIn, sheetWidth, sheetHeight },
    singlePlateResult,
    twoPlateResult,
  };
}
