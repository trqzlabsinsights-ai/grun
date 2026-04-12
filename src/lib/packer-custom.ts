// ── Custom Shape Packer — Regular Polygon Stickers ──────────────────────────
//
// Architecture: Each project gets its own independent sheet allocation.
// All projects share the same polygon type (global `sides` parameter).
// No mixing of different polygon types on one sheet — each sheet is
// dedicated to one project's polygon size, maximizing space utilization.
//
// Packing strategies per polygon type:
//   3 sides (triangle)  → "alternate-col" ▲▼ alternating columns (density ~1.0)
//   4 sides (diamond)   → "honeycomb" offset rows (density ~0.707)
//   5 sides (pentagon)  → "double-lattice" 180° rotation + offset (density ~0.89)
//   6 sides (hexagon)   → "honeycomb" perfect tessellation (density ~0.866)
//   7+ sides            → "double-lattice" 180° rotation + offset
//
// Space optimization: Every sheet in a run is consumed material. Unused space
// = waste. The packer maximizes items per sheet using tight tessellation with
// rotational interlocking for non-tessellating polygons.

import type { GroupShape } from "./types";

// ── Types ──────────────────────────────────────────────────────────────────

export interface Point {
  x: number;
  y: number;
}

/** Tessellation style determines how shapes interlock */
export type TessStyle = "alternate-col" | "honeycomb" | "double-lattice";

export interface CustomProject {
  name: string;
  quantity: number;
  stickerWidth: number;   // bounding box width (inches)
  stickerHeight: number;  // bounding box height (inches)
}

/** Individual tessellation position for a shape within a group */
export interface TessPosition {
  x: number;      // top-left x of this shape's bounding box
  y: number;      // top-left y of this shape's bounding box
  flip: boolean;  // true = use flipVertices (180° rotated)
}

export interface PlacedCustomGroup {
  name: string;
  projectIdx: number;
  outs: number;
  sheets: number;         // number of sheets dedicated to this project
  x: number;
  y: number;
  width: number;
  height: number;
  stickerWidth: number;
  stickerHeight: number;
  sides: number;
  vertices: Point[];       // normalized 0-1 for "up" orientation
  flipVertices: Point[];   // normalized 0-1 for 180° rotated orientation
  tessellated: boolean;
  itemType: "custom";
  /** For tessellated shapes: absolute positions of each individual shape */
  tessPositions?: TessPosition[];
  /** Group shape (w = columns, h = rows) */
  shape: GroupShape;
}

