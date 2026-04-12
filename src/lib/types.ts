// ── Shared Types for the Multi-Industry Packing Optimizer ────────────────

export type PackMode = "rect-same" | "rect-mixed" | "circular" | "custom";

export type IndustryKey =
  | "sticker-printing"
  | "offset-printing"
  | "cnc-cutting"
  | "textile-cutting"
  | "pallet-loading"
  | "glass-cutting"
  | "vlsi-pcb";

export interface IndustryTerms {
  sheet: string;
  sticker: string;
  plate: string;
  bleed: string;
  outs: string;
  grainDirection: string;
  overage: string;
}

export interface IndustryPreset {
  key: IndustryKey;
  label: string;
  icon: string;
  description: string;
  headerTitle: string;
  headerSubtitle: string;
  terms: IndustryTerms;
  defaults: {
    sheetWidth: number;
    sheetHeight: number;
    bleed: number;
  };
  modeDescriptions: {
    "rect-same": string;
    "rect-mixed": string;
    circular: string;
    custom: string;
  };
}

export interface ProjectInput {
  name: string;
  quantity: number;
  stickerWidth: number;
  stickerHeight: number;
}

export interface CircleProjectInput {
  name: string;
  quantity: number;
  diameter: number;
}

export interface CustomProjectInput {
  name: string;
  quantity: number;
  stickerWidth: number;
  stickerHeight: number;
  shapeName: string;
  vertices: { x: number; y: number }[];
}

export interface GroupShape {
  w: number;
  h: number;
}

export interface TessPosition {
  x: number;
  y: number;
  flip: boolean;
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
  stickerWidth?: number;
  stickerHeight?: number;
  itemType?: string;
  diameter?: number;
  circles?: { cx: number; cy: number }[];
  bleedIn?: number;
  shapeName?: string;
  vertices?: { x: number; y: number }[];
  flipVertices?: { x: number; y: number }[];
  tessellated?: boolean;
  tessPositions?: TessPosition[];
}

export interface AllocationEntry {
  name: string;
  quantity: number;
  outs: number;
  produced: number;
  overage: number;
  overagePct: number;
  groupShape: GroupShape;
  stickerWidth?: number;
  stickerHeight?: number;
  diameter?: number;
  shapeName?: string;
  tessellated?: boolean;
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

export interface PlateSuggestion {
  plateCount: number;
  feasible: boolean;
  totalSheets: number;
  description: string;
}

export interface CalculateResponse {
  mode?: PackMode;
  capacity: Record<string, unknown> | null;
  maxSlots?: number;
  singlePlateResult: PlateResult | null;
  twoPlateResult: TwoPlateResult | null;
  plateSuggestions?: PlateSuggestion[];
  error?: string;
}
