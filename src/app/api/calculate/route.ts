import { NextResponse } from "next/server";

// ── Types ──────────────────────────────────────────────────────────────────

interface ProjectInput {
  name: string;
  quantity: number;
}

interface CalculateRequest {
  sheetWidth: number;
  sheetHeight: number;
  stickerWidth: number;
  stickerHeight: number;
  bleed: number; // mm
  projects: ProjectInput[];
}

interface AllocationEntry {
  name: string;
  quantity: number;
  outs: number;
  produced: number;
  overage: number;
  overagePct: number;
}

interface PlateResult {
  allocation: AllocationEntry[];
  runLength: number;
  totalSheets: number;
  totalProduced: number;
  totalOverage: number;
  materialYield: number;
}

interface TwoPlateResult {
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

interface CapacityResult {
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

interface CalculateResponse {
  capacity: CapacityResult;
  singlePlateResult: PlateResult | null;
  twoPlateResult: TwoPlateResult | null;
  error?: string;
}

// ── Sheet Capacity ─────────────────────────────────────────────────────────

function calculateCapacity(
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

// ── Single Plate Optimization (Exhaustive Search with Pruning) ─────────────

function findBestAllocation(demands: number[], slots: number, minOuts: number = 2): { allocation: number[]; runLength: number } | null {
  const n = demands.length;
  if (n === 0) return null;
  if (n * minOuts > slots) return null; // Can't fit all projects with minimum outs

  let bestL = Infinity;
  let bestAlloc: number[] | null = null;
  const current = new Array(n).fill(0);

  function search(idx: number, remaining: number): void {
    if (idx === n - 1) {
      current[idx] = remaining;
      if (remaining >= minOuts) {
        let L = 0;
        for (let i = 0; i < n; i++) {
          L = Math.max(L, Math.ceil(demands[i] / current[i]));
        }
        if (L < bestL) {
          bestL = L;
          bestAlloc = [...current];
        }
      }
      return;
    }

    const minRemaining = (n - idx - 1) * minOuts; // each remaining project needs at least minOuts
    const maxVal = remaining - minRemaining;
    for (let val = minOuts; val <= maxVal; val++) {
      current[idx] = val;
      // Pruning: compute partial run length
      let partialL = 0;
      for (let i = 0; i <= idx; i++) {
        partialL = Math.max(partialL, Math.ceil(demands[i] / current[i]));
      }
      if (partialL >= bestL) continue; // prune
      search(idx + 1, remaining - val);
    }
  }

  search(0, slots);
  if (bestAlloc === null) return null;
  return { allocation: bestAlloc, runLength: bestL };
}

// ── Build Plate Result ─────────────────────────────────────────────────────

function buildPlateResult(
  projects: ProjectInput[],
  indices: number[],
  allocation: number[],
  runLength: number,
  capacity: CapacityResult
): PlateResult {
  const totalProduced = allocation.reduce(
    (sum, outs, i) => sum + outs * runLength,
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
    };
  });

  const stickerArea =
    capacity.stickerWidth * capacity.stickerHeight;
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
  };
}

// ── Two-Plate Optimization ─────────────────────────────────────────────────

function findBestTwoPlate(
  projects: ProjectInput[],
  slots: number,
  capacity: CapacityResult
): TwoPlateResult | null {
  const n = projects.length;
  if (n < 2) return null;

  const demands = projects.map((p) => p.quantity);
  let bestTotal = Infinity;
  let bestResult: TwoPlateResult | null = null;

  // Enumerate all non-trivial splits using bitmask
  // Fix project 0 to plate 1 to avoid symmetric duplicates
  const totalMasks = 1 << n;
  for (let mask = 1; mask < totalMasks - 1; mask++) {
    // Ensure project 0 is on plate 1 (bit 0 set) to avoid duplicates
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
    if (plate1Indices.length > slots || plate2Indices.length > slots) continue;

    // Optimize plate 1
    const p1Demands = plate1Indices.map((i) => demands[i]);
    const p1Result = findBestAllocation(p1Demands, slots);
    if (!p1Result) continue;

    // Optimize plate 2
    const p2Demands = plate2Indices.map((i) => demands[i]);
    const p2Result = findBestAllocation(p2Demands, slots);
    if (!p2Result) continue;

    const totalSheets = p1Result.runLength + p2Result.runLength;
    if (totalSheets >= bestTotal) continue;

    bestTotal = totalSheets;

    const plate1Res = buildPlateResult(
      projects,
      plate1Indices,
      p1Result.allocation,
      p1Result.runLength,
      capacity
    );
    const plate2Res = buildPlateResult(
      projects,
      plate2Indices,
      p2Result.allocation,
      p2Result.runLength,
      capacity
    );

    const combinedProduced = plate1Res.totalProduced + plate2Res.totalProduced;
    const totalOrderQty = demands.reduce((s, q) => s + q, 0);
    const stickerArea =
      capacity.stickerWidth * capacity.stickerHeight;
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
      sheetsSaved: 0, // will be set later
      plate1ProjectIndices: plate1Indices,
      plate2ProjectIndices: plate2Indices,
    };
  }

  return bestResult;
}

// ── POST Handler ───────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<NextResponse<CalculateResponse>> {
  try {
    const body: CalculateRequest = await request.json();

    const {
      sheetWidth,
      sheetHeight,
      stickerWidth,
      stickerHeight,
      bleed,
      projects: rawProjects,
    } = body;

    // Validate inputs
    if (!sheetWidth || !sheetHeight || !stickerWidth || !stickerHeight || bleed == null) {
      return NextResponse.json(
        { capacity: {} as CapacityResult, singlePlateResult: null, twoPlateResult: null, error: "Missing required dimension parameters." },
        { status: 400 }
      );
    }

    // Filter out zero-quantity projects
    const projects = rawProjects.filter((p) => p.quantity > 0);
    if (projects.length === 0) {
      return NextResponse.json(
        { capacity: {} as CapacityResult, singlePlateResult: null, twoPlateResult: null, error: "No projects with positive quantities." },
        { status: 400 }
      );
    }

    // Calculate capacity
    const capacity = calculateCapacity(sheetWidth, sheetHeight, stickerWidth, stickerHeight, bleed);

    if (capacity.maxPerSheet === 0) {
      return NextResponse.json(
        { capacity, singlePlateResult: null, twoPlateResult: null, error: "Sticker size exceeds sheet capacity. Zero slots available." },
        { status: 200 }
      );
    }

    // Single plate optimization
    let singlePlateResult: PlateResult | null = null;
    if (projects.length <= capacity.maxPerSheet) {
      const demands = projects.map((p) => p.quantity);
      const result = findBestAllocation(demands, capacity.maxPerSheet);
      if (result) {
        singlePlateResult = buildPlateResult(
          projects,
          projects.map((_, i) => i),
          result.allocation,
          result.runLength,
          capacity
        );
      }
    }

    // Two plate optimization
    let twoPlateResult: TwoPlateResult | null = null;
    if (projects.length >= 2) {
      twoPlateResult = findBestTwoPlate(projects, capacity.maxPerSheet, capacity);
    }

    // Calculate sheets saved
    if (twoPlateResult && singlePlateResult) {
      twoPlateResult.sheetsSaved = singlePlateResult.totalSheets - twoPlateResult.totalSheets;
    }

    return NextResponse.json({
      capacity,
      singlePlateResult,
      twoPlateResult,
    });
  } catch (error) {
    console.error("Calculation error:", error);
    return NextResponse.json(
      { capacity: {} as CapacityResult, singlePlateResult: null, twoPlateResult: null, error: "Internal calculation error." },
      { status: 500 }
    );
  }
}
