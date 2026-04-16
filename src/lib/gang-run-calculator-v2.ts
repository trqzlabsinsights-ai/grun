// ── Gang Run Calculator — Multi-Size Core Logic ────────────────────────────
// Supports per-project sticker dimensions with MaxRect 2D bin packing.
// Pure functions, no Next.js deps.
//
// KEY ALGORITHM: Direct L-search with full rotation support
// - Rectangles can be ROTATED: sticker 24×16.5 is the same as 16.5×24
// - Groups can be ROTATED on the sheet (portrait ↔ landscape)
// - Both orientations are tried automatically during packing
// - This ensures identical results regardless of dimension input order

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

// ── MaxRect 2D Bin Packing (with rotation support) ───────────────────────

interface MaxRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PlacementResult {
  x: number;
  y: number;
  rotated: boolean; // true if the group was rotated 90° on the sheet
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
    // Try both orientations: original and rotated (swap width/height)
    const result = findBestFreeRect(freeRects, group.width, group.height, sheetW, sheetH);

    if (!result) return null;

    let placedW: number, placedH: number;
    let placedShape: GroupShape;
    let placedStickerW: number, placedStickerH: number;

    if (result.rotated) {
      // Group is rotated 90° on the sheet — swap all dimensions
      placedW = group.height;
      placedH = group.width;
      placedShape = { w: group.shape.h, h: group.shape.w };
      placedStickerW = group.stickerHeight;
      placedStickerH = group.stickerWidth;
    } else {
      placedW = group.width;
      placedH = group.height;
      placedShape = { ...group.shape };
      placedStickerW = group.stickerWidth;
      placedStickerH = group.stickerHeight;
    }

    if (result.x + placedW > sheetW + 0.001 || result.y + placedH > sheetH + 0.001) return null;

    placed.push({
      name: group.name,
      projectIdx: group.projectIdx,
      shape: placedShape,
      outs: group.outs,
      x: result.x,
      y: result.y,
      width: placedW,
      height: placedH,
      stickerWidth: placedStickerW,
      stickerHeight: placedStickerH,
    });

    freeRects = splitFreeRects(freeRects, result.x, result.y, placedW, placedH);
    freeRects = pruneFreeRects(freeRects);
  }

  return placed;
}

/**
 * Find the best free rectangle to place a group, trying BOTH orientations.
 * Uses Best Short Side Fit (BSSF) heuristic.
 * Returns null if the group doesn't fit in either orientation.
 */
