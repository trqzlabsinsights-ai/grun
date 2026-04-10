// ── Gang Run Calculator — Multi-Size Core Logic ────────────────────────────
// Supports per-project sticker dimensions with MaxRect 2D bin packing.
// Pure functions, no Next.js deps.

// ── Types ──────────────────────────────────────────────────────────────────

export interface ProjectInput {
  name: string;
  quantity: number;
  stickerWidth: number;  // inches — each project can have its own size
  stickerHeight: number; // inches
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
  stickerWidth: number;
  stickerHeight: number;
}

export interface AllocationEntry {
  name: string;
  quantity: number;
  outs: number;
  produced: number;
  overage: number;
  overagePct: number;
  groupShape: GroupShape;
  stickerWidth: number;
  stickerHeight: number;
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
  stickerWidth: number;
  stickerHeight: number;
}

export function getGroupShapes(outs: number): GroupShape[] {
  const shapes: GroupShape[] = [];
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

// ── MaxRect 2D Bin Packing ────────────────────────────────────────────────
// Implements the Maximal Rectangles algorithm with Best Short Side Fit (BSSF).

interface MaxRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PlacedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function maxRectPack(
  groups: GroupWithDims[],
  sheetW: number,
  sheetH: number
): PlacedGroup[] | null {
  // Try multiple orderings of the groups
  const orderings: GroupWithDims[][] = [
    [...groups].sort((a, b) => b.height - a.height),           // tallest first
    [...groups].sort((a, b) => b.width - a.width),             // widest first
    [...groups].sort((a, b) => (b.width * b.height) - (a.width * a.height)), // largest area first
    [...groups].sort((a, b) => a.height - b.height),           // shortest first
    [...groups].sort((a, b) => a.width - b.width),             // narrowest first
    [...groups].sort((a, b) => {                                 // tallest first, then widest
      if (b.height !== a.height) return b.height - a.height;
      return b.width - a.width;
    }),
  ];

  for (const ordered of orderings) {
    const result = maxRectPackOneOrder(ordered, sheetW, sheetH);
    if (result) return result;
  }
  return null;
}

function maxRectPackOneOrder(
  groups: GroupWithDims[],
  sheetW: number,
  sheetH: number
): PlacedGroup[] | null {
  // Initialize free rectangles as the entire sheet
  let freeRects: MaxRect[] = [{ x: 0, y: 0, width: sheetW, height: sheetH }];
  const placed: PlacedGroup[] = [];

  for (const group of groups) {
    // Find the best free rectangle for this group using BSSF
    const result = findBestFreeRect(freeRects, group.width, group.height, sheetW, sheetH);

    if (!result) {
      // Can't place this group — packing fails for this ordering
      return null;
    }

    // Safety bounds check
    if (result.x + group.width > sheetW || result.y + group.height > sheetH) {
      return null;
    }

    // Place the group
    placed.push({
      name: group.name,
      projectIdx: group.projectIdx,
      shape: group.shape,
      outs: group.outs,
      x: result.x,
      y: result.y,
      width: group.width,
      height: group.height,
      stickerWidth: group.stickerWidth,
      stickerHeight: group.stickerHeight,
    });

    // Split the free rectangles
    freeRects = splitFreeRects(freeRects, result.x, result.y, group.width, group.height);

    // Prune contained free rectangles
    freeRects = pruneFreeRects(freeRects);
  }

  return placed;
}

function findBestFreeRect(
  freeRects: MaxRect[],
  rectW: number,
  rectH: number,
  sheetW: number,
  sheetH: number
): { x: number; y: number } | null {
  let bestScore = Infinity;
  let bestRect: { x: number; y: number } | null = null;

  for (const fr of freeRects) {
    // Try placing without rotation
    if (rectW <= fr.width && rectH <= fr.height) {
      // Verify placement stays within sheet bounds
      if (fr.x + rectW <= sheetW && fr.y + rectH <= sheetH) {
        const shortSideFit = Math.min(fr.width - rectW, fr.height - rectH);
        if (shortSideFit < bestScore) {
          bestScore = shortSideFit;
          bestRect = { x: fr.x, y: fr.y };
        }
      }
    }
    // Rotation is handled at the group shape level (getGroupShapes returns
    // both w×h and h×w shapes), so we don't need to try rotation here.
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
    // Check if the placed rectangle intersects with this free rectangle
    if (
      placedX >= fr.x + fr.width ||
      placedX + placedW <= fr.x ||
      placedY >= fr.y + fr.height ||
      placedY + placedH <= fr.y
    ) {
      // No intersection — keep this free rectangle
      result.push(fr);
      continue;
    }

    // Split the free rectangle around the placed rectangle

    // Left part
    if (placedX > fr.x) {
      result.push({
        x: fr.x,
        y: fr.y,
        width: placedX - fr.x,
        height: fr.height,
      });
    }

    // Right part
    if (placedX + placedW < fr.x + fr.width) {
      result.push({
        x: placedX + placedW,
        y: fr.y,
        width: fr.x + fr.width - placedX - placedW,
        height: fr.height,
      });
    }

    // Top part
    if (placedY > fr.y) {
      result.push({
        x: fr.x,
        y: fr.y,
        width: fr.width,
        height: placedY - fr.y,
      });
    }

    // Bottom part
    if (placedY + placedH < fr.y + fr.height) {
      result.push({
        x: fr.x,
        y: placedY + placedH,
        width: fr.width,
        height: fr.y + fr.height - placedY - placedH,
      });
    }
  }

  return result;
}

function pruneFreeRects(freeRects: MaxRect[]): MaxRect[] {
  // Remove free rectangles that are fully contained within another
  const result: MaxRect[] = [];

  for (let i = 0; i < freeRects.length; i++) {
    let contained = false;
    for (let j = 0; j < freeRects.length; j++) {
      if (i === j) continue;
      if (
        freeRects[i].x >= freeRects[j].x &&
        freeRects[i].y >= freeRects[j].y &&
        freeRects[i].x + freeRects[i].width <= freeRects[j].x + freeRects[j].width &&
        freeRects[i].y + freeRects[i].height <= freeRects[j].y + freeRects[j].height
      ) {
        contained = true;
        break;
      }
    }
    if (!contained) {
      result.push(freeRects[i]);
    }
  }

  return result;
}

// ── Shelf Packing (fallback — works well for same-height rows) ────────────

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
        stickerWidth: g.stickerWidth,
        stickerHeight: g.stickerHeight,
      });
      cursorX += g.width;
      shelfHeight = Math.max(shelfHeight, g.height);
    } else {
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
        stickerWidth: g.stickerWidth,
        stickerHeight: g.stickerHeight,
      });
      cursorX += g.width;
      shelfHeight = Math.max(shelfHeight, g.height);
    }
  }

  if (shelfY + shelfHeight > sheetH) return null;
  return placed;
}

