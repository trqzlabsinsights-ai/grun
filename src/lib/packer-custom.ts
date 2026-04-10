// ── Custom Shape Packer — Self-Drawn Polygon Stickers ────────────────────────
// User provides polygon vertices (or picks a preset). Each sticker is a
// custom shape within a rectangular bounding box. Bounding boxes are packed
// on the sheet using MaxRect. SVG renders the actual polygon shape.
//
// Preset shapes: star, heart, diamond, hexagon, shield, arrow, cross, oval

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
  vertices: Point[];       // normalized 0-1
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

export const PRESET_SHAPES: Record<string, { label: string; vertices: Point[]; icon: string }> = {
  star: {
    label: "Star",
    icon: "★",
    vertices: [
      { x: 0.5, y: 0 }, { x: 0.618, y: 0.382 }, { x: 1, y: 0.382 },
      { x: 0.691, y: 0.618 }, { x: 0.809, y: 1 }, { x: 0.5, y: 0.764 },
      { x: 0.191, y: 1 }, { x: 0.309, y: 0.618 }, { x: 0, y: 0.382 },
      { x: 0.382, y: 0.382 },
    ],
  },
  heart: {
    label: "Heart",
    icon: "♥",
    vertices: [
      { x: 0.5, y: 0.9 }, { x: 0.1, y: 0.5 }, { x: 0, y: 0.3 },
      { x: 0.05, y: 0.1 }, { x: 0.2, y: 0 }, { x: 0.35, y: 0.05 },
      { x: 0.5, y: 0.25 }, { x: 0.65, y: 0.05 }, { x: 0.8, y: 0 },
      { x: 0.95, y: 0.1 }, { x: 1, y: 0.3 }, { x: 0.9, y: 0.5 },
    ],
  },
  diamond: {
    label: "Diamond",
    icon: "◆",
    vertices: [
      { x: 0.5, y: 0 }, { x: 1, y: 0.5 }, { x: 0.5, y: 1 }, { x: 0, y: 0.5 },
    ],
  },
  hexagon: {
    label: "Hexagon",
    icon: "⬡",
    vertices: [
      { x: 0.25, y: 0 }, { x: 0.75, y: 0 }, { x: 1, y: 0.5 },
      { x: 0.75, y: 1 }, { x: 0.25, y: 1 }, { x: 0, y: 0.5 },
    ],
  },
  shield: {
    label: "Shield",
    icon: "🛡",
    vertices: [
      { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 0.55 },
      { x: 0.5, y: 1 }, { x: 0, y: 0.55 },
    ],
  },
  arrow: {
    label: "Arrow",
    icon: "▶",
    vertices: [
      { x: 0, y: 0.3 }, { x: 0.6, y: 0.3 }, { x: 0.6, y: 0 },
      { x: 1, y: 0.5 }, { x: 0.6, y: 1 }, { x: 0.6, y: 0.7 },
      { x: 0, y: 0.7 },
    ],
  },
  cross: {
    label: "Cross",
    icon: "✚",
    vertices: [
      { x: 0.35, y: 0 }, { x: 0.65, y: 0 }, { x: 0.65, y: 0.35 },
      { x: 1, y: 0.35 }, { x: 1, y: 0.65 }, { x: 0.65, y: 0.65 },
      { x: 0.65, y: 1 }, { x: 0.35, y: 1 }, { x: 0.35, y: 0.65 },
      { x: 0, y: 0.65 }, { x: 0, y: 0.35 }, { x: 0.35, y: 0.35 },
    ],
  },
  oval: {
    label: "Oval",
    icon: "⬭",
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
  },
  triangle: {
    label: "Triangle",
    icon: "▲",
    vertices: [
      { x: 0.5, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 },
    ],
  },
  octagon: {
    label: "Octagon",
    icon: "⯃",
    vertices: [
      { x: 0.3, y: 0 }, { x: 0.7, y: 0 }, { x: 1, y: 0.3 },
      { x: 1, y: 0.7 }, { x: 0.7, y: 1 }, { x: 0.3, y: 1 },
      { x: 0, y: 0.7 }, { x: 0, y: 0.3 },
    ],
  },
};