function findBestFreeRect(
  freeRects: MaxRect[],
  rectW: number,
  rectH: number,
  sheetW: number,
  sheetH: number
): PlacementResult | null {
  let bestScore = Infinity;
  let bestResult: PlacementResult | null = null;

  // Try original orientation (rectW × rectH)
  for (const fr of freeRects) {
    if (rectW <= fr.width + 0.001 && rectH <= fr.height + 0.001) {
      if (fr.x + rectW <= sheetW + 0.001 && fr.y + rectH <= sheetH + 0.001) {
        const shortSideFit = Math.min(fr.width - rectW, fr.height - rectH);
        if (shortSideFit < bestScore) {
          bestScore = shortSideFit;
          bestResult = { x: fr.x, y: fr.y, rotated: false };
        }
      }
    }
  }

  // Try rotated orientation (rectH × rectW) — only if different from original
  if (Math.abs(rectW - rectH) > 0.001) {
    for (const fr of freeRects) {
      if (rectH <= fr.width + 0.001 && rectW <= fr.height + 0.001) {
        if (fr.x + rectH <= sheetW + 0.001 && fr.y + rectW <= sheetH + 0.001) {
          const shortSideFit = Math.min(fr.width - rectH, fr.height - rectW);
          if (shortSideFit < bestScore) {
            bestScore = shortSideFit;
            bestResult = { x: fr.x, y: fr.y, rotated: true };
          }
        }
      }
    }
  }

  return bestResult;
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

// ── Shelf Packing (fallback, with rotation support) ─────────────────────

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
    // Try both orientations for each group
    const tryOrientations = g.width !== g.height
      ? [
          { w: g.width, h: g.height, shape: { w: g.shape.w, h: g.shape.h }, sw: g.stickerWidth, sh: g.stickerHeight },
          { w: g.height, h: g.width, shape: { w: g.shape.h, h: g.shape.w }, sw: g.stickerHeight, sh: g.stickerWidth },
        ]
      : [
          { w: g.width, h: g.height, shape: { w: g.shape.w, h: g.shape.h }, sw: g.stickerWidth, sh: g.stickerHeight },
        ];

    let fitOrient: typeof tryOrientations[0] | null = null;

    for (const orient of tryOrientations) {
      if (orient.w > sheetW + 0.001) continue; // Too wide even alone
      if (cursorX + orient.w <= sheetW + 0.001 && shelfY + orient.h <= sheetH + 0.001) {
        fitOrient = orient;
        break; // First fit is good enough for shelf packing
      }
    }

    if (!fitOrient) {
      // Try starting a new shelf
      for (const orient of tryOrientations) {
        if (orient.w > sheetW + 0.001) continue;
        const newShelfY = shelfY + shelfHeight;
        if (newShelfY + orient.h <= sheetH + 0.001) {
          fitOrient = orient;
          shelfY = newShelfY;
          shelfHeight = 0;
          cursorX = 0;
          break;
        }
      }
    }

    if (!fitOrient) return null;

    placed.push({
      name: g.name, projectIdx: g.projectIdx, shape: fitOrient.shape, outs: g.outs,
      x: cursorX, y: shelfY, width: fitOrient.w, height: fitOrient.h,
      stickerWidth: fitOrient.sw, stickerHeight: fitOrient.sh,
    });
    cursorX += fitOrient.w;
    shelfHeight = Math.max(shelfHeight, fitOrient.h);
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

// ── Shape Combination Packing (with both sticker orientations) ────────────
// For each project, generates groups with BOTH sticker orientations
// (original and rotated). This ensures that entering 24×16.5 vs 16.5×24
// produces identical results.

function findValidPacking(
  allocation: { name: string; projectIdx: number; outs: number; stickerWidth: number; stickerHeight: number }[],
  sheetW: number,
  sheetH: number,
  bleedIn: number
): { shapes: GroupShape[]; placedGroups: PlacedGroup[] } | null {
  const n = allocation.length;

  // For each project, generate ALL possible group variants:
  // - Each factor pair of outs
  // - Both sticker orientations (original and rotated)
  // Deduplicate by dimensions to avoid redundant work
  const allGroupVariants: GroupWithDims[][] = allocation.map((a) => {
    const shapes = getGroupShapes(a.outs);
    const variants: GroupWithDims[] = [];
    const seen = new Set<string>();

    for (const shape of shapes) {
      // Original sticker orientation
      const dims1 = groupDimensions(shape, a.stickerWidth, a.stickerHeight, bleedIn);
      const key1 = `${dims1.width.toFixed(4)},${dims1.height.toFixed(4)}`;
      if (dims1.width <= sheetW + 0.001 && dims1.height <= sheetH + 0.001 && !seen.has(key1)) {
        seen.add(key1);
        variants.push({
          name: a.name, projectIdx: a.projectIdx, shape, outs: a.outs,
          width: dims1.width, height: dims1.height,
          stickerWidth: a.stickerWidth, stickerHeight: a.stickerHeight,
        });
      }

      // Rotated sticker orientation (swap sticker W↔H)
      // This creates a DIFFERENT group rectangle that may pack better
      if (Math.abs(a.stickerWidth - a.stickerHeight) > 0.001) {
        const dims2 = groupDimensions(shape, a.stickerHeight, a.stickerWidth, bleedIn);
        const key2 = `${dims2.width.toFixed(4)},${dims2.height.toFixed(4)}`;
        if (dims2.width <= sheetW + 0.001 && dims2.height <= sheetH + 0.001 && !seen.has(key2)) {
          seen.add(key2);
          variants.push({
            name: a.name, projectIdx: a.projectIdx, shape, outs: a.outs,
            width: dims2.width, height: dims2.height,
            stickerWidth: a.stickerHeight, stickerHeight: a.stickerWidth,
          });
        }
      }
    }

    return variants;
  });

  // Check that all projects have at least one viable variant
  for (const variants of allGroupVariants) {
    if (variants.length === 0) return null;
  }

  let bestPacking: { shapes: GroupShape[]; placedGroups: PlacedGroup[]; usedArea: number } | null = null;
  let attempts = 0;
  const maxAttempts = 200000; // High limit — user said slow is OK

  function tryCombo(idx: number, currentGroups: GroupWithDims[]): void {
    if (attempts >= maxAttempts) return;
    if (idx === n) {
      attempts++;

      const placed = tryPackGroups(currentGroups, sheetW, sheetH);
      if (placed) {
        const usedArea = placed.reduce((s, g) => s + g.width * g.height, 0);
        if (!bestPacking || usedArea > bestPacking.usedArea) {
          bestPacking = {
            shapes: currentGroups.map(g => ({ w: g.shape.w, h: g.shape.h })),
            placedGroups: placed,
            usedArea,
          };
        }
      }
      return;
    }

    for (const variant of allGroupVariants[idx]) {
      if (attempts >= maxAttempts) return;
      currentGroups.push(variant);
      tryCombo(idx + 1, currentGroups);
      currentGroups.pop();
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

  // Compute per-project max outs — try both sticker orientations and take the max
  const perProjectMax: number[] = stickerSizes.map((s) => {
    // Original orientation
    const cellW1 = s.width + 2 * bleedIn;
    const cellH1 = s.height + 2 * bleedIn;
    const cols1 = Math.floor(sheetW / cellW1);
    const rows1 = Math.floor(sheetH / cellH1);
    const cap1 = cols1 * rows1;

    // Rotated orientation
    const cellW2 = s.height + 2 * bleedIn;
    const cellH2 = s.width + 2 * bleedIn;
    const cols2 = Math.floor(sheetW / cellW2);
    const rows2 = Math.floor(sheetH / cellH2);
    const cap2 = cols2 * rows2;

    return Math.max(cap1, cap2, minOuts);
  });

  // ── STEP 1: Compute all critical L values ──────────────────────────────
  // The minimum outs for project i changes at L = ceil(demand_i / k) for each k.
  // We collect all these "transition" L values and search them in ascending order.

  const criticalLs = new Set<number>();
  for (let i = 0; i < n; i++) {
    for (let k = minOuts; k <= perProjectMax[i]; k++) {
      criticalLs.add(Math.ceil(demands[i] / k));
    }
    criticalLs.add(1);
    criticalLs.add(demands[i]);
  }

  const sortedLs = [...criticalLs].sort((a, b) => a - b);

  // ── STEP 2: For each L (ascending), try minimum allocation + extras ────

  const triedAllocations = new Set<string>();

  for (const L of sortedLs) {
    const minAllocation = demands.map((d) => Math.max(minOuts, Math.ceil(d / L)));
    const minTotalOuts = minAllocation.reduce((s, o) => s + o, 0);

    if (minTotalOuts > maxSlots) continue;

    const extraSlots = maxSlots - minTotalOuts;

    const allocationsToTry: number[][] = [[...minAllocation]];

    if (extraSlots > 0) {
      generateExtraSlotDistributions(minAllocation, extraSlots, perProjectMax, allocationsToTry, 200);
    }

    let bestPackingForL: AllocationWithPacking | null = null;

    for (const alloc of allocationsToTry) {
      const key = alloc.join(",");
      if (triedAllocations.has(key)) continue;
      triedAllocations.add(key);

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
        if (actualL <= L) return bestPackingForL;
      }
    }

    if (bestPackingForL) return bestPackingForL;
  }

  // ── STEP 3: Fallback — brute force search over all totals ──────────────

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

function generateExtraSlotDistributions(
  baseAllocation: number[],
  extraSlots: number,
  perProjectMax: number[],
  results: number[][],
  maxResults: number
): void {
  const n = baseAllocation.length;

  // Strategy 1: Give all extra to each project
  for (let i = 0; i < n; i++) {
    if (results.length >= maxResults) return;
    const alloc = [...baseAllocation];
    const canGive = Math.min(extraSlots, perProjectMax[i] - alloc[i]);
    if (canGive > 0) {
      alloc[i] += canGive;
      results.push(alloc);
    }
  }

  // Strategy 2: Round-robin distribution
  {
    if (results.length >= maxResults) {
      // ok
    } else {
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
  }

  // Strategy 3: Give to smallest outs first
  {
    if (results.length < maxResults) {
      const alloc = [...baseAllocation];
      const indices = Array.from({ length: n }, (_, i) => i);
      indices.sort((a, b) => baseAllocation[a] - baseAllocation[b]);
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
  }

  // Strategy 4: Try giving 1 extra to each project
  if (extraSlots >= 1 && results.length < maxResults) {
    for (let i = 0; i < n; i++) {
      if (results.length >= maxResults) return;
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

  // Remap placed groups — keep the sticker dimensions from packing (may be rotated)
  const remappedGroups: PlacedGroup[] = placedGroups.map((pg) => {
    const localIdx = parseInt(pg.name.replace("p", ""));
    return {
      ...pg,
      name: projects[indices[localIdx]].name,
      projectIdx: indices[localIdx],
      // IMPORTANT: Keep stickerWidth/stickerHeight from packing, NOT from project!
      // The packing may have rotated stickers, and the shape is already adjusted.
      // The PlacedGroup's stickerWidth/stickerHeight reflect the actual orientation
      // on the sheet, which is what the visualization needs.
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
    // Original orientation
    const cellW1 = s.width + 2 * bleedIn;
    const cellH1 = s.height + 2 * bleedIn;
    const cols1 = Math.floor(sheetW / cellW1);
    const rows1 = Math.floor(sheetH / cellH1);
    maxCap = Math.max(maxCap, cols1 * rows1);

    // Rotated orientation
    const cellW2 = s.height + 2 * bleedIn;
    const cellH2 = s.width + 2 * bleedIn;
    const cols2 = Math.floor(sheetW / cellW2);
    const rows2 = Math.floor(sheetH / cellH2);
    maxCap = Math.max(maxCap, cols2 * rows2);
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
