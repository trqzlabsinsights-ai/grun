// ── Industry Presets & Shared Constants (MVP — rect-mixed only) ────────────

import type { IndustryKey, IndustryPreset } from "@/lib/types";

// ── Project Colors ──────────────────────────────────────────────────────────

export const PROJECT_COLORS = [
  "#2563eb",
  "#db2777",
  "#dc2626",
  "#7c3aed",
  "#d97706",
  "#059669",
  "#0284c7",
  "#ea580c",
  "#0d9488",
  "#9333ea",
];

// ── Industry Presets ────────────────────────────────────────────────────────

export const INDUSTRY_PRESETS: Record<IndustryKey, IndustryPreset> = {
  "sticker-printing": {
    key: "sticker-printing",
    label: "Sticker Printing",
    icon: "🏷️",
    description: "Traditional sticker/printing gang run optimization",
    headerTitle: "Gang Run Calculator",
    headerSubtitle: "Plate optimization with MaxRect 2D packing",
    terms: {
      sheet: "sheet",
      sticker: "sticker",
      plate: "plate",
      bleed: "bleed",
      outs: "outs",
      grainDirection: "GRAIN DIRECTION",
      overage: "overage",
    },
    defaults: { sheetWidth: 24, sheetHeight: 16.5, bleed: 5 },
  },
  "offset-printing": {
    key: "offset-printing",
    label: "Offset Printing",
    icon: "🖨️",
    description: "Press sheet layout for offset printing jobs",
    headerTitle: "Press Sheet Optimizer",
    headerSubtitle: "Card/panel layout with MaxRect 2D packing",
    terms: {
      sheet: "press sheet",
      sticker: "card/panel",
      plate: "plate",
      bleed: "grip/trim",
      outs: "up",
      grainDirection: "GRAIN DIRECTION",
      overage: "overrun",
    },
    defaults: { sheetWidth: 25, sheetHeight: 19, bleed: 5 },
  },
  "cnc-cutting": {
    key: "cnc-cutting",
    label: "CNC / Material Cutting",
    icon: "⚙️",
    description: "Material stock layout for CNC cutting optimization",
    headerTitle: "CNC Cutting Optimizer",
    headerSubtitle: "Material nesting with MaxRect 2D packing",
    terms: {
      sheet: "stock/material",
      sticker: "part/piece",
      plate: "layout",
      bleed: "kerf allowance",
      outs: "per sheet",
      grainDirection: "GRAIN DIRECTION",
      overage: "waste",
    },
    defaults: { sheetWidth: 48, sheetHeight: 96, bleed: 3 },
  },
  "textile-cutting": {
    key: "textile-cutting",
    label: "Textile / Fabric Cutting",
    icon: "✂️",
    description: "Fabric roll/marker layout for pattern cutting",
    headerTitle: "Fabric Cutting Optimizer",
    headerSubtitle: "Pattern nesting with MaxRect 2D packing",
    terms: {
      sheet: "fabric roll/yard",
      sticker: "pattern piece",
      plate: "marker",
      bleed: "seam allowance",
      outs: "per marker",
      grainDirection: "WARP DIRECTION",
      overage: "waste",
    },
    defaults: { sheetWidth: 45, sheetHeight: 36, bleed: 6 },
  },
  "pallet-loading": {
    key: "pallet-loading",
    label: "Pallet Loading",
    icon: "📦",
    description: "Pallet layout optimization for box/carton loading",
    headerTitle: "Pallet Loading Optimizer",
    headerSubtitle: "Box/carton arrangement with MaxRect 2D packing",
    terms: {
      sheet: "pallet",
      sticker: "box/carton",
      plate: "load plan",
      bleed: "—",
      outs: "per pallet",
      grainDirection: "—",
      overage: "unused",
    },
    defaults: { sheetWidth: 48, sheetHeight: 40, bleed: 0 },
  },
  "glass-cutting": {
    key: "glass-cutting",
    label: "Glass / Sheet Cutting",
    icon: "🪟",
    description: "Glass sheet layout for pane/panel cutting",
    headerTitle: "Glass Cutting Optimizer",
    headerSubtitle: "Glass nesting with MaxRect 2D packing",
    terms: {
      sheet: "glass sheet",
      sticker: "pane/panel",
      plate: "layout",
      bleed: "edge clearance",
      outs: "per sheet",
      grainDirection: "—",
      overage: "waste",
    },
    defaults: { sheetWidth: 96, sheetHeight: 60, bleed: 3 },
  },
  "vlsi-pcb": {
    key: "vlsi-pcb",
    label: "VLSI / PCB Layout",
    icon: "🔌",
    description: "Board/die layout for component/block placement",
    headerTitle: "VLSI / PCB Layout Optimizer",
    headerSubtitle: "Component placement with MaxRect 2D packing",
    terms: {
      sheet: "board/die",
      sticker: "component/block",
      plate: "board",
      bleed: "spacing",
      outs: "per board",
      grainDirection: "—",
      overage: "unused",
    },
    defaults: { sheetWidth: 12, sheetHeight: 12, bleed: 1 },
  },
};

// ── Helper ──────────────────────────────────────────────────────────────────

export function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