// ── Custom Shape Packing ───────────────────────────────────────────────────
// Strategy: treat each custom shape as its bounding rectangle,
// pack bounding rects using MaxRect, then render actual polygon inside.

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
  const totalProduced = allocation.reduce((sum, outs) => sum + outs * runLength, 0);
  let totalOrderQty = 0;

  const allocationEntries: CustomAllocationEntry[] = indices.map((projIdx, i) => {
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
      shapeName: projects[projIdx].shapeName,
    };
  });

  const remappedGroups: PlacedCustomGroup[] = placedGroups.map((pg) => {
    const localIdx = parseInt(pg.name.replace("p", ""));
    const projIdx = indices[localIdx];
    return {
      name: projects[projIdx].name,
      projectIdx: projIdx,
      shape: pg.shape,
      outs: pg.outs,
      x: pg.x,
      y: pg.y,
      width: pg.width,
      height: pg.height,
      stickerWidth: projects[projIdx].stickerWidth,
      stickerHeight: projects[projIdx].stickerHeight,
      shapeName: projects[projIdx].shapeName,
      vertices: projects[projIdx].vertices,
      itemType: "custom" as const,
    };
  });

  // Material yield based on bounding box area (conservative)
  let usedArea = 0;
  for (const alloc of allocationEntries) {
    usedArea += alloc.produced * alloc.stickerWidth * alloc.stickerHeight;
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

  // Capacity and max slots based on smallest bounding box
  const minW = Math.min(...projects.map((p) => p.stickerWidth));
  const minH = Math.min(...projects.map((p) => p.stickerHeight));
  const cellW = minW + 2 * bleedIn;
  const cellH = minH + 2 * bleedIn;
  const maxPerSheet = Math.floor(sheetWidth / cellW) * Math.floor(sheetHeight / cellH);
  const maxSlots = Math.max(maxPerSheet, projects.length * 2);

  // Convert CustomProject to ProjectInput for the MaxRect packer
  const projectInputs: ProjectInput[] = projects.map((p) => ({
    name: p.name,
    quantity: p.quantity,
    stickerWidth: p.stickerWidth,
    stickerHeight: p.stickerHeight,
  }));

  // Single plate
  let singlePlateResult: CustomPlateResult | null = null;
  if (projects.length * 2 <= maxSlots) {
    const demands = projects.map((p) => p.quantity);
    const stickerSizes = projects.map((p) => ({ width: p.stickerWidth, height: p.stickerHeight }));
    const result = findBestAllocationWithPacking(
      demands, stickerSizes, sheetWidth, sheetHeight, bleedIn, maxSlots
    );
    if (result) {
      const plateRes = buildPlateResult(
        projectInputs,
        projects.map((_, i) => i),
        result.allocation,
        result.shapes,
        result.runLength,
        sheetWidth, sheetHeight, bleedIn,
        result.placedGroups
      );

      // Convert PlateResult to CustomPlateResult
      singlePlateResult = {
        allocation: plateRes.allocation.map((a, i) => ({
          ...a,
          shapeName: projects[i].shapeName,
        })),
        runLength: plateRes.runLength,
        totalSheets: plateRes.totalSheets,
        totalProduced: plateRes.totalProduced,
        totalOverage: plateRes.totalOverage,
        materialYield: plateRes.materialYield,
        placedGroups: plateRes.placedGroups.map((pg) => {
          const projIdx = pg.projectIdx;
          return {
            ...pg,
            shapeName: projects[projIdx].shapeName,
            vertices: projects[projIdx].vertices,
            itemType: "custom" as const,
          };
        }),
      };
    }
  }

  // Two plate
  let twoPlateResult: CustomTwoPlateResult | null = null;
  if (projects.length >= 2) {
    const twoPlate = findBestTwoPlate(projectInputs, maxSlots, sheetWidth, sheetHeight, bleedIn);
    if (twoPlate) {
      const convertPlate = (pr: PlateResult, indices: number[]) => {
        const customGroups: PlacedCustomGroup[] = pr.placedGroups.map((pg) => {
          const projIdx = pg.projectIdx;
          return {
            ...pg,
            name: projects[projIdx].name,
            projectIdx: projIdx,
            shapeName: projects[projIdx].shapeName,
            vertices: projects[projIdx].vertices,
            itemType: "custom" as const,
          };
        });
        return {
          allocation: pr.allocation.map((a) => {
            const projIdx = a.name ? projects.findIndex((p) => p.name === a.name) : -1;
            return { ...a, shapeName: projIdx >= 0 ? projects[projIdx].shapeName : "diamond" };
          }),
          runLength: pr.runLength,
          totalSheets: pr.totalSheets,
          totalProduced: pr.totalProduced,
          totalOverage: pr.totalOverage,
          materialYield: pr.materialYield,
          placedGroups: customGroups,
        } as CustomPlateResult;
      };

      twoPlateResult = {
        plate1: convertPlate(twoPlate.plate1, twoPlate.plate1ProjectIndices),
        plate2: convertPlate(twoPlate.plate2, twoPlate.plate2ProjectIndices),
        totalSheets: twoPlate.totalSheets,
        totalProduced: twoPlate.totalProduced,
        totalOverage: twoPlate.totalOverage,
        materialYield: twoPlate.materialYield,
        sheetsSaved: twoPlate.sheetsSaved,
        plate1ProjectIndices: twoPlate.plate1ProjectIndices,
        plate2ProjectIndices: twoPlate.plate2ProjectIndices,
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
