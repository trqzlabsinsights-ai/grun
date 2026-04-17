// ── Gang Run Calculator — Multi-Size Core Logic ────────────────────────────
// Supports per-project sticker dimensions with MaxRect 2D bin packing.
// Pure functions, no Next.js deps.
//
// KEY ALGORITHM:
// 1. Direct L-search to find minimum run length
// 2. Rotation support: stickers can be rotated (24x16.5 = 16.5x24)
// 3. Each project = ONE connected group on the sheet (no orphan stickers)
// 4. Search larger outs to fill the sheet better (maximize yield)

// ── Types ──────────────────────────────────────────────────────────────────

export interface ProjectInput {
  name: string;
  quantity: number;
  stickerWidth: number;  // inches
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

export interface MultiPlateResult {
  plates: PlateResult[];
  totalSheets: number;
  totalProduced: number;
  totalOverage: number;
  materialYield: number;
  plateCount: number;
  plateProjectIndices: number[][];
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
  // Deterministic: use a.w as final tiebreaker to ensure consistent order
  shapes.sort((a, b) => {
    const ratioA = Math.max(a.w, a.h) / Math.min(a.w, a.h);
    const ratioB = Math.max(b.w, b.h) / Math.min(b.w, b.h);
    if (Math.abs(ratioA - ratioB) > 0.000001) return ratioA - ratioB;
    if (b.w !== a.w) return b.w - a.w;
    return a.h - b.h; // Final tiebreaker for determinism
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
  rotated: boolean;
}

export function maxRectPack(
  groups: GroupWithDims[],
  sheetW: number,
  sheetH: number
): PlacedGroup[] | null {
  // Deterministic tiebreaker: always use projectIdx as secondary sort key
  // to ensure identical results across all JS engines (Bun, Node, V8, SpiderMonkey)
  const orderings: GroupWithDims[][] = [
    // Primary: tallest first — deterministic tiebreak by projectIdx
    [...groups].sort((a, b) => {
      const dh = b.height - a.height;
      if (Math.abs(dh) > 0.000001) return dh;
      const dw = b.width - a.width;
      if (Math.abs(dw) > 0.000001) return dw;
      return a.projectIdx - b.projectIdx;
    }),
    // Primary: widest first — deterministic tiebreak by projectIdx
    [...groups].sort((a, b) => {
      const dw = b.width - a.width;
      if (Math.abs(dw) > 0.000001) return dw;
      const dh = b.height - a.height;
      if (Math.abs(dh) > 0.000001) return dh;
      return a.projectIdx - b.projectIdx;
    }),
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

    let placedW: number, placedH: number;
    let placedShape: GroupShape;
    let placedStickerW: number, placedStickerH: number;

    if (result.rotated) {
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

    // Strict boundary check — must fit within sheet
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

function findBestFreeRect(
  freeRects: MaxRect[],
  rectW: number,
  rectH: number,
  sheetW: number,
  sheetH: number
): PlacementResult | null {
  let bestScore = Infinity;
  let bestResult: PlacementResult | null = null;
  // Deterministic tiebreaker values: prefer lower x, then lower y, then non-rotated
  // This ensures identical results across all JS engines regardless of
  // iteration order differences (Bun vs Node)
  let bestTieX = Infinity;
  let bestTieY = Infinity;
  let bestTieRotated = 1; // 0 = not rotated (preferred), 1 = rotated

  // Original orientation
  for (const fr of freeRects) {
    if (rectW <= fr.width + 0.001 && rectH <= fr.height + 0.001) {
      if (fr.x + rectW <= sheetW + 0.001 && fr.y + rectH <= sheetH + 0.001) {
        const shortSideFit = Math.round(Math.min(fr.width - rectW, fr.height - rectH) * 1e6) / 1e6;
        const tX = Math.round(fr.x * 1e6) / 1e6;
        const tY = Math.round(fr.y * 1e6) / 1e6;
        if (shortSideFit < bestScore ||
            (shortSideFit === bestScore && (tX < bestTieX ||
            (tX === bestTieX && tY < bestTieY) ||
            (tX === bestTieX && tY === bestTieY && bestTieRotated === 1)))) {
          bestScore = shortSideFit;
          bestTieX = tX;
          bestTieY = tY;
          bestTieRotated = 0;
          bestResult = { x: fr.x, y: fr.y, rotated: false };
        }
      }
    }
  }

  // Rotated orientation
  if (Math.abs(rectW - rectH) > 0.001) {
    for (const fr of freeRects) {
      if (rectH <= fr.width + 0.001 && rectW <= fr.height + 0.001) {
        if (fr.x + rectH <= sheetW + 0.001 && fr.y + rectW <= sheetH + 0.001) {
          const shortSideFit = Math.round(Math.min(fr.width - rectH, fr.height - rectW) * 1e6) / 1e6;
          const tX = Math.round(fr.x * 1e6) / 1e6;
          const tY = Math.round(fr.y * 1e6) / 1e6;
          if (shortSideFit < bestScore ||
              (shortSideFit === bestScore && tX < bestTieX) ||
              (shortSideFit === bestScore && tX === bestTieX && tY < bestTieY)) {
            bestScore = shortSideFit;
            bestTieX = tX;
            bestTieY = tY;
            bestTieRotated = 1;
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
      if (orient.w > sheetW + 0.001) continue;
      if (cursorX + orient.w <= sheetW + 0.001 && shelfY + orient.h <= sheetH + 0.001) {
        fitOrient = orient;
        break;
      }
    }

    if (!fitOrient) {
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

// ── Combined Packing ────────────────────────────────────────────────────

function tryPackGroups(
  groups: GroupWithDims[],
  sheetW: number,
  sheetH: number
): PlacedGroup[] | null {
  const maxRectResult = maxRectPack(groups, sheetW, sheetH);
  if (maxRectResult) return maxRectResult;

  // Deterministic shelf fallback: tallest-first with projectIdx tiebreaker
  const orderings: GroupWithDims[][] = [
    [...groups].sort((a, b) => {
      const dh = b.height - a.height;
      if (Math.abs(dh) > 0.000001) return dh;
      return a.projectIdx - b.projectIdx;
    }),
    [...groups].sort((a, b) => {
      const dw = b.width - a.width;
      if (Math.abs(dw) > 0.000001) return dw;
      return a.projectIdx - b.projectIdx;
    }),
  ];

  for (const ordered of orderings) {
    const result = shelfPack(ordered, sheetW, sheetH);
    if (result) return result;
  }
  return null;
}

// ── Fill Remaining Space ──────────────────────────────────────────────────
// After placing the main allocation groups, scan the free rectangles on the
// sheet and try to place additional bonus groups from any project.
// This maximizes space utilization — critical in gang running.

export function fillRemainingSpace(
  placedGroups: PlacedGroup[],
  sheetW: number,
  sheetH: number,
  bleedIn: number,
  projects: { name: string; projectIdx: number; outs: number; stickerWidth: number; stickerHeight: number }[]
): PlacedGroup[] {
  // Reconstruct free rectangles from placed groups
  let freeRects: MaxRect[] = [{ x: 0, y: 0, width: sheetW, height: sheetH }];

  for (const pg of placedGroups) {
    freeRects = splitFreeRects(freeRects, pg.x, pg.y, pg.width, pg.height);
    freeRects = pruneFreeRects(freeRects);
  }

  // For each project, try to place additional bonus groups in free space
  const bonusGroups: PlacedGroup[] = [];
  let improved = true;
  let iterations = 0;
  const MAX_ITERATIONS = 50; // Prevent infinite loops

  while (improved && iterations < MAX_ITERATIONS) {
    improved = false;
    iterations++;

    for (const proj of projects) {
      // Try smaller group sizes first (more likely to fit in narrow strips)
      // Start from 1 sticker up to the project's outs
      const bonusOutsOptions: number[] = [];
      for (let o = 1; o <= Math.min(proj.outs, 12); o++) {
        bonusOutsOptions.push(o);
      }
      // Also try the project's full outs in case it fits as a secondary group
      if (proj.outs > 12) bonusOutsOptions.push(proj.outs);

      for (const bonusOuts of bonusOutsOptions) {
        const bonusShapes = getGroupShapes(bonusOuts);

        for (const shape of bonusShapes) {
          // Try both orientations
          const orientations: { sw: number; sh: number }[] = [];
          orientations.push({ sw: proj.stickerWidth, sh: proj.stickerHeight });
          if (Math.abs(proj.stickerWidth - proj.stickerHeight) > 0.001) {
            orientations.push({ sw: proj.stickerHeight, sh: proj.stickerWidth });
          }

          for (const orient of orientations) {
            const dims = groupDimensions(shape, orient.sw, orient.sh, bleedIn);
            const result = findBestFreeRect(freeRects, dims.width, dims.height, sheetW, sheetH);
            if (result) {
              let placedW: number, placedH: number;
              let placedShape: GroupShape;
              let placedStickerW: number, placedStickerH: number;

              if (result.rotated) {
                placedW = dims.height;
                placedH = dims.width;
                placedShape = { w: shape.h, h: shape.w };
                placedStickerW = orient.sh;
                placedStickerH = orient.sw;
              } else {
                placedW = dims.width;
                placedH = dims.height;
                placedShape = { ...shape };
                placedStickerW = orient.sw;
                placedStickerH = orient.sh;
              }

              // Boundary check
              if (result.x + placedW > sheetW + 0.001 || result.y + placedH > sheetH + 0.001) continue;

              const bonusGroup: PlacedGroup = {
                name: proj.name,
                projectIdx: proj.projectIdx,
                shape: placedShape,
                outs: bonusOuts,
                x: result.x,
                y: result.y,
                width: placedW,
                height: placedH,
                stickerWidth: placedStickerW,
                stickerHeight: placedStickerH,
              };

              bonusGroups.push(bonusGroup);
              freeRects = splitFreeRects(freeRects, result.x, result.y, placedW, placedH);
              freeRects = pruneFreeRects(freeRects);
              improved = true;
              break; // Move to next project after placing one bonus group
            }
          }
          if (improved) break;
        }
        if (improved) break;
      }
      if (improved) break; // Restart from the beginning to try all projects again
    }
  }

  return [...placedGroups, ...bonusGroups];
}

// ── Shape Combination Packing (with both sticker orientations) ────────────
// Each project = ONE group. No orphan stickers.

function findValidPacking(
  allocation: { name: string; projectIdx: number; outs: number; stickerWidth: number; stickerHeight: number }[],
  sheetW: number,
  sheetH: number,
  bleedIn: number
): { shapes: GroupShape[]; placedGroups: PlacedGroup[] } | null {
  const n = allocation.length;

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

      // Rotated sticker orientation
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

  for (const variants of allGroupVariants) {
    if (variants.length === 0) return null;
  }

  let bestPacking: { shapes: GroupShape[]; placedGroups: PlacedGroup[]; usedArea: number } | null = null;
  let attempts = 0;
  const maxAttempts = 2000; // Reduced from 50000 for performance — 7-project inputs must complete in <5s

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
// Each project = ONE group. Search larger outs to maximize sheet fill.

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

  const perProjectMax: number[] = stickerSizes.map((s) => {
    const cellW1 = s.width + 2 * bleedIn;
    const cellH1 = s.height + 2 * bleedIn;
    const cols1 = Math.floor(sheetW / cellW1);
    const rows1 = Math.floor(sheetH / cellH1);
    const gridCap1 = cols1 * rows1;
    const cellW2 = s.height + 2 * bleedIn;
    const cellH2 = s.width + 2 * bleedIn;
    const cols2 = Math.floor(sheetW / cellW2);
    const rows2 = Math.floor(sheetH / cellH2);
    const gridCap2 = cols2 * rows2;
    const gridCap = Math.max(gridCap1, gridCap2);
    // Area-based estimate: allows non-grid layouts (e.g., 2×5 rotated layout)
    // which can fit more stickers than the rigid grid suggests
    const minCellArea = Math.min(cellW1 * cellH1, cellW2 * cellH2);
    const areaCap = Math.floor((sheetW * sheetH) / minCellArea);
    // Use the larger of grid or area estimate, with 20% headroom for mixed shapes
    const estimatedCap = Math.ceil(Math.max(gridCap, areaCap) * 1.2);
    return Math.max(Math.min(estimatedCap, maxSlots), minOuts);
  });

  // ── STEP 1: Compute all critical L values ──────────────────────────────

  const criticalLs = new Set<number>();
  for (let i = 0; i < n; i++) {
    for (let k = minOuts; k <= perProjectMax[i]; k++) {
      criticalLs.add(Math.ceil(demands[i] / k));
    }
    criticalLs.add(1);
    criticalLs.add(demands[i]);
  }

  const sortedLs = [...criticalLs].sort((a, b) => a - b);

  // ── STEP 2: For each L, search for the allocation that MAXIMIZES yield ─
  // Not just minimum outs — try larger outs to fill the sheet better.
  // Each project stays as ONE connected group.

  const triedAllocations = new Set<string>();
  let globalBestL = Infinity;
  let globalBestResult: AllocationWithPacking | null = null;
  let globalBestYield = 0;
  const searchStartTime = Date.now();
  const MAX_SEARCH_TIME_MS = 5000; // 5 second timeout — was 8s, reduced for Render free tier

  for (const L of sortedLs) {
    if (L >= globalBestL) break;
    if (Date.now() - searchStartTime > MAX_SEARCH_TIME_MS) break;

    const minAllocation = demands.map((d) => Math.max(minOuts, Math.ceil(d / L)));
    const minTotalOuts = minAllocation.reduce((s, o) => s + o, 0);

    if (minTotalOuts > maxSlots) continue;

    const extraSlots = maxSlots - minTotalOuts;

    // Generate allocation variants: minimum + ways to increase outs
    const allocationsToTry: number[][] = [[...minAllocation]];

    if (extraSlots > 0) {
      generateExtraSlotDistributions(minAllocation, extraSlots, perProjectMax, allocationsToTry, 100); // Reduced from 300 for performance
    }

    let bestPackingForL: AllocationWithPacking | null = null;
    let bestYieldForL = 0;

    for (const alloc of allocationsToTry) {
      const key = alloc.join(",");
      if (triedAllocations.has(key)) continue;
      triedAllocations.add(key);

      let actualL = 0;
      for (let i = 0; i < n; i++) {
        actualL = Math.max(actualL, Math.ceil(demands[i] / alloc[i]));
      }

      if (actualL >= globalBestL) continue;

      const allocInfo = alloc.map((outs, i) => ({
        name: `p${i}`,
        projectIdx: i,
        outs,
        stickerWidth: stickerSizes[i].width,
        stickerHeight: stickerSizes[i].height,
      }));

      const packing = findValidPacking(allocInfo, sheetW, sheetH, bleedIn);

      if (packing) {
        // Compute material yield for this packing
        const sheetArea = sheetW * sheetH;
        let usedStickerArea = 0;
        for (let i = 0; i < n; i++) {
          usedStickerArea += alloc[i] * stickerSizes[i].width * stickerSizes[i].height;
        }
        const yieldPct = (usedStickerArea / (sheetArea * actualL)) * 100;

        if (yieldPct > bestYieldForL || !bestPackingForL) {
          bestYieldForL = yieldPct;
          bestPackingForL = {
            allocation: [...alloc],
            runLength: actualL,
            shapes: packing.shapes,
            placedGroups: packing.placedGroups,
          };
        }
      }
    }

    if (bestPackingForL) {
      globalBestL = bestPackingForL.runLength;
      globalBestYield = bestYieldForL;
      globalBestResult = bestPackingForL;
    }
  }

  // ── STEP 3: Fallback — brute force search ──────────────────────────────

  if (!globalBestResult) {
    let bestL = Infinity;
    let bestResult: AllocationWithPacking | null = null;
    let totalSearchIterations = 0;
    const MAX_SEARCH_ITERATIONS = 20000; // Reduced from 100000 — prevents timeout on 7-project inputs

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
            bestResult = {
              allocation: [...current], runLength: L,
              shapes: packing.shapes, placedGroups: packing.placedGroups,
            };
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

    // Apply yield maximization to fallback result too
    if (bestResult) {
      bestResult = maximizeYield(bestResult, demands, stickerSizes, sheetW, sheetH, bleedIn, perProjectMax);
    }
    return bestResult;
  }

  // ── STEP 4: Yield Maximization ──────────────────────────────────────────
  // After finding the best run length, try to increase each project's outs
  // to fill the sheet better (same run length, higher material yield).

  globalBestResult = maximizeYield(globalBestResult, demands, stickerSizes, sheetW, sheetH, bleedIn, perProjectMax);

  return globalBestResult;
}

// ── Yield Maximization ───────────────────────────────────────────────────
// Aggressively increase each project's outs to fill the sheet better.
// Strategy: first try jumping to max, then binary-search down if needed.

function maximizeYield(
  bestResult: AllocationWithPacking | null,
  demands: number[],
  stickerSizes: { width: number; height: number }[],
  sheetW: number,
  sheetH: number,
  bleedIn: number,
  perProjectMax: number[]
): AllocationWithPacking | null {
  if (!bestResult) return null;

  const n = demands.length;
  const allocation = [...bestResult.allocation];
  const targetL = bestResult.runLength;
  let currentShapes = [...bestResult.shapes];
  let currentPlaced = bestResult.placedGroups;

  // Phase 1: Try jumping each project to its max outs (binary search down if needed)
  for (let i = 0; i < n; i++) {
    const maxOuts = perProjectMax[i];
    if (allocation[i] >= maxOuts) continue;

    // Try the maximum first
    let bestOuts = allocation[i];
    let lo = allocation[i] + 1;
    let hi = maxOuts;

    while (lo <= hi) {
      const mid = Math.ceil((lo + hi) / 2);
      const testAlloc = [...allocation];
      testAlloc[i] = mid;

      const allocInfo = testAlloc.map((outs, j) => ({
        name: `p${j}`, projectIdx: j, outs,
        stickerWidth: stickerSizes[j].width, stickerHeight: stickerSizes[j].height,
      }));

      const packing = findValidPacking(allocInfo, sheetW, sheetH, bleedIn);
      if (packing) {
        let newL = 0;
        for (let j = 0; j < n; j++) newL = Math.max(newL, Math.ceil(demands[j] / testAlloc[j]));
        if (newL <= targetL) {
          bestOuts = mid;
          currentShapes = packing.shapes;
          currentPlaced = packing.placedGroups;
          lo = mid + 1; // Try even higher
        } else {
          hi = mid - 1; // Too high, try lower
        }
      } else {
        hi = mid - 1; // Doesn't pack, try lower
      }
    }

    if (bestOuts > allocation[i]) {
      allocation[i] = bestOuts;
    }
  }

  // Phase 2: Greedy +1 passes to catch any remaining improvements
  let improved = true;
  let passCount = 0;
  while (improved && passCount < 3) {
    improved = false;
    passCount++;
    for (let i = 0; i < n; i++) {
      if (allocation[i] >= perProjectMax[i]) continue;

      const newOuts = allocation[i] + 1;

      const testAlloc = [...allocation];
      testAlloc[i] = newOuts;

      const allocInfo = testAlloc.map((outs, j) => ({
        name: `p${j}`, projectIdx: j, outs,
        stickerWidth: stickerSizes[j].width, stickerHeight: stickerSizes[j].height,
      }));

      const packing = findValidPacking(allocInfo, sheetW, sheetH, bleedIn);
      if (packing) {
        let newL = 0;
        for (let j = 0; j < n; j++) newL = Math.max(newL, Math.ceil(demands[j] / testAlloc[j]));
        if (newL <= targetL) {
          allocation[i] = newOuts;
          currentShapes = packing.shapes;
          currentPlaced = packing.placedGroups;
          improved = true;
        }
      }
    }
  }

  // Recompute run length (should be same or better)
  let finalL = 0;
  for (let i = 0; i < n; i++) finalL = Math.max(finalL, Math.ceil(demands[i] / allocation[i]));

  return {
    allocation,
    runLength: finalL,
    shapes: currentShapes,
    placedGroups: currentPlaced,
  };
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

  // Strategy 1: Give all extra to each project (maximizes that project's group)
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
    if (remaining === 0 && results.length < maxResults) results.push(alloc);
  }

  // Strategy 3: Give to smallest outs first (they benefit most from more stickers)
  {
    const alloc = [...baseAllocation];
    const indices = Array.from({ length: n }, (_, i) => i);
    indices.sort((a, b) => {
      const diff = baseAllocation[a] - baseAllocation[b];
      if (diff !== 0) return diff;
      return a - b; // Deterministic tiebreaker
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
    if (remaining === 0 && results.length < maxResults) results.push(alloc);
  }

  // Strategy 4: Give 1 extra to each project individually
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

  // Strategy 5: Try giving 2 extra to each project
  if (extraSlots >= 2 && results.length < maxResults) {
    for (let i = 0; i < n; i++) {
      if (results.length >= maxResults) return;
      if (baseAllocation[i] + 2 <= perProjectMax[i]) {
        const alloc = [...baseAllocation];
        alloc[i] += 2;
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
  // ── Fill remaining space on the sheet with bonus groups ──────────────────
  // This is critical for gang running: every inch of sheet space should be used.
  // After the main allocation is placed, try to fill remaining free rectangles
  // with additional groups from any project on this plate.

  const projInfo = indices.map((projIdx, i) => ({
    name: `p${i}`,
    projectIdx: i,
    outs: allocation[i],
    stickerWidth: projects[projIdx].stickerWidth,
    stickerHeight: projects[projIdx].stickerHeight,
  }));

  const filledGroups = fillRemainingSpace(placedGroups, sheetW, sheetH, bleedIn, projInfo);

  // Safety: filter out any placed groups that exceed sheet boundaries
  const validGroups = filledGroups.filter((pg) => {
    return pg.x + pg.width <= sheetW + 0.01 && pg.y + pg.height <= sheetH + 0.01;
  });

  // Calculate effective outs per project (main + bonus groups)
  // Each placed group for a project adds its outs to the total outs per sheet
  const effectiveOuts: number[] = new Array(indices.length).fill(0);
  for (const pg of validGroups) {
    const localIdx = parseInt(pg.name.replace("p", ""));
    if (localIdx >= 0 && localIdx < indices.length) {
      effectiveOuts[localIdx] += pg.outs;
    }
  }

  // Use effective outs (which include bonus groups) for production calculation
  let totalOrderQty = 0;
  const allocationEntries: AllocationEntry[] = indices.map((projIdx, i) => {
    const qty = projects[projIdx].quantity;
    const outs = effectiveOuts[i];
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

  const totalProduced = allocationEntries.reduce((sum, a) => sum + a.produced, 0);

  const remappedGroups: PlacedGroup[] = validGroups.map((pg) => {
    const localIdx = parseInt(pg.name.replace("p", ""));
    return {
      ...pg,
      name: projects[indices[localIdx]].name,
      projectIdx: indices[localIdx],
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
  let gridBasedCap = 0;
  let areaBasedCap = 0;
  const sheetArea = sheetW * sheetH;

  for (const s of stickerSizes) {
    // Grid-based estimate (conservative)
    const cellW1 = s.width + 2 * bleedIn;
    const cellH1 = s.height + 2 * bleedIn;
    const cols1 = Math.floor(sheetW / cellW1);
    const rows1 = Math.floor(sheetH / cellH1);
    gridBasedCap = Math.max(gridBasedCap, cols1 * rows1);
    const cellW2 = s.height + 2 * bleedIn;
    const cellH2 = s.width + 2 * bleedIn;
    const cols2 = Math.floor(sheetW / cellW2);
    const rows2 = Math.floor(sheetH / cellH2);
    gridBasedCap = Math.max(gridBasedCap, cols2 * rows2);

    // Area-based estimate (generous — accounts for mixed group shapes)
    // With group packing, stickers from different projects can be arranged
    // in non-grid layouts, so area is a better upper bound
    const minCellArea = Math.min(cellW1 * cellH1, cellW2 * cellH2);
    areaBasedCap = Math.max(areaBasedCap, Math.floor(sheetArea / minCellArea));
  }

  // Use the larger of grid-based or area-based, with moderate headroom.
  // The two-plate search needs some extra room beyond the grid estimate
  // to find better splits (e.g., [a,b,d]|[c,e,f,g] needs outs>18 on sub-plates).
  // But too much headroom makes the search slow.
  const estimatedCap = Math.max(gridBasedCap, areaBasedCap);
  const withHeadroom = Math.ceil(estimatedCap * 1.15);
  return Math.max(withHeadroom, stickerSizes.length * 2);
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
  let bestYield = 0; // Track yield for tiebreaking
  let bestResult: TwoPlateResult | null = null;

  const startTime = Date.now();
  const MAX_TIME_MS = 15000; // 15 second timeout for two-plate search (was 30s, reduced for Render free tier)

  // ── Generate all valid plate splits ──────────────────────────────────────
  // Key fix: try ALL 2^n - 2 splits (not just ones where project 0 is on plate 1)
  // This ensures that when all projects have identical dimensions, the algorithm
  // can find the optimal split that puts the highest-quantity project on its own plate.
  //
  // Also add quantity-weighted priority splits for same-dimension projects:
  // When all projects have the same sticker size, splitting the highest-quantity
  // project onto its own plate gives the best flexibility and space utilization.

  const totalMasks = 1 << n;
  // Track which splits we've tried to avoid duplicates (mask vs ~mask)
  const triedSplits = new Set<string>();

  for (let mask = 1; mask < totalMasks - 1; mask++) {
    if (Date.now() - startTime > MAX_TIME_MS) break;

    const plate1Indices: number[] = [];
    const plate2Indices: number[] = [];
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) plate1Indices.push(i);
      else plate2Indices.push(i);
    }

    if (plate1Indices.length === 0 || plate2Indices.length === 0) continue;
    if (plate1Indices.length * 2 > maxSlots || plate2Indices.length * 2 > maxSlots) continue;

    // Avoid trying mirror splits (e.g., [a,b]|cd and [c,d]|[a,b] are the same)
    // Use canonical form: the split whose plate1 has the smaller first index
    const splitKey = plate1Indices.join(",") + "|" + plate2Indices.join(",");
    const mirrorKey = plate2Indices.join(",") + "|" + plate1Indices.join(",");
    if (triedSplits.has(splitKey) || triedSplits.has(mirrorKey)) continue;
    triedSplits.add(splitKey);

    const p1Demands = plate1Indices.map((i) => demands[i]);
    const p1StickerSizes = plate1Indices.map((i) => stickerSizes[i]);
    const p1Result = findBestAllocationWithPacking(p1Demands, p1StickerSizes, sheetW, sheetH, bleedIn, maxSlots);
    if (!p1Result) continue;

    const p2Demands = plate2Indices.map((i) => demands[i]);
    const p2StickerSizes = plate2Indices.map((i) => stickerSizes[i]);
    const p2Result = findBestAllocationWithPacking(p2Demands, p2StickerSizes, sheetW, sheetH, bleedIn, maxSlots);
    if (!p2Result) continue;

    const totalSheets = p1Result.runLength + p2Result.runLength;

    // Compute material yield for tiebreaking (weighted average of per-plate yields)
    const sheetArea = sheetW * sheetH;
    let p1StickerArea = 0;
    for (let i = 0; i < p1Result.allocation.length; i++) {
      p1StickerArea += p1Result.allocation[i] * p1StickerSizes[i].width * p1StickerSizes[i].height;
    }
    let p2StickerArea = 0;
    for (let i = 0; i < p2Result.allocation.length; i++) {
      p2StickerArea += p2Result.allocation[i] * p2StickerSizes[i].width * p2StickerSizes[i].height;
    }
    // Weighted yield: average yield across all sheets
    const p1Yield = (p1StickerArea * p1Result.runLength) / (sheetArea * p1Result.runLength) * 100;
    const p2Yield = (p2StickerArea * p2Result.runLength) / (sheetArea * p2Result.runLength) * 100;
    const totalStickerAreaAll = p1StickerArea * p1Result.runLength + p2StickerArea * p2Result.runLength;
    const totalSheetArea = sheetArea * totalSheets;
    const materialYield = totalSheetArea > 0 ? (totalStickerAreaAll / totalSheetArea) * 100 : 0;

    // Accept if fewer sheets, or same sheets with better yield
    if (totalSheets < bestTotal || (totalSheets === bestTotal && materialYield > bestYield)) {
      bestTotal = totalSheets;
      bestYield = materialYield;

      const plate1Res = buildPlateResult(projects, plate1Indices, p1Result.allocation, p1Result.shapes, p1Result.runLength, sheetW, sheetH, bleedIn, p1Result.placedGroups);
      const plate2Res = buildPlateResult(projects, plate2Indices, p2Result.allocation, p2Result.shapes, p2Result.runLength, sheetW, sheetH, bleedIn, p2Result.placedGroups);

      const combinedProduced = plate1Res.totalProduced + plate2Res.totalProduced;
      const totalOrderQty = demands.reduce((s, q) => s + q, 0);

      // Compute combined yield from the actual built plate results
      const combinedStickerArea = plate1Res.allocation.reduce((s, a) => s + a.produced * a.stickerWidth * a.stickerHeight, 0)
        + plate2Res.allocation.reduce((s, a) => s + a.produced * a.stickerWidth * a.stickerHeight, 0);
      const combinedSheetArea = (plate1Res.runLength + plate2Res.runLength) * sheetW * sheetH;
      const combinedYield = combinedSheetArea > 0 ? (combinedStickerArea / combinedSheetArea) * 100 : 0;

      bestResult = {
        plate1: plate1Res, plate2: plate2Res,
        totalSheets, totalProduced: combinedProduced,
        totalOverage: combinedProduced - totalOrderQty,
        materialYield: combinedYield, sheetsSaved: 0,
        plate1ProjectIndices: plate1Indices,
        plate2ProjectIndices: plate2Indices,
      };
    }
  }

  // ── Priority splits for same-dimension projects ──────────────────────────
  // When all projects have the same sticker dimensions, the most efficient
  // split is to put the project with the HIGHEST quantity on its own plate.
  // This gives the most flexibility in filling sheets.
  // Try these priority splits even if they were already covered above,
  // but with higher maxSlots for the single-project plate to maximize fill.

  const allSameDim = stickerSizes.every((s, _, arr) =>
    Math.abs(s.width - arr[0].width) < 0.001 && Math.abs(s.height - arr[0].height) < 0.001
  );

  if (allSameDim && n >= 2) {
    // Sort projects by quantity descending — deterministic tiebreaker by index
    const sortedByQty = Array.from({ length: n }, (_, i) => i)
      .sort((a, b) => demands[b] - demands[a] || a - b);

    // Try splitting each project onto its own plate (highest quantity first)
    for (const singleIdx of sortedByQty) {
      if (Date.now() - startTime > MAX_TIME_MS) break;

      const singlePlate = [singleIdx];
      const multiPlate = Array.from({ length: n }, (_, i) => i).filter(i => i !== singleIdx);

      // Compute a larger maxSlots for the single-project plate to maximize fill
      const singleStickerSize = stickerSizes[singleIdx];
      const bleedMm = bleedIn * 25.4;
      const singleMaxSlots = estimateMaxSlots(sheetW, sheetH, [singleStickerSize], bleedMm);

      const p1Demands = multiPlate.map((i) => demands[i]);
      const p1StickerSizes = multiPlate.map((i) => stickerSizes[i]);
      const p1Result = findBestAllocationWithPacking(p1Demands, p1StickerSizes, sheetW, sheetH, bleedIn, maxSlots);
      if (!p1Result) continue;

      const p2Demands = singlePlate.map((i) => demands[i]);
      const p2StickerSizes = singlePlate.map((i) => stickerSizes[i]);
      // Use the larger maxSlots for the single-project plate to maximize space fill
      const p2Result = findBestAllocationWithPacking(p2Demands, p2StickerSizes, sheetW, sheetH, bleedIn, Math.max(maxSlots, singleMaxSlots));
      if (!p2Result) continue;

      const totalSheets = p1Result.runLength + p2Result.runLength;

      // Compute material yield (total sticker area across all runs / total sheet area)
      const sheetArea = sheetW * sheetH;
      let p1StickerArea = 0;
      for (let i = 0; i < p1Result.allocation.length; i++) {
        p1StickerArea += p1Result.allocation[i] * p1StickerSizes[i].width * p1StickerSizes[i].height;
      }
      let p2StickerArea = 0;
      for (let i = 0; i < p2Result.allocation.length; i++) {
        p2StickerArea += p2Result.allocation[i] * p2StickerSizes[i].width * p2StickerSizes[i].height;
      }
      const totalStickerAreaAll = p1StickerArea * p1Result.runLength + p2StickerArea * p2Result.runLength;
      const totalSheetArea = sheetArea * totalSheets;
      const materialYield = totalSheetArea > 0 ? (totalStickerAreaAll / totalSheetArea) * 100 : 0;

      if (totalSheets < bestTotal || (totalSheets === bestTotal && materialYield > bestYield)) {
        bestTotal = totalSheets;
        bestYield = materialYield;

        const plate1Res = buildPlateResult(projects, multiPlate, p1Result.allocation, p1Result.shapes, p1Result.runLength, sheetW, sheetH, bleedIn, p1Result.placedGroups);
        const plate2Res = buildPlateResult(projects, singlePlate, p2Result.allocation, p2Result.shapes, p2Result.runLength, sheetW, sheetH, bleedIn, p2Result.placedGroups);

        const combinedProduced = plate1Res.totalProduced + plate2Res.totalProduced;
        const totalOrderQty = demands.reduce((s, q) => s + q, 0);

        // Compute combined yield from the actual built plate results
        const combinedStickerArea = plate1Res.allocation.reduce((s, a) => s + a.produced * a.stickerWidth * a.stickerHeight, 0)
          + plate2Res.allocation.reduce((s, a) => s + a.produced * a.stickerWidth * a.stickerHeight, 0);
        const combinedSheetArea = (plate1Res.runLength + plate2Res.runLength) * sheetW * sheetH;
        const combinedYield = combinedSheetArea > 0 ? (combinedStickerArea / combinedSheetArea) * 100 : 0;

        bestResult = {
          plate1: plate1Res, plate2: plate2Res,
          totalSheets, totalProduced: combinedProduced,
          totalOverage: combinedProduced - totalOrderQty,
          materialYield: combinedYield, sheetsSaved: 0,
          plate1ProjectIndices: multiPlate,
          plate2ProjectIndices: singlePlate,
        };
      }
    }
  }

  return bestResult;
}

// ── Multi-Plate Optimization (3+ plates) ────────────────────────────────
// When 1 or 2 plates aren't enough (small sheets, many projects),
// use First Fit Decreasing bin-packing to distribute projects across plates.

export function findBestMultiPlate(
  projects: ProjectInput[],
  maxSlots: number,
  sheetW: number,
  sheetH: number,
  bleedIn: number
): MultiPlateResult | null {
  const n = projects.length;
  if (n === 0) return null;

  const demands = projects.map((p) => p.quantity);
  const stickerSizes = projects.map((p) => ({ width: p.stickerWidth, height: p.stickerHeight }));

  // Strategy: try different plate groupings using First Fit Decreasing
  // Sort projects by quantity (descending) — largest projects first tend to pack better
  const indices = Array.from({ length: n }, (_, i) => i);

  // Try multiple orderings to find the best grouping
  const orderings: number[][] = [
    [...indices].sort((a, b) => demands[b] - demands[a] || a - b),  // Largest quantity first (deterministic)
    [...indices].sort((a, b) => demands[a] - demands[b] || a - b),  // Smallest quantity first (deterministic)
    [...indices],                                            // Original order
  ];

  let bestResult: MultiPlateResult | null = null;

  for (const ordering of orderings) {
    const result = tryMultiPlateOrdering(ordering, projects, demands, stickerSizes, maxSlots, sheetW, sheetH, bleedIn);
    if (result) {
      if (!bestResult || result.totalSheets < bestResult.totalSheets) {
        bestResult = result;
      }
    }
  }

  return bestResult;
}

function tryMultiPlateOrdering(
  ordering: number[],
  projects: ProjectInput[],
  demands: number[],
  stickerSizes: { width: number; height: number }[],
  maxSlots: number,
  sheetW: number,
  sheetH: number,
  bleedIn: number
): MultiPlateResult | null {
  // First Fit Decreasing: assign each project to the first plate that can fit it,
  // or create a new plate if none can.
  // Then optimize each plate independently.

  const startTime = Date.now();
  const MAX_TIME_MS = 15000; // 15 second timeout

  // Start by trying to pack all projects into as few plates as possible
  // Each plate is a list of project indices
  const plates: number[][] = [];

  for (const projIdx of ordering) {
    // Timeout check
    if (Date.now() - startTime > MAX_TIME_MS) return null;

    let placed = false;

    // Try to add this project to an existing plate
    for (let p = 0; p < plates.length; p++) {
      if (Date.now() - startTime > MAX_TIME_MS) return null;
      const testPlate = [...plates[p], projIdx];
      // Quick pre-check: can these projects even fit by area?
      const totalMinOuts = testPlate.length * 2;
      if (totalMinOuts > maxSlots) continue;
      const pDemands = testPlate.map(i => demands[i]);
      const pSizes = testPlate.map(i => stickerSizes[i]);
      const result = findBestAllocationWithPacking(pDemands, pSizes, sheetW, sheetH, bleedIn, maxSlots);
      if (result) {
        plates[p] = testPlate;
        placed = true;
        break;
      }
    }

    if (!placed) {
      // Create a new plate for this project
      plates.push([projIdx]);
    }
  }

  if (plates.length === 0) return null;

  // Now optimize each plate and compute totals
  const plateResults: PlateResult[] = [];
  const plateProjectIndices: number[][] = [];
  let totalSheets = 0;
  let totalProduced = 0;
  let totalOrderQty = 0;
  let totalStickerArea = 0;

  for (const plateIndices of plates) {
    const pDemands = plateIndices.map(i => demands[i]);
    const pSizes = plateIndices.map(i => stickerSizes[i]);
    const result = findBestAllocationWithPacking(pDemands, pSizes, sheetW, sheetH, bleedIn, maxSlots);
    if (!result) return null; // Should not happen since we tested during assignment

    const plateRes = buildPlateResult(projects, plateIndices, result.allocation, result.shapes, result.runLength, sheetW, sheetH, bleedIn, result.placedGroups);
    plateResults.push(plateRes);
    plateProjectIndices.push(plateIndices);

    totalSheets += plateRes.runLength;
    totalProduced += plateRes.totalProduced;
    totalOrderQty += plateRes.allocation.reduce((s, a) => s + a.quantity, 0);
    totalStickerArea += plateRes.allocation.reduce((s, a) => s + a.produced * a.stickerWidth * a.stickerHeight, 0);
  }

  const sheetArea = sheetW * sheetH;
  const totalSheetArea = totalSheets * sheetArea;
  const materialYield = totalSheetArea > 0 ? (totalStickerArea / totalSheetArea) * 100 : 0;

  return {
    plates: plateResults,
    totalSheets,
    totalProduced,
    totalOverage: totalProduced - totalOrderQty,
    materialYield,
    plateCount: plates.length,
    plateProjectIndices,
  };
}

// ── Full Calculation ───────────────────────────────────────────────────────

export interface MultiSizeCalculateResponse {
  capacity: CapacityResult | null;
  maxSlots: number;
  singlePlateResult: PlateResult | null;
  twoPlateResult: TwoPlateResult | null;
  multiPlateResult: MultiPlateResult | null;
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
    return { capacity: null, maxSlots: 0, singlePlateResult: null, twoPlateResult: null, multiPlateResult: null, error: "Missing required dimension parameters." };
  }

  const projects = rawProjects.filter((p) => p.quantity > 0 && p.stickerWidth > 0 && p.stickerHeight > 0);
  if (projects.length === 0) {
    return { capacity: null, maxSlots: 0, singlePlateResult: null, twoPlateResult: null, multiPlateResult: null, error: "No projects with positive quantities and valid sticker sizes." };
  }

  const bleedIn = bleed / 25.4;

  const capacity = calculateCapacity(sheetWidth, sheetHeight, projects[0].stickerWidth, projects[0].stickerHeight, bleed);

  const maxSlots = estimateMaxSlots(sheetWidth, sheetHeight, projects.map((p) => ({ width: p.stickerWidth, height: p.stickerHeight })), bleed);

  // Grid-based maxSlots (conservative, fast for single-plate with many projects)
  const gridMaxSlots = (() => {
    const bi = bleed / 25.4;
    let cap = 0;
    for (const p of projects) {
      const c1 = Math.floor(sheetWidth / (p.stickerWidth + 2 * bi)) * Math.floor(sheetHeight / (p.stickerHeight + 2 * bi));
      const c2 = Math.floor(sheetWidth / (p.stickerHeight + 2 * bi)) * Math.floor(sheetHeight / (p.stickerWidth + 2 * bi));
      cap = Math.max(cap, c1, c2);
    }
    return Math.max(cap, projects.length * 2);
  })();

  // Single plate optimization — use grid-based maxSlots for speed
  let singlePlateResult: PlateResult | null = null;
  if (projects.length * 2 <= gridMaxSlots) {
    const demands = projects.map((p) => p.quantity);
    const stickerSizes = projects.map((p) => ({ width: p.stickerWidth, height: p.stickerHeight }));
    const result = findBestAllocationWithPacking(demands, stickerSizes, sheetWidth, sheetHeight, bleedIn, gridMaxSlots);
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

  // Multi-plate optimization (3+ plates) — fallback when 1 or 2 plates aren't enough
  let multiPlateResult: MultiPlateResult | null = null;
  if (!singlePlateResult && !twoPlateResult) {
    // Neither 1 nor 2 plates work — need 3+ plates
    multiPlateResult = findBestMultiPlate(projects, maxSlots, sheetWidth, sheetHeight, bleedIn);
  }

  return { capacity, maxSlots, singlePlateResult, twoPlateResult, multiPlateResult };
}
