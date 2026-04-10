// ── Custom Shape Packer — Self-Drawn Polygon Stickers ────────────────────────
// Supports tessellation for interlocking shapes (triangle, diamond).
// Non-tessellating shapes use bounding-rect packing.
// Tessellating shapes pack 2 stickers per cell (up+down pair).

import {
  findBestAllocationWithPacking,
  buildPlateResult,
  findBestTwoPlate,
  type GroupShape,
  type ProjectInput,
  type PlacedGroup,
  type PlateResult,
  type TwoPlateResult,
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

export interface PlacedCustomGroup {
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
  shapeName: string;
  vertices: Point[];       // normalized 0-1 for "up" orientation
  flipVertices: Point[];   // normalized 0-1 for "down" orientation (tessellation pair)
  tessellated: boolean;    // true = 2 stickers per cell (up+down pair)
  itemType: "custom";
}

export interface CustomAllocationEntry {
  name: string;
  quantity: number;
  outs: number;
  produced: number;
  overage: number;
  overagePct: number;
  groupShape: GroupShape;
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
// tessellated: true means 2 stickers fit per bounding box cell (up+down pair)

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
    tessellated: true, // 2 diamonds per cell: ◆ top half + ◆ bottom half
    vertices: [
      { x: 0.5, y: 0 }, { x: 1, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0, y: 0.5 },
    ],
    flipVertices: [
      { x: 0.5, y: 0.5 }, { x: 1, y: 0.5 }, { x: 0.5, y: 1 }, { x: 0, y: 0.5 },
    ],
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
    tessellated: true, // 2 triangles per cell: ▲ top + ▼ bottom
    vertices: [
      // ▲ pointing up — top half of bounding box
      { x: 0.5, y: 0 }, { x: 1, y: 0.5 }, { x: 0, y: 0.5 },
    ],
    flipVertices: [
      // ▼ pointing down — bottom half of bounding box
      { x: 0, y: 0.5 }, { x: 1, y: 0.5 }, { x: 0.5, y: 1 },
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

/** Check if a shape name supports tessellation */
export function isTessellated(shapeName: string): boolean {
  return PRESET_SHAPES[shapeName]?.tessellated ?? false;
}

/** Get the effective outs per cell for a shape (2 for tessellated, 1 otherwise) */
export function outsPerCell(shapeName: string): number {
  return isTessellated(shapeName) ? 2 : 1;
}

// ── Custom Shape Packing ───────────────────────────────────────────────────
// Strategy:
// - Tessellated shapes (triangle, diamond): 2 stickers per bounding box cell
//   The "outs" in the allocation = number of cells × 2
// - Non-tessellated shapes: 1 sticker per cell (standard)

function buildCustomPlateResult(
  projects: CustomProject[],
  indices: number[],
  allocation: number[],
  shapes: GroupShape[],
  runLength: number,
  sheetW: number,
  sheetH: number,
  bleedIn: number,
  placedGroups: PlacedGroup[]
): CustomPlateResult {
  const totalProduced = allocation.reduce((sum, outs, i) => {
    const tessellated = isTessellated(projects[indices[i]].shapeName);
    const effectiveOuts = tessellated ? outs * 2 : outs;
    return sum + effectiveOuts * runLength;
  }, 0);
  let totalOrderQty = 0;

  const allocationEntries: CustomAllocationEntry[] = indices.map((projIdx, i) => {
    const qty = projects[projIdx].quantity;
    const tessellated = isTessellated(projects[projIdx].shapeName);
    const effectiveOuts = tessellated ? allocation[i] * 2 : allocation[i];
    const produced = effectiveOuts * runLength;
    const overage = produced - qty;
    const overagePct = qty > 0 ? (overage / qty) * 100 : 0;
    totalOrderQty += qty;
    return {
      name: projects[projIdx].name,
      quantity: qty,
      outs: effectiveOuts,
      produced,
      overage,
      overagePct,
      groupShape: shapes[i],
      stickerWidth: projects[projIdx].stickerWidth,
      stickerHeight: projects[projIdx].stickerHeight,
      shapeName: projects[projIdx].shapeName,
      tessellated,
    };
  });

  const remappedGroups: PlacedCustomGroup[] = placedGroups.map((pg) => {
    const projIdx = pg.projectIdx;
    const proj = projects[projIdx];
    const preset = PRESET_SHAPES[proj.shapeName] || PRESET_SHAPES.diamond;
    const tessellated = isTessellated(proj.shapeName);
    const effectiveOuts = tessellated ? pg.outs * 2 : pg.outs;

    return {
      name: proj.name,
      projectIdx: projIdx,
      shape: pg.shape,
      outs: effectiveOuts,
      x: pg.x,
      y: pg.y,
      width: pg.width,
      height: pg.height,
      stickerWidth: proj.stickerWidth,
      stickerHeight: proj.stickerHeight,
      shapeName: proj.shapeName,
      vertices: tessellated ? preset.vertices : proj.vertices,
      flipVertices: tessellated ? preset.flipVertices : [],
      tessellated,
      itemType: "custom" as const,
    };
  });

  // Material yield: use actual shape area for tessellated, bounding box for others
  let usedArea = 0;
  for (const alloc of allocationEntries) {
    if (alloc.tessellated) {
      // Tessellated shapes fill the full bounding box (2 shapes = 1 cell of W×H)
      usedArea += alloc.produced * (alloc.stickerWidth * alloc.stickerHeight / 2);
    } else {
      usedArea += alloc.produced * alloc.stickerWidth * alloc.stickerHeight;
    }
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
  const cellW = minW + 2 * bleedIn;
  const cellH = minH + 2 * bleedIn;
  const maxPerSheet = Math.floor(sheetWidth / cellW) * Math.floor(sheetHeight / cellH);
  const maxSlots = Math.max(maxPerSheet, projects.length * 2);

  // For tessellated shapes, the demand is halved because each cell produces 2 stickers
  // Convert CustomProject to ProjectInput with adjusted demands
  const projectInputs: ProjectInput[] = projects.map((p) => {
    const tessellated = isTessellated(p.shapeName);
    return {
      name: p.name,
      quantity: tessellated ? Math.ceil(p.quantity / 2) : p.quantity,
      stickerWidth: p.stickerWidth,
      stickerHeight: p.stickerHeight,
    };
  });

  // Single plate
  let singlePlateResult: CustomPlateResult | null = null;
  if (projects.length * 2 <= maxSlots) {
    const demands = projectInputs.map((p) => p.quantity);
    const stickerSizes = projectInputs.map((p) => ({ width: p.stickerWidth, height: p.stickerHeight }));
    const result = findBestAllocationWithPacking(
      demands, stickerSizes, sheetWidth, sheetHeight, bleedIn, maxSlots
    );
    if (result) {
      singlePlateResult = buildCustomPlateResult(
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
  let twoPlateResult: CustomTwoPlateResult | null = null;
  if (projects.length >= 2) {
    const twoPlate = findBestTwoPlate(projectInputs, maxSlots, sheetWidth, sheetHeight, bleedIn);
    if (twoPlate) {
      const p1Indices = twoPlate.plate1ProjectIndices;
      const p2Indices = twoPlate.plate2ProjectIndices;

      const plate1 = buildCustomPlateResult(
        projects, p1Indices,
        twoPlate.plate1.allocation.map((a) => a.outs),
        twoPlate.plate1.allocation.map((a) => a.groupShape),
        twoPlate.plate1.runLength,
        sheetWidth, sheetHeight, bleedIn,
        twoPlate.plate1.placedGroups
      );
      const plate2 = buildCustomPlateResult(
        projects, p2Indices,
        twoPlate.plate2.allocation.map((a) => a.outs),
        twoPlate.plate2.allocation.map((a) => a.groupShape),
        twoPlate.plate2.runLength,
        sheetWidth, sheetHeight, bleedIn,
        twoPlate.plate2.placedGroups
      );

      const combinedProduced = plate1.totalProduced + plate2.totalProduced;
      const totalOrderQty = projects.reduce((s, p) => s + p.quantity, 0);

      let totalUsedArea = 0;
      for (const alloc of [...plate1.allocation, ...plate2.allocation]) {
        if (alloc.tessellated) {
          totalUsedArea += alloc.produced * (alloc.stickerWidth * alloc.stickerHeight / 2);
        } else {
          totalUsedArea += alloc.produced * alloc.stickerWidth * alloc.stickerHeight;
        }
      }
      const totalSheets = twoPlate.totalSheets;
      const totalSheetArea = totalSheets * sheetWidth * sheetHeight;
      const materialYield = totalSheetArea > 0 ? (totalUsedArea / totalSheetArea) * 100 : 0;

      twoPlateResult = {
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