// ── Combined Packing: try MaxRect first, then shelf ───────────────────────

function tryPackGroups(
  groups: GroupWithDims[],
  sheetW: number,
  sheetH: number
): PlacedGroup[] | null {
  // Try MaxRect first (better for mixed sizes)
  const maxRectResult = maxRectPack(groups, sheetW, sheetH);
  if (maxRectResult) return maxRectResult;

  // Fallback to shelf packing
  const orderings: GroupWithDims[][] = [
    [...groups].sort((a, b) => b.height - a.height),
    [...groups].sort((a, b) => b.width - a.width),
    [...groups].sort((a, b) => (b.width * b.height) - (a.width * a.height)),
    [...groups].sort((a, b) => a.height - b.height),
    [...groups].sort((a, b) => a.width - b.width),
  ];

  for (const ordered of orderings) {
    const result = shelfPack(ordered, sheetW, sheetH);
    if (result) return result;
  }
  return null;
}

// ── Shape Combination Packing ──────────────────────────────────────────────

function findValidPacking(
  allocation: { name: string; projectIdx: number; outs: number; stickerWidth: number; stickerHeight: number }[],
  sheetW: number,
  sheetH: number,
  bleedIn: number
): { shapes: GroupShape[]; placedGroups: PlacedGroup[] } | null {
  const n = allocation.length;
  const allShapes = allocation.map((a) => getGroupShapes(a.outs));

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
        const dims = groupDimensions(shape, allocation[i].stickerWidth, allocation[i].stickerHeight, bleedIn);
        return {
          name: allocation[i].name,
          projectIdx: allocation[i].projectIdx,
          shape,
          outs: allocation[i].outs,
          width: dims.width,
          height: dims.height,
          stickerWidth: allocation[i].stickerWidth,
          stickerHeight: allocation[i].stickerHeight,
        };
      });

      // Pre-check: no single group exceeds sheet dimensions
      for (const g of groupsWithDims) {
        if (g.width > sheetW || g.height > sheetH) return null;
      }

      const placed = tryPackGroups(groupsWithDims, sheetW, sheetH);
      if (placed) {
        return { shapes: [...currentShapes], placedGroups: placed };
      }
      return null;
    }

    const shapesToTry = allShapes[idx].slice(0, 4);
    for (const shape of shapesToTry) {
      const dims = groupDimensions(shape, allocation[idx].stickerWidth, allocation[idx].stickerHeight, bleedIn);
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
  stickerSizes: { width: number; height: number }[],
  sheetW: number,
  sheetH: number,
  bleedIn: number,
  maxSlots: number
): AllocationWithPacking | null {
  const n = demands.length;
  if (n === 0) return null;

  const minOuts = 2;
  const minTotal = n * minOuts;
  if (minTotal > maxSlots) return null;

  // Compute per-project max outs: how many of this sticker can fit on the sheet
  const perProjectMax: number[] = stickerSizes.map((s) => {
    const cellW = s.width + 2 * bleedIn;
    const cellH = s.height + 2 * bleedIn;
    const cols = Math.floor(sheetW / cellW);
    const rows = Math.floor(sheetH / cellH);
    return Math.max(cols * rows, minOuts);
  });

  // Compute a reasonable range for total outs to search.
  // With mixed sizes, the optimal total may be much less than maxSlots.
  // We search from minTotal up to maxSlots, but prioritize likely-optimal totals.

  // First, compute target outs for each project to balance run lengths
  // If all projects had the same run length L, then outs_i = ceil(demand_i / L)
  // We want the smallest L where sum(outs_i) can be packed.
  const totalDemand = demands.reduce((s, d) => s + d, 0);
  const avgDemand = totalDemand / n;

  // Build a priority list of total outs to try
  const totalsToTry: number[] = [];

  // Add totals derived from balancing run lengths
  for (let L = 1; L <= Math.max(...demands); L++) {
    let total = 0;
    for (let i = 0; i < n; i++) {
      total += Math.max(minOuts, Math.ceil(demands[i] / L));
    }
    if (total >= minTotal && total <= maxSlots && !totalsToTry.includes(total)) {
      totalsToTry.push(total);
    }
    if (total > maxSlots) break; // further L values will only give smaller totals
  }

  // Also add some totals around the middle
  const midTotal = Math.ceil((minTotal + maxSlots) / 2);
  for (const t of [minTotal, midTotal, maxSlots]) {
    if (!totalsToTry.includes(t) && t >= minTotal && t <= maxSlots) {
      totalsToTry.push(t);
    }
  }

  // Sort totals: try maxSlots first (optimal for same-size), then balanced totals,
  // then remaining in descending order (larger totals generally give shorter run lengths)
  totalsToTry.sort((a, b) => {
    // Priority: maxSlots first, then balanced totals, then descending
    if (a === maxSlots) return -1;
    if (b === maxSlots) return 1;
    // Among the balanced totals (from run-length analysis), prefer them over extremes
    return b - a; // descending — larger totals first
  });

  let bestL = Infinity;
  let bestResult: AllocationWithPacking | null = null;

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
          stickerWidth: stickerSizes[i].width,
          stickerHeight: stickerSizes[i].height,
        }));

        const packing = findValidPacking(
          allocInfo, sheetW, sheetH, bleedIn
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

export function buildPlateResult(
  projects: ProjectInput[],
  indices: number[],
  allocation: number[],
  shapes: GroupShape[],
  runLength: number,
  sheetW: number,
  sheetH: number,
  bleedIn: number,
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
      stickerWidth: projects[projIdx].stickerWidth,
      stickerHeight: projects[projIdx].stickerHeight,
    };
  });

  const remappedGroups: PlacedGroup[] = placedGroups.map((pg) => {
    const localIdx = parseInt(pg.name.replace("p", ""));
    return {
      ...pg,
      name: projects[indices[localIdx]].name,
      projectIdx: indices[localIdx],
      stickerWidth: projects[indices[localIdx]].stickerWidth,
      stickerHeight: projects[indices[localIdx]].stickerHeight,
    };
  });

  // Material yield: total sticker area / total sheet area
  let usedStickerArea = 0;
  for (const alloc of allocationEntries) {
    usedStickerArea += alloc.produced * alloc.stickerWidth * alloc.stickerHeight;
  }
  const sheetArea = sheetW * sheetH;
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

