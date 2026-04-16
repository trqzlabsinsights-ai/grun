// ── Gang Run Calculator — Multi-Size Core Logic ────────────────────────────
// Supports per-project sticker dimensions with MaxRect 2D bin packing.
// Pure functions, no Next.js deps.
//
// KEY ALGORITHM: Direct L-search
// Instead of searching over "totals" and allocations indirectly, we search
// run length L directly from 1 upward. For each L, we compute the minimum
// outs per project, then try to pack. The first L that packs is optimal.
// This guarantees finding the minimum possible run length.

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

export interface GroupWithDims {
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
  // Sort: most square first, then wider shapes (better for packing)
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

interface MaxRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function maxRectPack(
  groups: GroupWithDims[],
  sheetW: number,
  sheetH: number
): PlacedGroup[] | null {
  // Try multiple orderings of the groups
  const orderings: GroupWithDims[][] = [
    [...groups].sort((a, b) => b.height - a.height),
    [...groups].sort((a, b) => b.width - a.width),
    [...groups].sort((a, b) => (b.width * b.height) - (a.width * a.height)),
    [...groups].sort((a, b) => a.height - b.height),
    [...groups].sort((a, b) => a.width - b.width),
    [...groups].sort((a, b) => {
      if (b.height !== a.height) return b.height - a.height;
      return b.width - a.width;
    }),
    // Additional orderings for better coverage
    [...groups].sort((a, b) => {
      if (b.width !== a.width) return b.width - a.width;
      return b.height - a.height;
    }),
    [...groups].sort((a, b) => a.width * a.height - b.width * b.height), // smallest first
  ];

  let bestResult: PlacedGroup[] | null = null;
  let bestUsedArea = 0;

  for (const ordered of orderings) {
    const result = maxRectPackOneOrder(ordered, sheetW, sheetH);
    if (result) {
      const usedArea = result.reduce((s, g) => s + g.width * g.height, 0);
      if (usedArea > bestUsedArea) {
        bestUsedArea = usedArea;
        bestResult = result;
      }
    }
  }
  return bestResult;
}

function maxRectPackOneOrder(
  groups: GroupWithDims[],
  sheetW: number,
  sheetH: number
): PlacedGroup[] | null {
  let freeRects: MaxRect[] = [{ x: 0, y: 0, width: sheetW, height: sheetH }];
  const placed: PlacedGroup[] = [];

  for (const group of groups) {
    const result = findBestFreeRect(freeRects, group.width, group.height, sheetW, sheetH);

    if (!result) return null;
    if (result.x + group.width > sheetW + 0.001 || result.y + group.height > sheetH + 0.001) return null;

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

    freeRects = splitFreeRects(freeRects, result.x, result.y, group.width, group.height);
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
    if (rectW <= fr.width && rectH <= fr.height) {
      if (fr.x + rectW <= sheetW + 0.001 && fr.y + rectH <= sheetH + 0.001) {
        const shortSideFit = Math.min(fr.width - rectW, fr.height - rectH);
        if (shortSideFit < bestScore) {
          bestScore = shortSideFit;
          bestRect = { x: fr.x, y: fr.y };
        }
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
        freeRects[i].x >= freeRects[j].x &&
        freeRects[i].y >= freeRects[j].y &&
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

// ── Shelf Packing (fallback) ─────────────────────────────────────────────

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
    if (cursorX + g.width <= sheetW + 0.001) {
      placed.push({
        name: g.name, projectIdx: g.projectIdx, shape: g.shape, outs: g.outs,
        x: cursorX, y: shelfY, width: g.width, height: g.height,
        stickerWidth: g.stickerWidth, stickerHeight: g.stickerHeight,
      });
      cursorX += g.width;
      shelfHeight = Math.max(shelfHeight, g.height);
    } else {
      shelfY += shelfHeight;
      shelfHeight = 0;
      cursorX = 0;
      if (g.width > sheetW + 0.001) return null;
      if (shelfY + g.height > sheetH + 0.001) return null;
      placed.push({
        name: g.name, projectIdx: g.projectIdx, shape: g.shape, outs: g.outs,
        x: cursorX, y: shelfY, width: g.width, height: g.height,
        stickerWidth: g.stickerWidth, stickerHeight: g.stickerHeight,
      });
      cursorX += g.width;
      shelfHeight = Math.max(shelfHeight, g.height);
    }
  }

  if (shelfY + shelfHeight > sheetH + 0.001) return null;
  return placed;
}

// ── Combined Packing: try MaxRect first, then shelf ───────────────────────

function tryPackGroups(
  groups: GroupWithDims[],
  sheetW: number,
  sheetH: number
): PlacedGroup[] | null {
  const maxRectResult = maxRectPack(groups, sheetW, sheetH);
  if (maxRectResult) return maxRectResult;

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

  let bestPacking: { shapes: GroupShape[]; placedGroups: PlacedGroup[]; usedArea: number } | null = null;
  let attempts = 0;
  const maxAttempts = 50000; // High limit — user said slow is OK

  function tryCombo(idx: number, currentShapes: GroupShape[]): void {
    if (attempts >= maxAttempts) return;
    if (idx === n) {
      attempts++;

      const groupsWithDims: GroupWithDims[] = currentShapes.map((shape, i) => {
        const dims = groupDimensions(shape, allocation[i].stickerWidth, allocation[i].stickerHeight, bleedIn);
        return {
          name: allocation[i].name, projectIdx: allocation[i].projectIdx,
          shape, outs: allocation[i].outs,
          width: dims.width, height: dims.height,
          stickerWidth: allocation[i].stickerWidth, stickerHeight: allocation[i].stickerHeight,
        };
      });

      for (const g of groupsWithDims) {
        if (g.width > sheetW + 0.001 || g.height > sheetH + 0.001) return;
      }

      const placed = tryPackGroups(groupsWithDims, sheetW, sheetH);
      if (placed) {
        const usedArea = placed.reduce((s, g) => s + g.width * g.height, 0);
        if (!bestPacking || usedArea > bestPacking.usedArea) {
          bestPacking = { shapes: [...currentShapes], placedGroups: placed, usedArea };
        }
      }
      return;
    }

    // Try ALL shapes (not just first 8)
    const shapesToTry = allShapes[idx];
    for (const shape of shapesToTry) {
      if (attempts >= maxAttempts) return;
      const dims = groupDimensions(shape, allocation[idx].stickerWidth, allocation[idx].stickerHeight, bleedIn);
      if (dims.width > sheetW + 0.001 || dims.height > sheetH + 0.001) continue;

      currentShapes.push(shape);
      tryCombo(idx + 1, currentShapes);
      currentShapes.pop();
    }
  }

  tryCombo(0, []);
  return bestPacking ? { shapes: bestPacking.shapes, placedGroups: bestPacking.placedGroups } : null;
}

// ── Direct L-Search Allocation ────────────────────────────────────────────
// Searches run length L directly from 1 upward.
// For each L, computes minimum outs per project, checks if they fit,
// and tries to pack. The first L that packs is guaranteed optimal.

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

  // Compute per-project max outs (grid capacity for each sticker size)
  const perProjectMax: number[] = stickerSizes.map((s) => {
    const cellW = s.width + 2 * bleedIn;
    const cellH = s.height + 2 * bleedIn;
    const cols = Math.floor(sheetW / cellW);
    const rows = Math.floor(sheetH / cellH);
    return Math.max(cols * rows, minOuts);
  });

  // ── STEP 1: Compute all critical L values ──────────────────────────────
  // The minimum outs for project i changes at L = ceil(demand_i / k) for each k.
  // We collect all these "transition" L values and search them in ascending order.

  const criticalLs = new Set<number>();
  for (let i = 0; i < n; i++) {
    for (let k = minOuts; k <= perProjectMax[i]; k++) {
      criticalLs.add(Math.ceil(demands[i] / k));
    }
    // Also add L=1 and the demand itself
    criticalLs.add(1);
    criticalLs.add(demands[i]);
  }

  const sortedLs = [...criticalLs].sort((a, b) => a - b);

  // ── STEP 2: For each L (ascending), try minimum allocation + extras ────
  // Cache: if an allocation vector was already tried and couldn't pack, skip it

  const triedAllocations = new Set<string>();

  for (const L of sortedLs) {
    // Compute minimum outs for this L
    const minAllocation = demands.map((d) => Math.max(minOuts, Math.ceil(d / L)));
    const minTotalOuts = minAllocation.reduce((s, o) => s + o, 0);

    // If minimum allocation already exceeds maxSlots, this L is impossible
    if (minTotalOuts > maxSlots) continue;

    // We found an L where the minimum allocation fits in maxSlots.
    // Now try to pack it. Also try distributing extra slots (maxSlots - minTotalOuts)
    // to projects to reduce overage.

    const extraSlots = maxSlots - minTotalOuts;

    // Generate allocation variants: minimum + all ways to distribute extra slots
    // But cap the number of extra-slot distributions to avoid explosion
    const allocationsToTry: number[][] = [[...minAllocation]];

    if (extraSlots > 0) {
      // Try giving extra slots to projects with the highest demand/outs ratio
      // (they benefit most from more outs)
      generateExtraSlotDistributions(minAllocation, extraSlots, perProjectMax, allocationsToTry, 200);
    }

    let bestPackingForL: AllocationWithPacking | null = null;

    for (const alloc of allocationsToTry) {
      const key = alloc.join(",");
      if (triedAllocations.has(key)) continue;
      triedAllocations.add(key);

      // Verify this allocation gives L or better
      let actualL = 0;
      for (let i = 0; i < n; i++) {
        actualL = Math.max(actualL, Math.ceil(demands[i] / alloc[i]));
      }

      const allocInfo = alloc.map((outs, i) => ({
        name: `p${i}`,
        projectIdx: i,
        outs,
        stickerWidth: stickerSizes[i].width,
        stickerHeight: stickerSizes[i].height,
      }));

      const packing = findValidPacking(allocInfo, sheetW, sheetH, bleedIn);

      if (packing) {
        if (!bestPackingForL || actualL < bestPackingForL.runLength) {
          bestPackingForL = {
            allocation: [...alloc],
            runLength: actualL,
            shapes: packing.shapes,
            placedGroups: packing.placedGroups,
          };
        }
        // If we found a packing with this L, that's the minimum possible L
        // (since we're searching L in ascending order)
        if (actualL <= L) return bestPackingForL;
      }
    }

    // If we found a valid packing for this L, return it
    if (bestPackingForL) return bestPackingForL;
  }

  // ── STEP 3: Fallback — brute force search over all totals ──────────────
  // If the critical-L search didn't find anything, try the old approach

  let bestL = Infinity;
  let bestResult: AllocationWithPacking | null = null;
  let totalSearchIterations = 0;
  const MAX_SEARCH_ITERATIONS = 500000;

  for (let totalOuts = maxSlots; totalOuts >= minTotal; totalOuts--) {
    if (totalSearchIterations >= MAX_SEARCH_ITERATIONS) break;

    const current = new Array(n).fill(0);

    function search(idx: number, remaining: number): void {
      if (totalSearchIterations >= MAX_SEARCH_ITERATIONS) return;
      if (idx === n - 1) {
        totalSearchIterations++;
        current[idx] = remaining;
        if (remaining < minOuts || remaining > perProjectMax[idx]) return;

        let L = 0;
        for (let i = 0; i < n; i++) L = Math.max(L, Math.ceil(demands[i] / current[i]));
        if (L >= bestL) return;

        const key = current.join(",");
        if (triedAllocations.has(key)) return;
        triedAllocations.add(key);

        const allocInfo = current.map((outs, i) => ({
          name: `p${i}`, projectIdx: i, outs,
          stickerWidth: stickerSizes[i].width, stickerHeight: stickerSizes[i].height,
        }));

        const packing = findValidPacking(allocInfo, sheetW, sheetH, bleedIn);
        if (packing) {
          bestL = L;
          bestResult = { allocation: [...current], runLength: L, shapes: packing.shapes, placedGroups: packing.placedGroups };
        }
        return;
      }

      const minRemaining = (n - idx - 1) * minOuts;
      const maxVal = Math.min(remaining - minRemaining, perProjectMax[idx]);
      for (let val = minOuts; val <= maxVal; val++) {
        if (totalSearchIterations >= MAX_SEARCH_ITERATIONS) return;
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

// ── Extra Slot Distribution ──────────────────────────────────────────────
// Generates different ways to distribute extra slots among projects.
// Prioritizes giving extra slots to projects with highest demand/outs ratio.

function generateExtraSlotDistributions(
  baseAllocation: number[],
  extraSlots: number,
  perProjectMax: number[],
  results: number[][],
  maxResults: number
): void {
  const n = baseAllocation.length;

  // Strategy 1: Give all extra to the bottleneck project (highest demand/outs)
  for (let i = 0; i < n; i++) {
    const alloc = [...baseAllocation];
    const canGive = Math.min(extraSlots, perProjectMax[i] - alloc[i]);
    if (canGive > 0) {
      alloc[i] += canGive;
      results.push(alloc);
    }
  }

  // Strategy 2: Distribute 1 extra to each project, round-robin
  {
    const alloc = [...baseAllocation];
    let remaining = extraSlots;
    let round = 0;
    while (remaining > 0 && round < 100) {
      for (let i = 0; i < n && remaining > 0; i++) {
        if (alloc[i] < perProjectMax[i]) {
          alloc[i]++;
          remaining--;
        }
      }
      round++;
    }
    if (remaining === 0) results.push(alloc);
  }

  // Strategy 3: Sort by demand/outs ratio, give to highest ratio first
  {
    const alloc = [...baseAllocation];
    const indices = Array.from({ length: n }, (_, i) => i);
    indices.sort((a, b) => {
      const ratioA = baseAllocation[a] > 0 ? 0 : 0; // already accounted for in min
      return (baseAllocation[b]) - (baseAllocation[a]); // give to smallest outs first
    });
    let remaining = extraSlots;
    for (const i of indices) {
      if (remaining <= 0) break;
      const canGive = Math.min(remaining, perProjectMax[i] - alloc[i]);
      if (canGive > 0) {
        alloc[i] += canGive;
        remaining -= canGive;
      }
    }
    if (remaining === 0) results.push(alloc);
  }

  // Strategy 4: Try distributing extra slots 1 at a time to each project
  // (generates n variants, each giving 1 extra to a different project)
  if (extraSlots >= 1) {
    for (let i = 0; i < n; i++) {
      if (baseAllocation[i] < perProjectMax[i]) {
        const alloc = [...baseAllocation];
        alloc[i]++;
        results.push(alloc);
      }
    }
  }
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
  const totalProduced = allocation.reduce((sum, outs) => sum + outs * runLength, 0);

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

  let usedStickerArea = 0;
  for (const alloc of allocationEntries) {
    usedStickerArea += alloc.produced * alloc.stickerWidth * alloc.stickerHeight;
  }
  const sheetArea = sheetW * sheetH;
  const totalSheetArea = runLength * sheetArea;
  const materialYield = totalSheetArea > 0 ? (usedStickerArea / totalSheetArea) * 100 : 0;

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

// ── Sheet Capacity ───────────────────────────────────────────────────────

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
    cols, rows,
    maxPerSheet: cols * rows,
    cellWidth: cellW, cellHeight: cellH,
    stickerWidth: stickerW, stickerHeight: stickerH,
    bleedInches: bleedIn,
    sheetWidth: sheetW, sheetHeight: sheetH,
  };
}

// ── Max Slots Estimation ──────────────────────────────────────────────────

export function estimateMaxSlots(
  sheetW: number,
  sheetH: number,
  stickerSizes: { width: number; height: number }[],
  bleedMm: number
): number {
  const bleedIn = bleedMm / 25.4;
  let maxCap = 0;
  for (const s of stickerSizes) {
    const cellW = s.width + 2 * bleedIn;
    const cellH = s.height + 2 * bleedIn;
    const cols = Math.floor(sheetW / cellW);
    const rows = Math.floor(sheetH / cellH);
    maxCap = Math.max(maxCap, cols * rows);
  }
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
      if (mask & (1 << i)) plate1Indices.push(i);
      else plate2Indices.push(i);
    }

    if (plate1Indices.length === 0 || plate2Indices.length === 0) continue;
    if (plate1Indices.length * 2 > maxSlots || plate2Indices.length * 2 > maxSlots) continue;

    const p1Demands = plate1Indices.map((i) => demands[i]);
    const p1StickerSizes = plate1Indices.map((i) => stickerSizes[i]);
    const p1Result = findBestAllocationWithPacking(p1Demands, p1StickerSizes, sheetW, sheetH, bleedIn, maxSlots);
    if (!p1Result) continue;

    const p2Demands = plate2Indices.map((i) => demands[i]);
    const p2StickerSizes = plate2Indices.map((i) => stickerSizes[i]);
    const p2Result = findBestAllocationWithPacking(p2Demands, p2StickerSizes, sheetW, sheetH, bleedIn, maxSlots);
    if (!p2Result) continue;

    const totalSheets = p1Result.runLength + p2Result.runLength;
    if (totalSheets >= bestTotal) continue;

    bestTotal = totalSheets;

    const plate1Res = buildPlateResult(projects, plate1Indices, p1Result.allocation, p1Result.shapes, p1Result.runLength, sheetW, sheetH, bleedIn, p1Result.placedGroups);
    const plate2Res = buildPlateResult(projects, plate2Indices, p2Result.allocation, p2Result.shapes, p2Result.runLength, sheetW, sheetH, bleedIn, p2Result.placedGroups);

    const combinedProduced = plate1Res.totalProduced + plate2Res.totalProduced;
    const totalOrderQty = demands.reduce((s, q) => s + q, 0);

    let totalStickerArea = 0;
    for (const alloc of [...plate1Res.allocation, ...plate2Res.allocation]) {
      totalStickerArea += alloc.produced * alloc.stickerWidth * alloc.stickerHeight;
    }
    const sheetArea = sheetW * sheetH;
    const totalSheetArea = totalSheets * sheetArea;
    const materialYield = totalSheetArea > 0 ? (totalStickerArea / totalSheetArea) * 100 : 0;

    bestResult = {
      plate1: plate1Res, plate2: plate2Res,
      totalSheets, totalProduced: combinedProduced,
      totalOverage: combinedProduced - totalOrderQty,
      materialYield, sheetsSaved: 0,
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

  const capacity = calculateCapacity(sheetWidth, sheetHeight, projects[0].stickerWidth, projects[0].stickerHeight, bleed);

  const maxSlots = estimateMaxSlots(sheetWidth, sheetHeight, projects.map((p) => ({ width: p.stickerWidth, height: p.stickerHeight })), bleed);

  // Single plate optimization
  let singlePlateResult: PlateResult | null = null;
  if (projects.length * 2 <= maxSlots) {
    const demands = projects.map((p) => p.quantity);
    const stickerSizes = projects.map((p) => ({ width: p.stickerWidth, height: p.stickerHeight }));
    const result = findBestAllocationWithPacking(demands, stickerSizes, sheetWidth, sheetHeight, bleedIn, maxSlots);
    if (result) {
      singlePlateResult = buildPlateResult(projects, projects.map((_, i) => i), result.allocation, result.shapes, result.runLength, sheetWidth, sheetHeight, bleedIn, result.placedGroups);
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
