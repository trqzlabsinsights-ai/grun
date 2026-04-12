// ── Mode Configuration & Default Project Data ──────────────────────────────
// Extracted from page.tsx for reuse.

import React from "react";
import { Square, LayoutGrid, CircleIcon, Hexagon } from "lucide-react";
import type { PackMode, ProjectInput, CircleProjectInput, CustomProjectInput } from "@/lib/types";

// ── Mode Config ────────────────────────────────────────────────────────────

export const MODE_CONFIG: Record<PackMode, { label: string; icon: React.ReactNode; desc: string }> = {
  "rect-same": { label: "Same Rect", icon: <Square className="w-4 h-4" />, desc: "All stickers same W\u00d7H" },
  "rect-mixed": { label: "Mixed Rect", icon: <LayoutGrid className="w-4 h-4" />, desc: "Each project has own W\u00d7H" },
  "circular": { label: "Circular", icon: <CircleIcon className="w-4 h-4" />, desc: "Circle stickers by diameter" },
  "custom": { label: "Polygon", icon: <Hexagon className="w-4 h-4" />, desc: "Regular polygons by sides" },
};

// ── Default Projects ───────────────────────────────────────────────────────

export const DEFAULT_RECT_SAME_PROJECTS: ProjectInput[] = [
  { name: "a", quantity: 6844, stickerWidth: 3.5, stickerHeight: 4.5 },
  { name: "b", quantity: 2860, stickerWidth: 3.5, stickerHeight: 4.5 },
  { name: "c", quantity: 2750, stickerWidth: 3.5, stickerHeight: 4.5 },
  { name: "d", quantity: 2255, stickerWidth: 3.5, stickerHeight: 4.5 },
  { name: "e", quantity: 1674, stickerWidth: 3.5, stickerHeight: 4.5 },
  { name: "f", quantity: 825, stickerWidth: 3.5, stickerHeight: 4.5 },
  { name: "g", quantity: 924, stickerWidth: 3.5, stickerHeight: 4.5 },
];

export const DEFAULT_RECT_MIXED_PROJECTS: ProjectInput[] = [
  { name: "a", quantity: 6844, stickerWidth: 3.5, stickerHeight: 4.5 },
  { name: "b", quantity: 2860, stickerWidth: 3.5, stickerHeight: 4.5 },
  { name: "c", quantity: 2750, stickerWidth: 3.5, stickerHeight: 4.5 },
  { name: "d", quantity: 2255, stickerWidth: 3.5, stickerHeight: 4.5 },
  { name: "e", quantity: 1674, stickerWidth: 3.5, stickerHeight: 4.5 },
  { name: "f", quantity: 825, stickerWidth: 3.5, stickerHeight: 4.5 },
  { name: "g", quantity: 924, stickerWidth: 3.5, stickerHeight: 4.5 },
];

export const DEFAULT_CIRCLE_PROJECTS: CircleProjectInput[] = [
  { name: "a", diameter: 3, quantity: 3000 },
  { name: "b", diameter: 4, quantity: 2000 },
  { name: "c", diameter: 2, quantity: 5000 },
  { name: "d", diameter: 5, quantity: 500 },
];

export const DEFAULT_CUSTOM_PROJECTS: CustomProjectInput[] = [
  { name: "a", stickerWidth: 3, stickerHeight: 3, sides: 3, quantity: 2000 },
  { name: "b", stickerWidth: 4, stickerHeight: 4, sides: 6, quantity: 1000 },
  { name: "c", stickerWidth: 3, stickerHeight: 3, sides: 4, quantity: 1500 },
];