// ── Sheet Capacity (reference — for uniform sticker size) ─────────────────

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

// ── Max Slots Estimation (for multi-size) ──────────────────────────────────
// With different sticker sizes, we estimate the max slots based on
// the smallest sticker to give the search a reasonable upper bound.

export function estimateMaxSlots(
  sheetW: number,
  sheetH: number,
  stickerSizes: { width: number; height: number }[],
  bleedMm: number
): number {
  const bleedIn = bleedMm / 25.4;

  // Compute individual grid capacity for each sticker size
  let maxCap = 0;
  for (const s of stickerSizes) {
    const cellW = s.width + 2 * bleedIn;
    const cellH = s.height + 2 * bleedIn;
    const cols = Math.floor(sheetW / cellW);
    const rows = Math.floor(sheetH / cellH);
    maxCap = Math.max(maxCap, cols * rows);
  }

  // Use the maximum individual capacity as the upper bound
  // (can't fit more than this many stickers even if all were the smallest)
  // But ensure at least enough for min 2 each
  return Math.max(maxCap, stickerSizes.length * 2);
}

// ── Two-Plate Optimization ────────────────────────────────────────────────

export function findBestTwoPlate(
  projects: ProjectInput[],
  maxSlots: number,
  sheetW: number,
  sheetH: number,
  bleedIn: number
): TwoPlateResult | null {
  const n = projects.length;
  if (n < 2) return null;

  const demands = projects.map((p) => p.quantity);
  const stickerSizes = projects.map((p) => ({ width: p.stickerWidth, height: p.stickerHeight }));
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
    const p1StickerSizes = plate1Indices.map((i) => stickerSizes[i]);
    const p1Result = findBestAllocationWithPacking(
      p1Demands, p1StickerSizes,
      sheetW, sheetH, bleedIn, maxSlots
    );
    if (!p1Result) continue;

    const p2Demands = plate2Indices.map((i) => demands[i]);
    const p2StickerSizes = plate2Indices.map((i) => stickerSizes[i]);
    const p2Result = findBestAllocationWithPacking(
      p2Demands, p2StickerSizes,
      sheetW, sheetH, bleedIn, maxSlots
    );
    if (!p2Result) continue;

    const totalSheets = p1Result.runLength + p2Result.runLength;
    if (totalSheets >= bestTotal) continue;

    bestTotal = totalSheets;

    const plate1Res = buildPlateResult(
      projects, plate1Indices,
      p1Result.allocation, p1Result.shapes,
      p1Result.runLength,
      sheetW, sheetH, bleedIn,
      p1Result.placedGroups
    );
    const plate2Res = buildPlateResult(
      projects, plate2Indices,
      p2Result.allocation, p2Result.shapes,
      p2Result.runLength,
      sheetW, sheetH, bleedIn,
      p2Result.placedGroups
    );

    const combinedProduced = plate1Res.totalProduced + plate2Res.totalProduced;
    const totalOrderQty = demands.reduce((s, q) => s + q, 0);

    let totalStickerArea = 0;
    for (const alloc of [...plate1Res.allocation, ...plate2Res.allocation]) {
      totalStickerArea += alloc.produced * alloc.stickerWidth * alloc.stickerHeight;
    }
    const sheetArea = sheetW * sheetH;
    const totalSheetArea = totalSheets * sheetArea;
    const materialYield =
      totalSheetArea > 0 ? (totalStickerArea / totalSheetArea) * 100 : 0;

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

export interface MultiSizeCalculateResponse {
  capacity: CapacityResult | null;
  maxSlots: number;
  singlePlateResult: PlateResult | null;
  twoPlateResult: TwoPlateResult | null;
  error?: string;
}

export function calculateMultiSize(req: {
  sheetWidth: number;
  sheetHeight: number;
  bleed: number;
  projects: ProjectInput[];
}): MultiSizeCalculateResponse {
  const { sheetWidth, sheetHeight, bleed, projects: rawProjects } = req;

  if (!sheetWidth || !sheetHeight || bleed == null) {
    return { capacity: null, maxSlots: 0, singlePlateResult: null, twoPlateResult: null, error: "Missing required dimension parameters." };
  }

  const projects = rawProjects.filter((p) => p.quantity > 0 && p.stickerWidth > 0 && p.stickerHeight > 0);
  if (projects.length === 0) {
    return { capacity: null, maxSlots: 0, singlePlateResult: null, twoPlateResult: null, error: "No projects with positive quantities and valid sticker sizes." };
  }

  const bleedIn = bleed / 25.4;

  // Calculate capacity based on first project's sticker (for reference)
  const capacity = calculateCapacity(
    sheetWidth, sheetHeight,
    projects[0].stickerWidth, projects[0].stickerHeight,
    bleed
  );

  // Estimate max slots for the search
  const maxSlots = estimateMaxSlots(
    sheetWidth, sheetHeight,
    projects.map((p) => ({ width: p.stickerWidth, height: p.stickerHeight })),
    bleed
  );

  // Single plate optimization
  let singlePlateResult: PlateResult | null = null;
  if (projects.length * 2 <= maxSlots) {
    const demands = projects.map((p) => p.quantity);
    const stickerSizes = projects.map((p) => ({ width: p.stickerWidth, height: p.stickerHeight }));
    const result = findBestAllocationWithPacking(
      demands, stickerSizes,
      sheetWidth, sheetHeight,
      bleedIn, maxSlots
    );
    if (result) {
      singlePlateResult = buildPlateResult(
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

  // Two plate optimization
  let twoPlateResult: TwoPlateResult | null = null;
  if (projects.length >= 2) {
    twoPlateResult = findBestTwoPlate(projects, maxSlots, sheetWidth, sheetHeight, bleedIn);
  }

  if (twoPlateResult && singlePlateResult) {
    twoPlateResult.sheetsSaved = singlePlateResult.totalSheets - twoPlateResult.totalSheets;
  }

  return { capacity, maxSlots, singlePlateResult, twoPlateResult };
}
