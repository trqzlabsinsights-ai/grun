// ── Industry Presets & Shared Constants ─────────────────────────────────────
// Extracted from page.tsx for reuse across the application.

import type { IndustryKey, IndustryPreset, PackMode } from "@/lib/types";

// ── Project Colors ──────────────────────────────────────────────────────────

export const PROJECT_COLORS = [
  "#06b6d4",
  "#ec4899",
  "#ef4444",
  "#8b5cf6",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#f97316",
  "#14b8a6",
  "#a855f7",
];

// ── Industry Presets ────────────────────────────────────────────────────────

export const INDUSTRY_PRESETS: Record<IndustryKey, IndustryPreset> = {
  "sticker-printing": {
    key: "sticker-printing",
    label: "Sticker Printing",
    icon: "🏷️",
    description: "Traditional sticker/printing gang run optimization",
    headerTitle: "Gang Run Calculator",
    headerSubtitle: "Multi-mode sticker optimization with MaxRect 2D packing",
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
    modeDescriptions: {
      "rect-same": "All stickers same size, per-project quantities only",
      "rect-mixed": "Sheet size, bleed, and project quantities with per-project sticker dimensions",
      "circular": "Circle stickers with per-project diameter and hexagonal packing",
      "custom": "Preset polygon shapes with ▲▼ tessellation for triangles & hex-offset for diamonds",
    },
  },
  "offset-printing": {
    key: "offset-printing",
    label: "Offset Printing",
    icon: "🖨️",
    description: "Press sheet layout for offset printing jobs",
    headerTitle: "Press Sheet Optimizer",
    headerSubtitle: "Multi-mode card/panel layout with MaxRect 2D packing",
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
    modeDescriptions: {
      "rect-same": "All cards same size, per-project quantities only",
      "rect-mixed": "Press sheet size, grip/trim, and project quantities with per-project card dimensions",
      "circular": "Circular pieces with per-project diameter and hexagonal packing",
      "custom": "Preset polygon shapes with ▲▼ tessellation for triangles & hex-offset for diamonds",
    },
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
    modeDescriptions: {
      "rect-same": "All parts same size, per-project quantities only",
      "rect-mixed": "Stock size, kerf allowance, and project quantities with per-project part dimensions",
      "circular": "Circular parts with per-project diameter and hexagonal packing",
      "custom": "Preset polygon shapes with ▲▼ tessellation for triangles & hex-offset for diamonds",
    },
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
    modeDescriptions: {
      "rect-same": "All pattern pieces same size, per-project quantities only",
      "rect-mixed": "Fabric roll size, seam allowance, and project quantities with per-project piece dimensions",
      "circular": "Circular pattern pieces with per-project diameter and hexagonal packing",
      "custom": "Preset polygon shapes with ▲▼ tessellation for triangles & hex-offset for diamonds",
    },
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
    modeDescriptions: {
      "rect-same": "All boxes same size, per-project quantities only",
      "rect-mixed": "Pallet size and project quantities with per-project box dimensions",
      "circular": "Circular items with per-project diameter and hexagonal packing",
      "custom": "Preset polygon shapes with ▲▼ tessellation for triangles & hex-offset for diamonds",
    },
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
    modeDescriptions: {
      "rect-same": "All panes same size, per-project quantities only",
      "rect-mixed": "Glass sheet size, edge clearance, and project quantities with per-project pane dimensions",
      "circular": "Circular panes with per-project diameter and hexagonal packing",
      "custom": "Preset polygon shapes with ▲▼ tessellation for triangles & hex-offset for diamonds",
    },
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
    modeDescriptions: {
      "rect-same": "All components same size, per-project quantities only",
      "rect-mixed": "Board size, spacing, and project quantities with per-project component dimensions",
      "circular": "Circular components with per-project diameter and hexagonal packing",
      "custom": "Preset polygon shapes with ▲▼ tessellation for triangles & hex-offset for diamonds",
    },
  },
};

// ── Helper ──────────────────────────────────────────────────────────────────

export function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