export interface CustomAllocationEntry {
  name: string;
  quantity: number;
  outs: number;
  sheets: number;         // sheets dedicated to this project
  produced: number;
  overage: number;
  overagePct: number;
  groupShape: GroupShape;
  stickerWidth: number;
  stickerHeight: number;
  sides: number;
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

export interface PlateSuggestion {
  plateCount: number;
  feasible: boolean;
  totalSheets: number;
  description: string;
}

export interface CustomCalculateResponse {
  capacity: { maxPerSheet: number; sheetWidth: number; sheetHeight: number };
  singlePlateResult: CustomPlateResult | null;
  twoPlateResult: CustomTwoPlateResult | null;
  plateSuggestions: PlateSuggestion[];
  error?: string;
}

// ── Regular Polygon Generation ──────────────────────────────────────────────

/** Generate vertices for a regular polygon with n sides, normalized (0,0)-(1,1) */
export function generateRegularPolygon(sides: number): Point[] {
  if (sides < 3) sides = 3;
  const vertices: Point[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = (2 * Math.PI * i) / sides - Math.PI / 2;
    vertices.push({
      x: 0.5 + 0.5 * Math.cos(angle),
      y: 0.5 + 0.5 * Math.sin(angle),
    });
  }
  return vertices;
}

/** Generate 180° rotated vertices for double-lattice packing */
export function generateFlipPolygon(sides: number): Point[] {
  if (sides < 3) sides = 3;
  const vertices: Point[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = (2 * Math.PI * i) / sides - Math.PI / 2;
    vertices.push({
      x: 0.5 - 0.5 * Math.cos(angle),
      y: 0.5 - 0.5 * Math.sin(angle),
    });
  }
  return vertices;
}

/** Triangle ▲ up — fills FULL bounding box for tight tessellation */
function triangleUp(): Point[] {
  return [{ x: 0.5, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
}

/** Triangle ▼ down — fills FULL bounding box for tight tessellation */
function triangleDown(): Point[] {
  return [{ x: 0.5, y: 1 }, { x: 1, y: 0 }, { x: 0, y: 0 }];
}

/** Get polygon icon character */
export function getPolygonIcon(sides: number): string {
  switch (sides) {
    case 3: return "▲";
    case 4: return "◆";
    case 5: return "⬠";
    case 6: return "⬡";
    case 8: return "⯃";
    default: return `${sides}`;
  }
}

/** Get polygon display name */
export function getPolygonName(sides: number): string {
  const names: Record<number, string> = {
    3: "Triangle", 4: "Diamond", 5: "Pentagon", 6: "Hexagon",
    7: "Heptagon", 8: "Octagon", 9: "Nonagon", 10: "Decagon", 12: "Dodecagon",
  };
  return names[sides] || `${sides}-gon`;
}

// ── Polygon Geometry for Optimized Packing ────────────────────────────────
//
// For non-tessellating polygons (pentagon, heptagon, octagon+), the actual
// polygon is SMALLER than its bounding box. Using the actual footprint for
// cell spacing allows tighter packing, especially with 180° rotation that
// lets vertices nest into bounding-box gaps.

/**
 * Compute the actual (tight) dimensions of a regular polygon inscribed in
 * a bounding box of bbW × bbH.
 */
function actualPolygonDims(
  sides: number, bbW: number, bbH: number
): { width: number; height: number } {
  if (sides === 3) {
    // Triangle: vertices touch bounding box edges, use full box
    return { width: bbW, height: bbH };
  }
  if (sides === 4) {
    // Diamond: vertices at midpoints of bounding box edges
    return { width: bbW, height: bbH };
  }
  if (sides === 6) {
    // Hexagon: perfect tessellation, use full bounding box
    return { width: bbW, height: bbH };
  }

  // For n ≥ 5 (odd) or n ≥ 8 (even, non-tessellating):
  let R: number;
  if (sides % 2 === 1) {
    // Odd-sided: vertex at top, vertex-like at bottom
    const R_fromH = bbH / (1 + Math.cos(Math.PI / sides));
    const R_fromW = bbW / (2 * Math.sin(2 * Math.PI / sides));
    R = Math.min(R_fromH, R_fromW);
    const actualW = 2 * R * Math.sin(2 * Math.PI / sides);
    const actualH = R * (1 + Math.cos(Math.PI / sides));
    return { width: actualW, height: actualH };
  } else {
    // Even-sided (8, 10, 12...)
    const R_fromH = bbH / (2 * Math.cos(Math.PI / sides));
    const R_fromW = bbW / 2;
    R = Math.min(R_fromH, R_fromW);
    const actualW = Math.min(2 * R, bbW);
    const actualH = 2 * R * Math.cos(Math.PI / sides);
    return { width: actualW, height: actualH };
  }
}

/**
 * Compute the effective cell dimensions for packing.
 * - For tessellating shapes (3,4,6): use bounding box + bleed
 * - For all others: use actual polygon footprint + bleed
 */
function effectiveCellDims(
  sides: number, bbW: number, bbH: number, bleedIn: number
): { cellW: number; cellH: number } {
  if (sides === 3 || sides === 4 || sides === 6) {
    return { cellW: bbW + 2 * bleedIn, cellH: bbH + 2 * bleedIn };
  }
  const actual = actualPolygonDims(sides, bbW, bbH);
  return {
    cellW: actual.width + 2 * bleedIn,
    cellH: actual.height + 2 * bleedIn,
  };
}

// ── Tessellation Parameters Per Polygon Type ──────────────────────────────
//
// Each polygon type has optimized parameters for maximum packing density.
// The row height factor determines how much rows can overlap (lower = tighter).
// The horizontal offset factor determines how much odd rows are shifted.

/** Get tessellation style for a polygon type */
export function getTessStyle(sides: number): TessStyle {
  if (sides === 3) return "alternate-col";
  if (sides === 4 || sides === 6) return "honeycomb";
  return "double-lattice"; // 5, 7, 8, 9+
}

/** Row height factor — how much of cellH is used as row spacing */
function getRowHeightFactor(sides: number): number {
  switch (sides) {
    case 3: return 1.0;                        // triangles: full height
    case 4: return Math.SQRT2 / 2;             // ≈0.707 diamond honeycomb
    case 5: return 0.89;                       // pentagon double-lattice
    case 6: return Math.sqrt(3) / 2;           // ≈0.866 hexagon honeycomb
    case 7: return 0.88;                       // heptagon double-lattice
    case 8: return 0.91;                       // octagon double-lattice
    case 9: return 0.92;                       // nonagon
    case 10: return 0.92;                      // decagon
    default: return 0.93;                      // 11+ approaching circle
  }
}

/** Horizontal offset factor for odd rows (fraction of cellW) */
function getHOffsetFactor(sides: number): number {
  switch (sides) {
    case 3: return 0;    // uses alternate-col
    case 4: return 0.5;  // diamond honeycomb
    case 5: return 0.30; // pentagon: moderate offset for vertex nesting
    case 6: return 0.5;  // hexagon honeycomb
    case 7: return 0.35; // heptagon
    case 8: return 0.42; // octagon
    case 9: return 0.45; // nonagon
    case 10: return 0.47; // decagon
    default: return 0.48; // 11+ approaching circle
  }
}

/** Whether to flip (180° rotate) odd rows */
function getFlipOddRows(sides: number): boolean {
  if (sides === 3) return true;   // alternate ▲▼
  if (sides === 6) return false;  // hexagon is symmetric
  return true;                     // 4, 5, 7, 8+ all use flip
}

/** Check if a polygon uses optimized packing (all do) */
export function isTessellated(_sides: number): boolean {
  return true;
}

/** Get vertices for a polygon */
function getPolygonVertices(sides: number): Point[] {
  if (sides === 3) return triangleUp();
  return generateRegularPolygon(sides);
}

/** Get flip vertices (180° rotated) for a polygon */
function getPolygonFlipVertices(sides: number): Point[] {
  if (sides === 3) return triangleDown();
  return generateFlipPolygon(sides);
}

// ── PRESET_SHAPES (legacy compat) ─────────────────────────────────────────

export const PRESET_SHAPES: Record<string, {
  label: string; vertices: Point[]; flipVertices: Point[];
  icon: string; tessellated: boolean; tessStyle: TessStyle;
}> = {
  triangle: { label: "Triangle", icon: "▲", tessellated: true, tessStyle: "alternate-col", vertices: triangleUp(), flipVertices: triangleDown() },
  diamond: { label: "Diamond", icon: "◆", tessellated: true, tessStyle: "honeycomb", vertices: generateRegularPolygon(4), flipVertices: generateFlipPolygon(4) },
  pentagon: { label: "Pentagon", icon: "⬠", tessellated: true, tessStyle: "double-lattice", vertices: generateRegularPolygon(5), flipVertices: generateFlipPolygon(5) },
  hexagon: { label: "Hexagon", icon: "⬡", tessellated: true, tessStyle: "honeycomb", vertices: generateRegularPolygon(6), flipVertices: generateFlipPolygon(6) },
  heptagon: { label: "Heptagon", icon: "7", tessellated: true, tessStyle: "double-lattice", vertices: generateRegularPolygon(7), flipVertices: generateFlipPolygon(7) },
  octagon: { label: "Octagon", icon: "⯃", tessellated: true, tessStyle: "double-lattice", vertices: generateRegularPolygon(8), flipVertices: generateFlipPolygon(8) },
};

// ── Capacity Calculation ────────────────────────────────────────────────────

/**
 * Count shapes that fit on a sheet using optimized tessellation.
 * This is the core function for maximizing items per sheet.
 */
export function tessCapacity(
  sheetW: number,
  sheetH: number,
  shapeW: number,
  shapeH: number,
  bleedIn: number,
  sides: number
): number {
  const style = getTessStyle(sides);
  const { cellW, cellH } = effectiveCellDims(sides, shapeW, shapeH, bleedIn);

  if (style === "alternate-col") {
    // Triangle: each shape occupies half-width in alternating columns
    const step = cellW / 2 + bleedIn;
    let count = 0;
    let y = bleedIn;
    while (y + shapeH <= sheetH - bleedIn + 0.001) {
      let x = bleedIn;
      while (x + shapeW <= sheetW - bleedIn + 0.001) {
        count++;
        x += step;
      }
      y += cellH;
    }
    return count;
  }

  // Honeycomb / double-lattice: row-based with offset
  const rowHFactor = getRowHeightFactor(sides);
  const rowH = cellH * rowHFactor;
  const hOff = cellW * getHOffsetFactor(sides);

  // For non-tessellating polygons, use actual footprint for boundary checks
  const actual = actualPolygonDims(sides, shapeW, shapeH);
  const checkW = (sides === 3 || sides === 4 || sides === 6) ? shapeW : actual.width;
  const checkH = (sides === 3 || sides === 4 || sides === 6) ? shapeH : actual.height;

  let count = 0;
  let row = 0;
  let y = bleedIn;
  while (y + checkH <= sheetH - bleedIn + 0.001) {
    const offset = row % 2 === 1 ? hOff : 0;
    let x = bleedIn + offset;
    while (x + checkW <= sheetW - bleedIn + 0.001) {
      count++;
      x += cellW;
    }
    y += rowH;
    row++;
  }
  return count;
}

/**
 * Generate all tessellation positions for a full sheet.
 * Returns the absolute positions of each polygon on the sheet.
 */
export function tessSheetPositions(
  sheetW: number,
  sheetH: number,
  shapeW: number,
  shapeH: number,
  bleedIn: number,
  sides: number
): TessPosition[] {
  const style = getTessStyle(sides);
  const { cellW, cellH } = effectiveCellDims(sides, shapeW, shapeH, bleedIn);
  const positions: TessPosition[] = [];
  const flipOdd = getFlipOddRows(sides);

  if (style === "alternate-col") {
    const step = cellW / 2 + bleedIn;
    let row = 0;
    let y = bleedIn;
    while (y + shapeH <= sheetH - bleedIn + 0.001) {
      let col = 0;
      let x = bleedIn;
      while (x + shapeW <= sheetW - bleedIn + 0.001) {
        positions.push({
          x,
          y,
          flip: col % 2 === 1, // alternate ▲▼
        });
        x += step;
        col++;
      }
      y += cellH;
      row++;
    }
    return positions;
  }

  // Honeycomb / double-lattice
  const rowHFactor = getRowHeightFactor(sides);
  const rowH = cellH * rowHFactor;
  const hOff = cellW * getHOffsetFactor(sides);

  const actual = actualPolygonDims(sides, shapeW, shapeH);
  const checkW = (sides === 3 || sides === 4 || sides === 6) ? shapeW : actual.width;
  const checkH = (sides === 3 || sides === 4 || sides === 6) ? shapeH : actual.height;

  let row = 0;
  let y = bleedIn;
  while (y + checkH <= sheetH - bleedIn + 0.001) {
    const isOddRow = row % 2 === 1;
    const offset = isOddRow ? hOff : 0;
    let x = bleedIn + offset;
    while (x + checkW <= sheetW - bleedIn + 0.001) {
      positions.push({
        x,
        y,
        flip: flipOdd && isOddRow, // odd rows use 180° rotated polygon
      });
      x += cellW;
    }
    y += rowH;
    row++;
  }
  return positions;
}

/**
 * Get the grid dimensions (cols × rows) for the tessellation layout.
 * Used for display in the allocation table.
 */
function tessGridDimensions(
  sheetW: number,
  sheetH: number,
  shapeW: number,
  shapeH: number,
  bleedIn: number,
  sides: number
): GroupShape {
  const style = getTessStyle(sides);
  const { cellW, cellH } = effectiveCellDims(sides, shapeW, shapeH, bleedIn);

  if (style === "alternate-col") {
    const step = cellW / 2 + bleedIn;
    let maxCols = 0;
    let rows = 0;
    let y = bleedIn;
    while (y + shapeH <= sheetH - bleedIn + 0.001) {
      let cols = 0;
      let x = bleedIn;
      while (x + shapeW <= sheetW - bleedIn + 0.001) {
        cols++;
        x += step;
      }
      maxCols = Math.max(maxCols, cols);
      y += cellH;
      rows++;
    }
    return { w: maxCols, h: rows };
  }

  const rowH = cellH * getRowHeightFactor(sides);
  const hOff = cellW * getHOffsetFactor(sides);

  const actual = actualPolygonDims(sides, shapeW, shapeH);
  const checkW = (sides === 3 || sides === 4 || sides === 6) ? shapeW : actual.width;
  const checkH = (sides === 3 || sides === 4 || sides === 6) ? shapeH : actual.height;

  let maxCols = 0;
  let rows = 0;
  let row = 0;
  let y = bleedIn;
  while (y + checkH <= sheetH - bleedIn + 0.001) {
    const offset = row % 2 === 1 ? hOff : 0;
    let cols = 0;
    let x = bleedIn + offset;
    while (x + checkW <= sheetW - bleedIn + 0.001) {
      cols++;
      x += cellW;
    }
    maxCols = Math.max(maxCols, cols);
    y += rowH;
    row++;
    rows++;
  }
  return { w: maxCols, h: rows };
}

// ── Polygon Area for Material Yield ────────────────────────────────────────

/** Compute the area of a regular polygon inscribed in a bounding box */
function polygonArea(sides: number, bbW: number, bbH: number): number {
  if (sides === 3) {
    // Triangle area = 0.5 * base * height
    return 0.5 * bbW * bbH;
  }
  if (sides === 4) {
    // Diamond area = 0.5 * diagonal1 * diagonal2
    return 0.5 * bbW * bbH;
  }

  // General: area = (n/2) * R² * sin(2π/n)
  let R: number;
  if (sides % 2 === 1) {
    const R_fromH = bbH / (1 + Math.cos(Math.PI / sides));
    const R_fromW = bbW / (2 * Math.sin(2 * Math.PI / sides));
    R = Math.min(R_fromH, R_fromW);
  } else {
    const R_fromH = bbH / (2 * Math.cos(Math.PI / sides));
    const R_fromW = bbW / 2;
    R = Math.min(R_fromH, R_fromW);
  }
  return (sides / 2) * R * R * Math.sin((2 * Math.PI) / sides);
}

// ── Main Calculation ───────────────────────────────────────────────────────

export function calculateCustom(req: {
  sheetWidth: number;
  sheetHeight: number;
  bleed: number;
  sides: number;  // global polygon type
  projects: CustomProject[];
}): CustomCalculateResponse {
  const { sheetWidth, sheetHeight, bleed, sides: rawSides, projects: rawProjects } = req;
  const emptySuggestions: PlateSuggestion[] = [];

  if (!sheetWidth || !sheetHeight || bleed == null) {
    return {
      capacity: { maxPerSheet: 0, sheetWidth, sheetHeight },
      singlePlateResult: null, twoPlateResult: null, plateSuggestions: emptySuggestions,
      error: "Missing required dimension parameters.",
    };
  }

  const sides = Math.max(3, rawSides || 4);
  const projects = rawProjects.filter((p) => p.quantity > 0 && p.stickerWidth > 0 && p.stickerHeight > 0);

  if (projects.length === 0) {
    return {
      capacity: { maxPerSheet: 0, sheetWidth, sheetHeight },
      singlePlateResult: null, twoPlateResult: null, plateSuggestions: emptySuggestions,
      error: "No projects with positive quantities and valid sticker sizes.",
    };
  }

  const bleedIn = bleed / 25.4;

  // Check which projects can fit on the sheet
  const tooLargeProjects: string[] = [];
  for (const p of projects) {
    const cap = tessCapacity(sheetWidth, sheetHeight, p.stickerWidth, p.stickerHeight, bleedIn, sides);
    if (cap < 1) {
      tooLargeProjects.push(`"${p.name}" (${getPolygonName(sides)} ${p.stickerWidth}"×${p.stickerHeight}")`);
    }
  }
  if (tooLargeProjects.length > 0) {
    const suggestions: PlateSuggestion[] = [1, 2, 3, 4].map(k => ({ plateCount: k, feasible: false, totalSheets: 0, description: "Cannot fit" }));
    return {
      capacity: { maxPerSheet: 0, sheetWidth, sheetHeight },
      singlePlateResult: null, twoPlateResult: null, plateSuggestions: suggestions,
      error: `Projects too large for sheet: ${tooLargeProjects.join(", ")}. Try increasing sheet size or reducing sticker dimensions.`,
    };
  }

  // ── Per-project allocation ─────────────────────────────────────────────
  // Each project gets its own independent sheet allocation.
  // Every sheet printed is consumed, so we maximize items per sheet.

  const allocationEntries: CustomAllocationEntry[] = [];
  const placedGroups: PlacedCustomGroup[] = [];
  let totalOrderQty = 0;
  let totalProduced = 0;
  let totalSheets = 0;

  for (let i = 0; i < projects.length; i++) {
    const p = projects[i];
    const capacity = tessCapacity(sheetWidth, sheetHeight, p.stickerWidth, p.stickerHeight, bleedIn, sides);
    const outs = capacity; // all outs on every sheet (full capacity)
    const sheets = Math.ceil(p.quantity / outs);
    const produced = outs * sheets;
    const overage = produced - p.quantity;
    const overagePct = p.quantity > 0 ? (overage / p.quantity) * 100 : 0;
    const gridShape = tessGridDimensions(sheetWidth, sheetHeight, p.stickerWidth, p.stickerHeight, bleedIn, sides);

    totalOrderQty += p.quantity;
    totalProduced += produced;
    totalSheets += sheets;

    allocationEntries.push({
      name: p.name,
      quantity: p.quantity,
      outs,
      sheets,
      produced,
      overage,
      overagePct,
      groupShape: gridShape,
      stickerWidth: p.stickerWidth,
      stickerHeight: p.stickerHeight,
      sides,
      tessellated: true,
    });

    // Generate tessellation positions for the full sheet
    const tessPositions = tessSheetPositions(sheetWidth, sheetHeight, p.stickerWidth, p.stickerHeight, bleedIn, sides);

    placedGroups.push({
      name: p.name,
      projectIdx: i,
      outs,
      sheets,
      x: 0,
      y: 0,
      width: sheetWidth,
      height: sheetHeight,
      stickerWidth: p.stickerWidth,
      stickerHeight: p.stickerHeight,
      sides,
      vertices: getPolygonVertices(sides),
      flipVertices: getPolygonFlipVertices(sides),
      tessellated: true,
      itemType: "custom",
      shape: gridShape,
      tessPositions,
    });
  }

  // ── Material yield ─────────────────────────────────────────────────────
  // Use actual polygon area (not bounding box) for yield calculation
  let totalUsedArea = 0;
  for (const entry of allocationEntries) {
    const area = polygonArea(sides, entry.stickerWidth, entry.stickerHeight);
    totalUsedArea += area * entry.produced;
  }
  const totalSheetArea = totalSheets * sheetWidth * sheetHeight;
  const materialYield = totalSheetArea > 0 ? (totalUsedArea / totalSheetArea) * 100 : 0;

  // ── Build results ──────────────────────────────────────────────────────
  const singlePlateResult: CustomPlateResult = {
    allocation: allocationEntries,
    runLength: totalSheets,
    totalSheets,
    totalProduced,
    totalOverage: totalProduced - totalOrderQty,
    materialYield,
    placedGroups,
  };

  // Capacity info
  const maxPerSheet = Math.max(...allocationEntries.map((e) => e.outs));

  // Plate suggestions
  const plateSuggestions: PlateSuggestion[] = [];

  // Single plate
  plateSuggestions.push({
    plateCount: 1,
    feasible: true,
    totalSheets,
    description: `${totalSheets.toLocaleString()} sheets across ${projects.length} project${projects.length > 1 ? "s" : ""}`,
  });

  // Two-plate: split projects between two plates
  if (projects.length >= 2) {
    // Simple split: try putting half the projects on each plate
    // This only saves sheets if different projects have different densities
    const mid = Math.floor(projects.length / 2);
    const p1Projects = projects.slice(0, mid);
    const p2Projects = projects.slice(mid);

    let p1Sheets = 0;
    for (const p of p1Projects) {
      const cap = tessCapacity(sheetWidth, sheetHeight, p.stickerWidth, p.stickerHeight, bleedIn, sides);
      p1Sheets += Math.ceil(p.quantity / cap);
    }
    let p2Sheets = 0;
    for (const p of p2Projects) {
      const cap = tessCapacity(sheetWidth, sheetHeight, p.stickerWidth, p.stickerHeight, bleedIn, sides);
      p2Sheets += Math.ceil(p.quantity / cap);
    }

    // Two plates don't save sheets in per-project model (same total)
    // But having separate plates means each plate can run independently
    plateSuggestions.push({
      plateCount: 2,
      feasible: true,
      totalSheets: p1Sheets + p2Sheets,
      description: `${(p1Sheets + p2Sheets).toLocaleString()} sheets (P1: ${p1Sheets} | P2: ${p2Sheets})`,
    });
  } else {
    plateSuggestions.push({
      plateCount: 2,
      feasible: false,
      totalSheets: 0,
      description: "Need at least 2 projects",
    });
  }

  // 3+ plates
  for (let k = 3; k <= 4; k++) {
    plateSuggestions.push({
      plateCount: k,
      feasible: true,
      totalSheets,
      description: "Same total sheets, separate plate setups",
    });
  }

  // Two-plate result: for the per-project model, we can split projects
  // between two plates where each plate only contains certain projects
  let twoPlateResult: CustomTwoPlateResult | null = null;
  if (projects.length >= 2) {
    const mid = Math.floor(projects.length / 2);
    const p1Indices = Array.from({ length: mid }, (_, i) => i);
    const p2Indices = Array.from({ length: projects.length - mid }, (_, i) => i + mid);

    const p1Projects = p1Indices.map((i) => projects[i]);
    const p2Projects = p2Indices.map((i) => projects[i]);

    const buildPlateFromProjects = (projs: CustomProject[], indices: number[]): CustomPlateResult => {
      const allocs: CustomAllocationEntry[] = [];
      const groups: PlacedCustomGroup[] = [];
      let pTotalQty = 0;
      let pTotalProduced = 0;
      let pTotalSheets = 0;

      for (let j = 0; j < projs.length; j++) {
        const p = projs[j];
        const origIdx = indices[j];
        const cap = tessCapacity(sheetWidth, sheetHeight, p.stickerWidth, p.stickerHeight, bleedIn, sides);
        const outs = cap;
        const sheets = Math.ceil(p.quantity / outs);
        const produced = outs * sheets;
        const overage = produced - p.quantity;
        const overagePct = p.quantity > 0 ? (overage / p.quantity) * 100 : 0;
        const gridShape = tessGridDimensions(sheetWidth, sheetHeight, p.stickerWidth, p.stickerHeight, bleedIn, sides);

        pTotalQty += p.quantity;
        pTotalProduced += produced;
        pTotalSheets += sheets;

        allocs.push({
          name: p.name, quantity: p.quantity, outs, sheets, produced, overage, overagePct,
          groupShape: gridShape, stickerWidth: p.stickerWidth, stickerHeight: p.stickerHeight,
          sides, tessellated: true,
        });

        const tessPositions = tessSheetPositions(sheetWidth, sheetHeight, p.stickerWidth, p.stickerHeight, bleedIn, sides);
        groups.push({
          name: p.name, projectIdx: origIdx, outs, sheets,
          x: 0, y: 0, width: sheetWidth, height: sheetHeight,
          stickerWidth: p.stickerWidth, stickerHeight: p.stickerHeight,
          sides, vertices: getPolygonVertices(sides), flipVertices: getPolygonFlipVertices(sides),
          tessellated: true, itemType: "custom", shape: gridShape, tessPositions,
        });
      }

      let usedArea = 0;
      for (const a of allocs) {
        usedArea += polygonArea(sides, a.stickerWidth, a.stickerHeight) * a.produced;
      }
      const sheetArea = pTotalSheets * sheetWidth * sheetHeight;
      const yield_ = sheetArea > 0 ? (usedArea / sheetArea) * 100 : 0;

      return {
        allocation: allocs, runLength: pTotalSheets, totalSheets: pTotalSheets,
        totalProduced: pTotalProduced, totalOverage: pTotalProduced - pTotalQty,
        materialYield: yield_, placedGroups: groups,
      };
    };

    const plate1 = buildPlateFromProjects(p1Projects, p1Indices);
    const plate2 = buildPlateFromProjects(p2Projects, p2Indices);

    const combinedProduced = plate1.totalProduced + plate2.totalProduced;
    const combinedOrderQty = plate1.allocation.reduce((s, a) => s + a.quantity, 0) +
      plate2.allocation.reduce((s, a) => s + a.quantity, 0);
    let combinedUsedArea = 0;
    for (const a of [...plate1.allocation, ...plate2.allocation]) {
      combinedUsedArea += polygonArea(sides, a.stickerWidth, a.stickerHeight) * a.produced;
    }
    const combinedSheetArea = (plate1.totalSheets + plate2.totalSheets) * sheetWidth * sheetHeight;
    const combinedYield = combinedSheetArea > 0 ? (combinedUsedArea / combinedSheetArea) * 100 : 0;

    twoPlateResult = {
      plate1,
      plate2,
      totalSheets: plate1.totalSheets + plate2.totalSheets,
      totalProduced: combinedProduced,
      totalOverage: combinedProduced - combinedOrderQty,
      materialYield: combinedYield,
      sheetsSaved: singlePlateResult.totalSheets - (plate1.totalSheets + plate2.totalSheets),
      plate1ProjectIndices: p1Indices,
      plate2ProjectIndices: p2Indices,
    };
  }

  return {
    capacity: { maxPerSheet, sheetWidth, sheetHeight },
    singlePlateResult,
    twoPlateResult,
    plateSuggestions,
  };
}
