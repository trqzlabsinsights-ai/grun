// ── Shared Types for GangRun MVP (rect-mixed only) ────────────────────────

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
}

export interface ProjectInput {
  name: string;
  quantity: number;
  stickerWidth: number;
  stickerHeight: number;
}

export interface GroupShape {
  w: number;
  h: number;
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
  bleedIn?: number;
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

export interface PlateSuggestion {
  plateCount: number;
  feasible: boolean;
  totalSheets: number;
  description: string;
}

export interface CalculateResponse {
  mode?: string;
  capacity: Record<string, unknown> | null;
  maxSlots?: number;
  singlePlateResult: PlateResult | null;
  twoPlateResult: TwoPlateResult | null;
  multiPlateResult: MultiPlateResult | null;
  plateSuggestions?: PlateSuggestion[];
  error?: string;
}
