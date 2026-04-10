"use client";

import React, { useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  Calculator,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Loader2,
  LayoutGrid,
  Layers,
  AlertTriangle,
  Info,
  Ruler,
  Square,
  CircleIcon,
  Hexagon,
  Shapes,
} from "lucide-react";
import { PRESET_SHAPES } from "@/lib/packer-custom";

// ── Types ──────────────────────────────────────────────────────────────────

type PackMode = "rect-same" | "rect-mixed" | "circular" | "custom";

interface ProjectInput {
  name: string;
  quantity: number;
  stickerWidth: number;
  stickerHeight: number;
}

interface CircleProjectInput {
  name: string;
  quantity: number;
  diameter: number;
}

interface CustomProjectInput {
  name: string;
  quantity: number;
  stickerWidth: number;
  stickerHeight: number;
  shapeName: string;
  vertices: { x: number; y: number }[];
}

interface GroupShape {
  w: number;
  h: number;
}

interface TessPosition {
  x: number;
  y: number;
  flip: boolean;
}

interface PlacedGroup {
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

interface AllocationEntry {
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

interface PlateResult {
  allocation: AllocationEntry[];
  runLength: number;
  totalSheets: number;
  totalProduced: number;
  totalOverage: number;
  materialYield: number;
  placedGroups: PlacedGroup[];
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

interface CalculateResponse {
  mode?: PackMode;
  capacity: Record<string, unknown> | null;
  maxSlots?: number;
  singlePlateResult: PlateResult | null;
  twoPlateResult: TwoPlateResult | null;
  error?: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const PROJECT_COLORS = [
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

const DEFAULT_RECT_SAME_PROJECTS: ProjectInput[] = [
  { name: "a", quantity: 6844, stickerWidth: 3.5, stickerHeight: 4.5 },
  { name: "b", quantity: 2860, stickerWidth: 3.5, stickerHeight: 4.5 },
  { name: "c", quantity: 2750, stickerWidth: 3.5, stickerHeight: 4.5 },
  { name: "d", quantity: 2255, stickerWidth: 3.5, stickerHeight: 4.5 },
  { name: "e", quantity: 1674, stickerWidth: 3.5, stickerHeight: 4.5 },
  { name: "f", quantity: 825, stickerWidth: 3.5, stickerHeight: 4.5 },
  { name: "g", quantity: 924, stickerWidth: 3.5, stickerHeight: 4.5 },
];

const DEFAULT_RECT_MIXED_PROJECTS: ProjectInput[] = [
  { name: "a", quantity: 6844, stickerWidth: 3.5, stickerHeight: 4.5 },
  { name: "b", quantity: 2860, stickerWidth: 3.5, stickerHeight: 4.5 },
  { name: "c", quantity: 2750, stickerWidth: 3.5, stickerHeight: 4.5 },
  { name: "d", quantity: 2255, stickerWidth: 3.5, stickerHeight: 4.5 },
  { name: "e", quantity: 1674, stickerWidth: 3.5, stickerHeight: 4.5 },
  { name: "f", quantity: 825, stickerWidth: 3.5, stickerHeight: 4.5 },
  { name: "g", quantity: 924, stickerWidth: 3.5, stickerHeight: 4.5 },
];

const DEFAULT_CIRCLE_PROJECTS: CircleProjectInput[] = [
  { name: "a", diameter: 3, quantity: 3000 },
  { name: "b", diameter: 4, quantity: 2000 },
  { name: "c", diameter: 2, quantity: 5000 },
  { name: "d", diameter: 5, quantity: 500 },
];

const DEFAULT_CUSTOM_PROJECTS: CustomProjectInput[] = [
  { name: "a", stickerWidth: 3, stickerHeight: 3, shapeName: "triangle", vertices: PRESET_SHAPES.triangle.vertices, quantity: 2000 },
  { name: "b", stickerWidth: 4, stickerHeight: 4, shapeName: "heart", vertices: PRESET_SHAPES.heart.vertices, quantity: 1000 },
  { name: "c", stickerWidth: 3, stickerHeight: 4, shapeName: "diamond", vertices: PRESET_SHAPES.diamond.vertices, quantity: 1500 },
];

const MODE_CONFIG: Record<PackMode, { label: string; icon: React.ReactNode; desc: string }> = {
  "rect-same": { label: "Same Rect", icon: <Square className="w-4 h-4" />, desc: "All stickers same W\u00d7H" },
  "rect-mixed": { label: "Mixed Rect", icon: <LayoutGrid className="w-4 h-4" />, desc: "Each project has own W\u00d7H" },
  "circular": { label: "Circular", icon: <CircleIcon className="w-4 h-4" />, desc: "Circle stickers by diameter" },
  "custom": { label: "Custom Shape", icon: <Hexagon className="w-4 h-4" />, desc: "▲▼ tessellated polygons" },
};

// ── Registration Mark ──────────────────────────────────────────────────────

function RegMark({ x, y }: { x: number; y: number }) {
  const r = 0.18;
  return (
    <g>
      <line x1={x - r} y1={y} x2={x + r} y2={y} stroke="#f97316" strokeWidth={0.03} />
      <line x1={x} y1={y - r} x2={x} y2={y + r} stroke="#f97316" strokeWidth={0.03} />
      <circle cx={x} cy={y} r={0.06} fill="none" stroke="#f97316" strokeWidth={0.025} />
    </g>
  );
}

// ── Group-Based SVG Plate Visualization ────────────────────────────────────

function SVGPlateVisualization({
  plateResult,
  sheetWidth,
  sheetHeight,
  bleedInches,
  projectColors,
  projectNames,
  title,
  plateLabel,
  packMode,
}: {
  plateResult: PlateResult;
  sheetWidth: number;
  sheetHeight: number;
  bleedInches: number;
  projectColors: string[];
  projectNames: string[];
  title: string;
  plateLabel: string;
  packMode: PackMode;
}) {
  const { placedGroups, allocation, runLength } = plateResult;
  const pad = 1.2;
  const svgW = sheetWidth + pad * 2;
  const svgH = sheetHeight + pad * 2 + 1.8;
  const uniqueId = plateLabel.replace(/\s/g, "");

  return (
    <div className="w-full">
      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`${-pad} ${-pad} ${svgW} ${svgH}`}
          className="w-full max-w-4xl mx-auto"
          style={{ minHeight: 320 }}
        >
          <defs>
            <marker id={`arrow-${uniqueId}`} markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#06b6d4" />
            </marker>
            <pattern id={`bleed-hatch-${uniqueId}`} patternUnits="userSpaceOnUse" width="0.15" height="0.15" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="0.15" stroke="#f97316" strokeWidth="0.03" strokeOpacity="0.3" />
            </pattern>
          </defs>

          {/* Sheet background */}
          <rect x={0} y={0} width={sheetWidth} height={sheetHeight} rx={0.06} fill="#1e293b" stroke="#475569" strokeWidth={0.05} />

          {/* Render each placed group */}
          {placedGroups.map((group, gi) => {
            const colorIdx = projectNames.indexOf(group.name);
            const color = projectColors[colorIdx >= 0 ? colorIdx : 0] || "#64748b";
            const shape = group.shape;
            const itemType = group.itemType || (packMode === "rect-same" ? "rect-same" : packMode === "rect-mixed" ? "rect" : packMode);
            const bleed = bleedInches;

            // Size label for center text
            let sizeLabel = "";
            if (itemType === "circle" && group.diameter) {
              sizeLabel = `\u2300${group.diameter}"`;
            } else if (itemType === "custom" && group.shapeName) {
              const preset = PRESET_SHAPES[group.shapeName];
              sizeLabel = preset ? `${preset.icon} ${group.stickerWidth}"\u00d7${group.stickerHeight}"` : `${group.shapeName}`;
            } else {
              const sw = group.stickerWidth || 0;
              const sh = group.stickerHeight || 0;
              sizeLabel = `${sw}"\u00d7${sh}"`;
            }

            return (
              <g key={`grp-${gi}`}>
                {/* Group outer boundary (includes bleed) */}
                <rect
                  x={group.x}
                  y={group.y}
                  width={group.width}
                  height={group.height}
                  rx={0.06}
                  fill={color}
                  fillOpacity={0.12}
                  stroke={color}
                  strokeWidth={0.08}
                />

                {/* Bleed zone (hatched) — top */}
                <rect x={group.x + bleed} y={group.y} width={group.width - 2 * bleed} height={bleed} fill={`url(#bleed-hatch-${uniqueId})`} fillOpacity={0.5} />
                {/* Bleed zone — bottom */}
                <rect x={group.x + bleed} y={group.y + group.height - bleed} width={group.width - 2 * bleed} height={bleed} fill={`url(#bleed-hatch-${uniqueId})`} fillOpacity={0.5} />
                {/* Bleed zone — left */}
                <rect x={group.x} y={group.y + bleed} width={bleed} height={group.height - 2 * bleed} fill={`url(#bleed-hatch-${uniqueId})`} fillOpacity={0.5} />
                {/* Bleed zone — right */}
                <rect x={group.x + group.width - bleed} y={group.y + bleed} width={bleed} height={group.height - 2 * bleed} fill={`url(#bleed-hatch-${uniqueId})`} fillOpacity={0.5} />

                {/* ── CIRCLE MODE ── */}
                {itemType === "circle" && group.circles && group.diameter && (
                  <>
                    {group.circles.map((c, ci) => {
                      const r = group.diameter! / 2;
                      return (
                        <g key={`circ-${gi}-${ci}`}>
                          {/* Filled circle sticker */}
                          <circle
                            cx={c.cx}
                            cy={c.cy}
                            r={r}
                            fill={color}
                            fillOpacity={0.18}
                            stroke={color}
                            strokeWidth={0.04}
                            strokeOpacity={0.7}
                          />
                          {/* Die-cut line (dashed circle) */}
                          <circle
                            cx={c.cx}
                            cy={c.cy}
                            r={r - 0.05}
                            fill="none"
                            stroke="#f97316"
                            strokeWidth={0.02}
                            strokeDasharray="0.1 0.06"
                            strokeOpacity={0.5}
                          />
                        </g>
                      );
                    })}
                  </>
                )}

                {/* ── CUSTOM SHAPE MODE (tessellation) ── */}
                {itemType === "custom" && group.tessellated && group.tessPositions && group.tessPositions.length > 0 && group.vertices && group.stickerWidth && group.stickerHeight && (
                  <>
                    {group.tessPositions.map((tp, ti) => {
                      const sw = group.stickerWidth!;
                      const sh = group.stickerHeight!;
                      const inset = 0.05;
                      // Use flipVertices for inverted positions (▼), normal vertices for upright (▲)
                      const verts = tp.flip && group.flipVertices && group.flipVertices.length >= 3
                        ? group.flipVertices
                        : group.vertices!;

                      const points = verts.map(
                        (v) => `${tp.x + v.x * sw},${tp.y + v.y * sh}`
                      ).join(" ");
                      const diePoints = verts.map(
                        (v) => `${tp.x + inset + v.x * (sw - 2 * inset)},${tp.y + inset + v.y * (sh - 2 * inset)}`
                      ).join(" ");

                      return (
                        <g key={`tess-${gi}-${ti}`}>
                          <polygon
                            points={points}
                            fill={color}
                            fillOpacity={tp.flip ? 0.14 : 0.18}
                            stroke={color}
                            strokeWidth={0.04}
                            strokeOpacity={tp.flip ? 0.6 : 0.7}
                          />
                          <polygon
                            points={diePoints}
                            fill="none"
                            stroke="#f97316"
                            strokeWidth={0.02}
                            strokeDasharray="0.1 0.06"
                            strokeOpacity={0.5}
                          />
                        </g>
                      );
                    })}
                  </>
                )}

                {/* ── CUSTOM SHAPE MODE (non-tessellated, grid) ── */}
                {itemType === "custom" && !group.tessellated && group.vertices && group.vertices.length >= 3 && group.stickerWidth && group.stickerHeight && (
                  <>
                    {Array.from({ length: shape.h }).flatMap((_, row) =>
                      Array.from({ length: shape.w }).map((_, col) => {
                        const cellX = group.x + bleed + col * group.stickerWidth!;
                        const cellY = group.y + bleed + row * group.stickerHeight!;
                        const sw = group.stickerWidth!;
                        const sh = group.stickerHeight!;
                        const inset = 0.05;

                        const points = group.vertices!.map(
                          (v) => `${cellX + v.x * sw},${cellY + v.y * sh}`
                        ).join(" ");
                        const diePoints = group.vertices!.map(
                          (v) => `${cellX + inset + v.x * (sw - 2 * inset)},${cellY + inset + v.y * (sh - 2 * inset)}`
                        ).join(" ");

                        return (
                          <g key={`shape-${gi}-${row}-${col}`}>
                            <polygon
                              points={points}
                              fill={color}
                              fillOpacity={0.18}
                              stroke={color}
                              strokeWidth={0.04}
                              strokeOpacity={0.7}
                            />
                            <polygon
                              points={diePoints}
                              fill="none"
                              stroke="#f97316"
                              strokeWidth={0.02}
                              strokeDasharray="0.1 0.06"
                              strokeOpacity={0.5}
                            />
                          </g>
                        );
                      })
                    )}
                  </>
                )}

                {/* ── RECT MODES (same & mixed) ── */}
                {(itemType === "rect-same" || itemType === "rect") && group.stickerWidth && group.stickerHeight && (
                  <>
                    {Array.from({ length: shape.h }).flatMap((_, row) =>
                      Array.from({ length: shape.w }).map((_, col) => {
                        const cellX = group.x + bleed + col * group.stickerWidth!;
                        const cellY = group.y + bleed + row * group.stickerHeight!;
                        const sw = group.stickerWidth!;
                        const sh = group.stickerHeight!;
                        return (
                          <g key={`cell-${gi}-${row}-${col}`}>
                            <rect
                              x={cellX}
                              y={cellY}
                              width={sw}
                              height={sh}
                              rx={0.03}
                              fill={color}
                              fillOpacity={0.18}
                              stroke={color}
                              strokeWidth={0.04}
                              strokeOpacity={0.7}
                            />
                            <rect
                              x={cellX + 0.05}
                              y={cellY + 0.05}
                              width={sw - 0.1}
                              height={sh - 0.1}
                              rx={0.02}
                              fill="none"
                              stroke="#f97316"
                              strokeWidth={0.02}
                              strokeDasharray="0.1 0.06"
                              strokeOpacity={0.5}
                            />
                          </g>
                        );
                      })
                    )}
                  </>
                )}

                {/* Group label */}
                <text
                  x={group.x + group.width / 2}
                  y={group.y + group.height / 2 - 0.2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={color}
                  fontSize={0.7}
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  {group.name}
                </text>
                <text
                  x={group.x + group.width / 2}
                  y={group.y + group.height / 2 + 0.25}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#cbd5e1"
                  fontSize={0.28}
                  fontFamily="monospace"
                >
                  {group.outs} outs ({shape.w}&times;{shape.h})
                </text>
                <text
                  x={group.x + group.width / 2}
                  y={group.y + group.height / 2 + 0.5}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#94a3b8"
                  fontSize={0.2}
                  fontFamily="monospace"
                >
                  {sizeLabel}
                </text>

                {/* Group dimension label — width */}
                <text
                  x={group.x + group.width / 2}
                  y={group.y + group.height + 0.25}
                  textAnchor="middle"
                  fill="#64748b"
                  fontSize={0.2}
                  fontFamily="monospace"
                >
                  {group.width.toFixed(2)}&quot;
                </text>

                {/* Group dimension label — height */}
                <text
                  x={group.x + group.width + 0.2}
                  y={group.y + group.height / 2}
                  textAnchor="start"
                  fill="#64748b"
                  fontSize={0.2}
                  fontFamily="monospace"
                  transform={`rotate(90, ${group.x + group.width + 0.2}, ${group.y + group.height / 2})`}
                >
                  {group.height.toFixed(2)}&quot;
                </text>
              </g>
            );
          })}

          {/* Registration marks */}
          <RegMark x={-0.3} y={-0.3} />
          <RegMark x={sheetWidth + 0.3} y={-0.3} />
          <RegMark x={-0.3} y={sheetHeight + 0.3} />
          <RegMark x={sheetWidth + 0.3} y={sheetHeight + 0.3} />

          {/* Sheet dimension — width */}
          <line x1={0} y1={-0.6} x2={sheetWidth} y2={-0.6} stroke="#64748b" strokeWidth={0.025} />
          <line x1={0} y1={-0.75} x2={0} y2={-0.45} stroke="#64748b" strokeWidth={0.025} />
          <line x1={sheetWidth} y1={-0.75} x2={sheetWidth} y2={-0.45} stroke="#64748b" strokeWidth={0.025} />
          <text x={sheetWidth / 2} y={-0.82} textAnchor="middle" fill="#94a3b8" fontSize={0.32} fontFamily="monospace">
            {sheetWidth}&quot;
          </text>

          {/* Sheet dimension — height */}
          <line x1={sheetWidth + 0.6} y1={0} x2={sheetWidth + 0.6} y2={sheetHeight} stroke="#64748b" strokeWidth={0.025} />
          <line x1={sheetWidth + 0.45} y1={0} x2={sheetWidth + 0.75} y2={0} stroke="#64748b" strokeWidth={0.025} />
          <line x1={sheetWidth + 0.45} y1={sheetHeight} x2={sheetWidth + 0.75} y2={sheetHeight} stroke="#64748b" strokeWidth={0.025} />
          <text
            x={sheetWidth + 0.95}
            y={sheetHeight / 2}
            textAnchor="middle"
            fill="#94a3b8"
            fontSize={0.32}
            fontFamily="monospace"
            transform={`rotate(90, ${sheetWidth + 0.95}, ${sheetHeight / 2})`}
          >
            {sheetHeight}&quot;
          </text>

          {/* Plate title */}
          <text x={sheetWidth / 2} y={-1.0} textAnchor="middle" fill="#e2e8f0" fontSize={0.45} fontWeight="bold" fontFamily="monospace">
            {title}
          </text>
          <text x={sheetWidth / 2} y={-0.7} textAnchor="middle" fill="#94a3b8" fontSize={0.3} fontFamily="monospace">
            {runLength.toLocaleString()} sheets &times; {plateResult.allocation.reduce((s, a) => s + a.outs, 0)} outs
          </text>

          {/* Grain direction arrow */}
          <line x1={0.5} y1={sheetHeight + 0.7} x2={sheetWidth - 0.5} y2={sheetHeight + 0.7} stroke="#06b6d4" strokeWidth={0.035} markerEnd={`url(#arrow-${uniqueId})`} />
          <text x={sheetWidth / 2} y={sheetHeight + 0.6} textAnchor="middle" fill="#06b6d4" fontSize={0.22} fontFamily="monospace">
            GRAIN DIRECTION
          </text>

          {/* Legend */}
          <g transform={`translate(0, ${sheetHeight + 1.0})`}>
            <rect x={0} y={0} width={0.3} height={0.2} rx={0.03} fill={`url(#bleed-hatch-${uniqueId})`} stroke="#f97316" strokeWidth={0.02} />
            <text x={0.4} y={0.15} fill="#94a3b8" fontSize={0.2} fontFamily="monospace">5mm bleed zone (per group)</text>

            {packMode === "circular" ? (
              <>
                <circle cx={4.15} cy={0.1} r={0.1} fill="none" stroke="#f97316" strokeWidth={0.015} strokeDasharray="0.06 0.03" />
                <text x={4.4} y={0.15} fill="#94a3b8" fontSize={0.2} fontFamily="monospace">Die-cut line</text>
              </>
            ) : (
              <>
                <rect x={4} y={0.02} width={0.3} height={0.16} rx={0.02} fill="none" stroke="#f97316" strokeWidth={0.015} strokeDasharray="0.08 0.04" />
                <text x={4.4} y={0.15} fill="#94a3b8" fontSize={0.2} fontFamily="monospace">Die-cut line</text>
              </>
            )}

            <rect x={7.5} y={0.02} width={0.3} height={0.16} rx={0.02} fill="#06b6d4" fillOpacity={0.15} stroke="#06b6d4" strokeWidth={0.03} />
            <text x={7.9} y={0.15} fill="#94a3b8" fontSize={0.2} fontFamily="monospace">Group boundary</text>
          </g>
        </svg>
      </div>
    </div>
  );
}

// ── Bar Chart Component ────────────────────────────────────────────────────

function ProductionBarChart({
  allocation,
  projectColors,
  projectNames,
  packMode,
}: {
  allocation: AllocationEntry[];
  projectColors: string[];
  projectNames: string[];
  packMode: PackMode;
}) {
  const data = allocation.map((entry) => {
    let sizeStr = "";
    if (packMode === "circular" && entry.diameter) {
      sizeStr = `\u2300${entry.diameter}"`;
    } else if (packMode === "custom" && entry.shapeName) {
      const preset = PRESET_SHAPES[entry.shapeName];
      sizeStr = preset ? `${preset.icon}` : entry.shapeName;
    } else {
      sizeStr = `${entry.stickerWidth}"\u00d7${entry.stickerHeight}"`;
    }
    return {
      name: `${entry.name} (${sizeStr})`,
      order: entry.quantity,
      produced: entry.produced,
      color: projectColors[projectNames.indexOf(entry.name)] || "#64748b",
    };
  });

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} />
          <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
          <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #475569", borderRadius: 8, color: "#e2e8f0" }} />
          <Legend wrapperStyle={{ color: "#94a3b8" }} />
          <Bar dataKey="order" name="Order Qty" radius={[2, 2, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`order-${index}`} fill={entry.color} fillOpacity={0.4} />
            ))}
          </Bar>
          <Bar dataKey="produced" name="Produced" radius={[2, 2, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`produced-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── KPI Card ───────────────────────────────────────────────────────────────

function KPICard({ label, value, sub, accent = "text-cyan-400" }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className={`text-xl font-bold ${accent}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

// ── Allocation Table ───────────────────────────────────────────────────────

function AllocationTable({ allocation, projectColors, projectNames, packMode }: { allocation: AllocationEntry[]; projectColors: string[]; projectNames: string[]; packMode: PackMode }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-slate-700 hover:bg-transparent">
            <TableHead className="text-slate-400">Project</TableHead>
            {packMode === "circular" ? (
              <TableHead className="text-slate-400">Diameter</TableHead>
            ) : packMode === "custom" ? (
              <TableHead className="text-slate-400">Shape</TableHead>
            ) : (
              <TableHead className="text-slate-400">Sticker Size</TableHead>
            )}
            <TableHead className="text-slate-400 text-right">Order</TableHead>
            <TableHead className="text-slate-400 text-right">Outs</TableHead>
            <TableHead className="text-slate-400 text-right">Group</TableHead>
            <TableHead className="text-slate-400 text-right">Produced</TableHead>
            <TableHead className="text-slate-400 text-right">Overage</TableHead>
            <TableHead className="text-slate-400 text-right">Overage %</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {allocation.map((entry) => {
            const pIdx = projectNames.indexOf(entry.name);
            const color = projectColors[pIdx] || "#64748b";
            const gs = entry.groupShape;
            return (
              <TableRow key={entry.name} className="border-slate-700/50 hover:bg-slate-800/50">
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
                    <span className="font-medium text-slate-200">{entry.name}</span>
                  </div>
                </TableCell>
                {packMode === "circular" ? (
                  <TableCell className="text-slate-300 font-mono text-xs">&empty;{entry.diameter}&quot;</TableCell>
                ) : packMode === "custom" ? (
                  <TableCell className="text-slate-300 font-mono text-xs">
                    <span className="mr-1">{PRESET_SHAPES[entry.shapeName || "diamond"]?.icon || "\u25C6"}</span>
                    {entry.shapeName || "diamond"} ({entry.stickerWidth}&quot;&times;{entry.stickerHeight}&quot;){entry.tessellated ? " tess" : ""}
                  </TableCell>
                ) : (
                  <TableCell className="text-slate-300 font-mono text-xs">{entry.stickerWidth}&quot;&times;{entry.stickerHeight}&quot;</TableCell>
                )}
                <TableCell className="text-right text-slate-300">{entry.quantity.toLocaleString()}</TableCell>
                <TableCell className="text-right text-cyan-400 font-semibold">{entry.outs}</TableCell>
                <TableCell className="text-right text-slate-400 font-mono text-xs">{gs.w}&times;{gs.h}</TableCell>
                <TableCell className="text-right text-slate-300">{entry.produced.toLocaleString()}</TableCell>
                <TableCell className="text-right">
                  <span className={entry.overage > 0 ? "text-amber-400" : "text-slate-400"}>
                    +{entry.overage.toLocaleString()}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <span className={entry.overagePct > 20 ? "text-amber-400" : entry.overagePct > 10 ? "text-yellow-500" : "text-emerald-400"}>
                    {entry.overagePct.toFixed(1)}%
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ── Main Page Component ────────────────────────────────────────────────────

export default function GangRunCalculator() {
  const [packMode, setPackMode] = useState<PackMode>("rect-mixed");
  const [sheetWidth, setSheetWidth] = useState(24);
  const [sheetHeight, setSheetHeight] = useState(16.5);
  const [bleed, setBleed] = useState(5);

  // Per-mode project state
  const [rectSameProjects, setRectSameProjects] = useState<ProjectInput[]>(DEFAULT_RECT_SAME_PROJECTS);
  const [rectSameW, setRectSameW] = useState(3.5);
  const [rectSameH, setRectSameH] = useState(4.5);
  const [rectMixedProjects, setRectMixedProjects] = useState<ProjectInput[]>(DEFAULT_RECT_MIXED_PROJECTS);
  const [circleProjects, setCircleProjects] = useState<CircleProjectInput[]>(DEFAULT_CIRCLE_PROJECTS);
  const [customProjects, setCustomProjects] = useState<CustomProjectInput[]>(DEFAULT_CUSTOM_PROJECTS);

  const [inputOpen, setInputOpen] = useState(true);

  const [result, setResult] = useState<CalculateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("two");

  // ── Mode-specific project helpers ──────────────────────────────────────

  // Rect Same
  const addRectSameProject = useCallback(() => {
    const nextLetter = String.fromCharCode(97 + rectSameProjects.length);
    setRectSameProjects((prev) => [...prev, { name: nextLetter, quantity: 0, stickerWidth: rectSameW, stickerHeight: rectSameH }]);
  }, [rectSameProjects.length, rectSameW, rectSameH]);

  const removeRectSameProject = useCallback((index: number) => {
    setRectSameProjects((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateRectSameProject = useCallback((index: number, field: keyof ProjectInput, value: string) => {
    setRectSameProjects((prev) =>
      prev.map((p, i) => {
        if (i !== index) return p;
        if (field === "name") return { ...p, name: value };
        return { ...p, [field]: parseFloat(value) || 0 };
      })
    );
  }, []);

  // Rect Mixed
  const addRectMixedProject = useCallback(() => {
    const nextLetter = String.fromCharCode(97 + rectMixedProjects.length);
    setRectMixedProjects((prev) => [...prev, { name: nextLetter, quantity: 0, stickerWidth: 3.5, stickerHeight: 4.5 }]);
  }, [rectMixedProjects.length]);

  const removeRectMixedProject = useCallback((index: number) => {
    setRectMixedProjects((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateRectMixedProject = useCallback((index: number, field: keyof ProjectInput, value: string) => {
    setRectMixedProjects((prev) =>
      prev.map((p, i) => {
        if (i !== index) return p;
        if (field === "name") return { ...p, name: value };
        return { ...p, [field]: parseFloat(value) || 0 };
      })
    );
  }, []);

  const fillAllSizes = useCallback((w: number, h: number) => {
    setRectMixedProjects((prev) => prev.map((p) => ({ ...p, stickerWidth: w, stickerHeight: h })));
  }, []);

  // Circle
  const addCircleProject = useCallback(() => {
    const nextLetter = String.fromCharCode(97 + circleProjects.length);
    setCircleProjects((prev) => [...prev, { name: nextLetter, diameter: 3, quantity: 0 }]);
  }, [circleProjects.length]);

  const removeCircleProject = useCallback((index: number) => {
    setCircleProjects((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateCircleProject = useCallback((index: number, field: keyof CircleProjectInput, value: string) => {
    setCircleProjects((prev) =>
      prev.map((p, i) => {
        if (i !== index) return p;
        if (field === "name") return { ...p, name: value };
        return { ...p, [field]: parseFloat(value) || 0 };
      })
    );
  }, []);

  // Custom
  const addCustomProject = useCallback(() => {
    const nextLetter = String.fromCharCode(97 + customProjects.length);
    setCustomProjects((prev) => [...prev, { name: nextLetter, stickerWidth: 3, stickerHeight: 3, shapeName: "triangle", vertices: PRESET_SHAPES.triangle.vertices, quantity: 0 }]);
  }, [customProjects.length]);

  const removeCustomProject = useCallback((index: number) => {
    setCustomProjects((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateCustomProject = useCallback((index: number, field: keyof CustomProjectInput, value: string) => {
    setCustomProjects((prev) =>
      prev.map((p, i) => {
        if (i !== index) return p;
        if (field === "name") return { ...p, name: value };
        if (field === "shapeName") {
          const preset = PRESET_SHAPES[value];
          return { ...p, shapeName: value, vertices: preset ? preset.vertices : p.vertices };
        }
        // Handle vertices update for new shape
        return { ...p, [field]: parseFloat(value) || 0 };
      })
    );
  }, []);

  const updateCustomShape = useCallback((index: number, shapeName: string) => {
    setCustomProjects((prev) =>
      prev.map((p, i) => {
        if (i !== index) return p;
        const preset = PRESET_SHAPES[shapeName];
        return { ...p, shapeName, vertices: preset ? preset.vertices : p.vertices };
      })
    );
  }, []);

  // ── Calculate ──────────────────────────────────────────────────────────

  const handleCalculate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      let body: Record<string, unknown> = { mode: packMode, sheetWidth, sheetHeight, bleed };

      switch (packMode) {
        case "rect-same":
          body.stickerWidth = rectSameW;
          body.stickerHeight = rectSameH;
          body.projects = rectSameProjects.filter((p) => p.quantity > 0);
          break;
        case "rect-mixed":
          body.projects = rectMixedProjects.filter((p) => p.quantity > 0 && p.stickerWidth > 0 && p.stickerHeight > 0);
          break;
        case "circular":
          body.projects = circleProjects.filter((p) => p.quantity > 0 && p.diameter > 0);
          break;
        case "custom":
          body.projects = customProjects.filter((p) => p.quantity > 0 && p.stickerWidth > 0 && p.stickerHeight > 0);
          break;
      }

      const response = await fetch("/api/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data: CalculateResponse = await response.json();
      if (data.error) {
        setError(data.error);
      } else {
        setResult(data);
        setInputOpen(false);
      }
    } catch {
      setError("Failed to connect to calculation server.");
    } finally {
      setLoading(false);
    }
  }, [packMode, sheetWidth, sheetHeight, bleed, rectSameW, rectSameH, rectSameProjects, rectMixedProjects, circleProjects, customProjects]);

  const projectNames = result
    ? [...new Set([
        ...(result.singlePlateResult?.allocation || []),
        ...(result.twoPlateResult?.plate1.allocation || []),
        ...(result.twoPlateResult?.plate2.allocation || []),
      ].map((a) => a.name))]
    : (() => {
        switch (packMode) {
          case "rect-same": return rectSameProjects.map((p) => p.name);
          case "rect-mixed": return rectMixedProjects.map((p) => p.name);
          case "circular": return circleProjects.map((p) => p.name);
          case "custom": return customProjects.map((p) => p.name);
        }
      })();

  const bleedInches = bleed / 25.4;

  // ── Mode description helper ────────────────────────────────────────────

  const getModeDescription = () => {
    switch (packMode) {
      case "rect-same": return "All stickers same size, per-project quantities only";
      case "rect-mixed": return "Sheet size, bleed, and project quantities with per-project sticker dimensions";
      case "circular": return "Circle stickers with per-project diameter and hexagonal packing";
      case "custom": return "Preset polygon shapes with ▲▼ tessellation for triangles & hex-offset for diamonds";
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <div className="p-2 bg-cyan-500/10 rounded-lg">
            <LayoutGrid className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-100">Gang Run Calculator</h1>
            <p className="text-xs text-slate-400">Multi-mode sticker optimization with MaxRect 2D packing</p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* ── Mode Tabs ── */}
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-3">
              <Shapes className="w-4 h-4 text-cyan-400" />
              <Label className="text-sm font-semibold text-slate-300">Packing Mode</Label>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(Object.keys(MODE_CONFIG) as PackMode[]).map((mode) => {
                const cfg = MODE_CONFIG[mode];
                const isActive = packMode === mode;
                return (
                  <button
                    key={mode}
                    onClick={() => { setPackMode(mode); setResult(null); setError(null); }}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                      isActive
                        ? "bg-cyan-600/20 border-cyan-500/50 text-cyan-300 shadow-lg shadow-cyan-500/10"
                        : "bg-slate-800/50 border-slate-700/50 text-slate-400 hover:bg-slate-800 hover:text-slate-200 hover:border-slate-600"
                    }`}
                  >
                    {cfg.icon}
                    <div className="text-left">
                      <div className="leading-tight">{cfg.label}</div>
                      <div className="text-[10px] font-normal opacity-60 leading-tight">{cfg.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Input Panel */}
        <Collapsible open={inputOpen} onOpenChange={setInputOpen}>
          <Card className="bg-slate-900 border-slate-800">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-slate-800/50 transition-colors rounded-t-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-slate-100 flex items-center gap-2">
                      <Calculator className="w-5 h-5 text-cyan-400" />
                      Input Parameters
                    </CardTitle>
                    <CardDescription className="text-slate-400">
                      {getModeDescription()}
                    </CardDescription>
                  </div>
                  {inputOpen ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold text-slate-300">Sheet (inches)</Label>
                    <div className="flex items-center gap-2">
                      <Input type="number" step="0.1" min="1" value={sheetWidth} onChange={(e) => setSheetWidth(parseFloat(e.target.value) || 0)} className="bg-slate-800 border-slate-700 text-slate-100" placeholder="W" />
                      <span className="text-slate-500">&times;</span>
                      <Input type="number" step="0.1" min="1" value={sheetHeight} onChange={(e) => setSheetHeight(parseFloat(e.target.value) || 0)} className="bg-slate-800 border-slate-700 text-slate-100" placeholder="H" />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold text-slate-300">Bleed (mm per side, per group)</Label>
                    <Input type="number" step="0.5" min="0" value={bleed} onChange={(e) => setBleed(parseFloat(e.target.value) || 0)} className="bg-slate-800 border-slate-700 text-slate-100" />
                  </div>
                </div>

                <Separator className="bg-slate-700/50" />

                {/* ── RECT-SAME MODE ── */}
                {packMode === "rect-same" && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <Label className="text-sm font-semibold text-slate-300">Global Sticker Size (inches)</Label>
                        <div className="flex items-center gap-2">
                          <Input type="number" step="0.1" min="0.1" value={rectSameW || ""} onChange={(e) => setRectSameW(parseFloat(e.target.value) || 0)} className="bg-slate-800 border-slate-700 text-slate-100" placeholder="W" />
                          <span className="text-slate-500">&times;</span>
                          <Input type="number" step="0.1" min="0.1" value={rectSameH || ""} onChange={(e) => setRectSameH(parseFloat(e.target.value) || 0)} className="bg-slate-800 border-slate-700 text-slate-100" placeholder="H" />
                        </div>
                        <Button variant="outline" size="sm" onClick={() => { setRectSameW(3.5); setRectSameH(4.5); }} className="bg-slate-800 border-slate-700 text-slate-300 hover:text-slate-100 hover:bg-slate-700 text-xs">
                          <Ruler className="w-3 h-3 mr-1" /> Fill 3.5&times;4.5
                        </Button>
                      </div>
                    </div>
                    <Separator className="bg-slate-700/50" />
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <Label className="text-sm font-semibold text-slate-300">Projects (min 2 outs each)</Label>
                      <Button variant="outline" size="sm" onClick={addRectSameProject} className="bg-slate-800 border-slate-700 text-slate-300 hover:text-slate-100 hover:bg-slate-700">
                        <Plus className="w-4 h-4 mr-1" /> Add
                      </Button>
                    </div>
                    <div className="overflow-x-auto">
                      <div className="space-y-2 min-w-[400px]">
                        <div className="grid grid-cols-[32px_80px_1fr_36px] gap-2 text-xs text-slate-500 font-medium px-1">
                          <span></span>
                          <span>NAME</span>
                          <span>QUANTITY</span>
                          <span></span>
                        </div>
                        {rectSameProjects.map((project, idx) => (
                          <div key={idx} className="grid grid-cols-[32px_80px_1fr_36px] gap-2 items-center">
                            <div className="w-4 h-4 rounded-sm shrink-0 mx-auto" style={{ backgroundColor: PROJECT_COLORS[idx % PROJECT_COLORS.length] }} />
                            <Input value={project.name} onChange={(e) => updateRectSameProject(idx, "name", e.target.value)} className="bg-slate-800 border-slate-700 text-slate-100 h-8 text-sm" placeholder="Name" />
                            <Input type="number" min="0" value={project.quantity || ""} onChange={(e) => updateRectSameProject(idx, "quantity", e.target.value)} className="bg-slate-800 border-slate-700 text-slate-100 h-8 text-sm" placeholder="Order Qty" />
                            <Button variant="ghost" size="sm" onClick={() => removeRectSameProject(idx)} className="text-slate-500 hover:text-red-400 hover:bg-red-400/10 shrink-0 h-8 w-8 p-0" disabled={rectSameProjects.length <= 1}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── RECT-MIXED MODE ── */}
                {packMode === "rect-mixed" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <Label className="text-sm font-semibold text-slate-300">Projects (min 2 outs each — no abandoned projects)</Label>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => fillAllSizes(3.5, 4.5)} className="bg-slate-800 border-slate-700 text-slate-300 hover:text-slate-100 hover:bg-slate-700 text-xs">
                          <Ruler className="w-3 h-3 mr-1" /> Fill All 3.5&times;4.5
                        </Button>
                        <Button variant="outline" size="sm" onClick={addRectMixedProject} className="bg-slate-800 border-slate-700 text-slate-300 hover:text-slate-100 hover:bg-slate-700">
                          <Plus className="w-4 h-4 mr-1" /> Add
                        </Button>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <div className="space-y-2 min-w-[600px]">
                        <div className="grid grid-cols-[32px_80px_1fr_1fr_1fr_36px] gap-2 text-xs text-slate-500 font-medium px-1">
                          <span></span>
                          <span>NAME</span>
                          <span>STICKER W&times;H (in)</span>
                          <span>QUANTITY</span>
                          <span></span>
                          <span></span>
                        </div>
                        {rectMixedProjects.map((project, idx) => (
                          <div key={idx} className="grid grid-cols-[32px_80px_1fr_1fr_1fr_36px] gap-2 items-center">
                            <div className="w-4 h-4 rounded-sm shrink-0 mx-auto" style={{ backgroundColor: PROJECT_COLORS[idx % PROJECT_COLORS.length] }} />
                            <Input value={project.name} onChange={(e) => updateRectMixedProject(idx, "name", e.target.value)} className="bg-slate-800 border-slate-700 text-slate-100 h-8 text-sm" placeholder="Name" />
                            <div className="flex items-center gap-1">
                              <Input type="number" step="0.1" min="0.1" value={project.stickerWidth || ""} onChange={(e) => updateRectMixedProject(idx, "stickerWidth", e.target.value)} className="bg-slate-800 border-slate-700 text-slate-100 h-8 text-sm" placeholder="W" />
                              <span className="text-slate-500 text-xs">&times;</span>
                              <Input type="number" step="0.1" min="0.1" value={project.stickerHeight || ""} onChange={(e) => updateRectMixedProject(idx, "stickerHeight", e.target.value)} className="bg-slate-800 border-slate-700 text-slate-100 h-8 text-sm" placeholder="H" />
                            </div>
                            <Input type="number" min="0" value={project.quantity || ""} onChange={(e) => updateRectMixedProject(idx, "quantity", e.target.value)} className="bg-slate-800 border-slate-700 text-slate-100 h-8 text-sm" placeholder="Order Qty" />
                            <span></span>
                            <Button variant="ghost" size="sm" onClick={() => removeRectMixedProject(idx)} className="text-slate-500 hover:text-red-400 hover:bg-red-400/10 shrink-0 h-8 w-8 p-0" disabled={rectMixedProjects.length <= 1}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── CIRCULAR MODE ── */}
                {packMode === "circular" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <Label className="text-sm font-semibold text-slate-300">Circle Projects (hexagonal packing)</Label>
                      <Button variant="outline" size="sm" onClick={addCircleProject} className="bg-slate-800 border-slate-700 text-slate-300 hover:text-slate-100 hover:bg-slate-700">
                        <Plus className="w-4 h-4 mr-1" /> Add
                      </Button>
                    </div>
                    <div className="overflow-x-auto">
                      <div className="space-y-2 min-w-[500px]">
                        <div className="grid grid-cols-[32px_80px_1fr_1fr_36px] gap-2 text-xs text-slate-500 font-medium px-1">
                          <span></span>
                          <span>NAME</span>
                          <span>DIAMETER (in)</span>
                          <span>QUANTITY</span>
                          <span></span>
                        </div>
                        {circleProjects.map((project, idx) => (
                          <div key={idx} className="grid grid-cols-[32px_80px_1fr_1fr_36px] gap-2 items-center">
                            <div className="w-4 h-4 rounded-full shrink-0 mx-auto" style={{ backgroundColor: PROJECT_COLORS[idx % PROJECT_COLORS.length] }} />
                            <Input value={project.name} onChange={(e) => updateCircleProject(idx, "name", e.target.value)} className="bg-slate-800 border-slate-700 text-slate-100 h-8 text-sm" placeholder="Name" />
                            <Input type="number" step="0.1" min="0.1" value={project.diameter || ""} onChange={(e) => updateCircleProject(idx, "diameter", e.target.value)} className="bg-slate-800 border-slate-700 text-slate-100 h-8 text-sm" placeholder="Diameter" />
                            <Input type="number" min="0" value={project.quantity || ""} onChange={(e) => updateCircleProject(idx, "quantity", e.target.value)} className="bg-slate-800 border-slate-700 text-slate-100 h-8 text-sm" placeholder="Order Qty" />
                            <Button variant="ghost" size="sm" onClick={() => removeCircleProject(idx)} className="text-slate-500 hover:text-red-400 hover:bg-red-400/10 shrink-0 h-8 w-8 p-0" disabled={circleProjects.length <= 1}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── CUSTOM SHAPE MODE ── */}
                {packMode === "custom" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <Label className="text-sm font-semibold text-slate-300">Custom Shape Projects</Label>
                      <Button variant="outline" size="sm" onClick={addCustomProject} className="bg-slate-800 border-slate-700 text-slate-300 hover:text-slate-100 hover:bg-slate-700">
                        <Plus className="w-4 h-4 mr-1" /> Add
                      </Button>
                    </div>
                    <div className="overflow-x-auto">
                      <div className="space-y-2 min-w-[750px]">
                        <div className="grid grid-cols-[32px_60px_1fr_1fr_1fr_36px] gap-2 text-xs text-slate-500 font-medium px-1">
                          <span></span>
                          <span>NAME</span>
                          <span>W&times;H (in)</span>
                          <span>SHAPE</span>
                          <span>QTY</span>
                          <span></span>
                        </div>
                        {customProjects.map((project, idx) => (
                          <div key={idx} className="grid grid-cols-[32px_60px_1fr_1fr_1fr_36px] gap-2 items-center">
                            <div className="w-4 h-4 shrink-0 mx-auto flex items-center justify-center text-xs" style={{ color: PROJECT_COLORS[idx % PROJECT_COLORS.length] }}>
                              {PRESET_SHAPES[project.shapeName]?.icon || "\u25C6"}
                            </div>
                            <Input value={project.name} onChange={(e) => updateCustomProject(idx, "name", e.target.value)} className="bg-slate-800 border-slate-700 text-slate-100 h-8 text-sm" placeholder="Name" />
                            <div className="flex items-center gap-1">
                              <Input type="number" step="0.1" min="0.1" value={project.stickerWidth || ""} onChange={(e) => updateCustomProject(idx, "stickerWidth", e.target.value)} className="bg-slate-800 border-slate-700 text-slate-100 h-8 text-sm" placeholder="W" />
                              <span className="text-slate-500 text-xs">&times;</span>
                              <Input type="number" step="0.1" min="0.1" value={project.stickerHeight || ""} onChange={(e) => updateCustomProject(idx, "stickerHeight", e.target.value)} className="bg-slate-800 border-slate-700 text-slate-100 h-8 text-sm" placeholder="H" />
                            </div>
                            <Select value={project.shapeName} onValueChange={(val) => updateCustomShape(idx, val)}>
                              <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100 h-8 text-sm">
                                <SelectValue placeholder="Shape" />
                              </SelectTrigger>
                              <SelectContent className="bg-slate-800 border-slate-700">
                                {Object.entries(PRESET_SHAPES).map(([key, shape]) => (
                                  <SelectItem key={key} value={key} className="text-slate-200 focus:bg-slate-700 focus:text-slate-100">
                                    <span className="mr-1.5">{shape.icon}</span>
                                    {shape.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input type="number" min="0" value={project.quantity || ""} onChange={(e) => updateCustomProject(idx, "quantity", e.target.value)} className="bg-slate-800 border-slate-700 text-slate-100 h-8 text-sm" placeholder="Qty" />
                            <Button variant="ghost" size="sm" onClick={() => removeCustomProject(idx)} className="text-slate-500 hover:text-red-400 hover:bg-red-400/10 shrink-0 h-8 w-8 p-0" disabled={customProjects.length <= 1}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-4 pt-2">
                  <Button onClick={handleCalculate} disabled={loading} className="bg-cyan-600 hover:bg-cyan-500 text-white font-semibold px-8" size="lg">
                    {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Optimizing...</> : <><Calculator className="w-4 h-4 mr-2" /> Calculate</>}
                  </Button>
                  {loading && <span className="text-sm text-slate-400">
                    {packMode === "circular" ? "Hexagonal packing search..." : packMode === "custom" ? "Custom shape packing search..." : "Exhaustive search with MaxRect packing..."}
                  </span>}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Error */}
        {error && (
          <Card className="bg-red-950/50 border-red-800/50">
            <CardContent className="py-4">
              <div className="flex items-center gap-2 text-red-400">
                <AlertTriangle className="w-5 h-5" />
                <span>{error}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {result && (
          <>
            {/* Sheet Capacity */}
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-slate-100 flex items-center gap-2">
                  <LayoutGrid className="w-5 h-5 text-emerald-400" />
                  Sheet Capacity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <KPICard label="Sheet Size" value={`${sheetWidth}" × ${sheetHeight}"`} accent="text-emerald-400" />
                  <KPICard label="Mode" value={MODE_CONFIG[packMode].label} sub={MODE_CONFIG[packMode].desc} accent="text-emerald-400" />
                  <KPICard label="Bleed Per Side" value={`${bleed}mm`} sub={`${bleedInches.toFixed(4)}"`} accent="text-amber-400" />
                  <KPICard label="Algorithm" value={packMode === "circular" ? "HexPack" : "MaxRect"} sub={packMode === "circular" ? "Hexagonal packing" : "2D bin packing"} accent="text-slate-300" />
                </div>
              </CardContent>
            </Card>

            {/* Results Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="bg-slate-800 border border-slate-700">
                <TabsTrigger value="single" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white">
                  <Layers className="w-4 h-4 mr-1" /> Single Plate
                </TabsTrigger>
                <TabsTrigger value="two" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white">
                  <Layers className="w-4 h-4 mr-1" /> Two Plate
                </TabsTrigger>
              </TabsList>

              {/* Single Plate Tab */}
              <TabsContent value="single" className="space-y-6 mt-4">
                {result.singlePlateResult ? (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <KPICard label="Run Length" value={result.singlePlateResult.runLength.toLocaleString()} accent="text-cyan-400" />
                      <KPICard label="Total Sheets" value={result.singlePlateResult.totalSheets.toLocaleString()} accent="text-cyan-400" />
                      <KPICard label="Total Produced" value={result.singlePlateResult.totalProduced.toLocaleString()} sub={`Overage: +${result.singlePlateResult.totalOverage.toLocaleString()}`} accent="text-slate-200" />
                      <KPICard label="Material Yield" value={`${result.singlePlateResult.materialYield.toFixed(1)}%`} accent="text-emerald-400" />
                    </div>

                    <Card className="bg-slate-900 border-slate-800">
                      <CardHeader><CardTitle className="text-slate-100 text-base">Slot Allocation</CardTitle></CardHeader>
                      <CardContent>
                        <AllocationTable allocation={result.singlePlateResult.allocation} projectColors={PROJECT_COLORS} projectNames={projectNames} packMode={packMode} />
                      </CardContent>
                    </Card>

                    <Card className="bg-slate-900 border-slate-800">
                      <CardContent className="pt-6">
                        <SVGPlateVisualization
                          plateResult={result.singlePlateResult}
                          sheetWidth={sheetWidth}
                          sheetHeight={sheetHeight}
                          bleedInches={bleedInches}
                          projectColors={PROJECT_COLORS}
                          projectNames={projectNames}
                          title="Single Plate Layout"
                          plateLabel="single"
                          packMode={packMode}
                        />
                      </CardContent>
                    </Card>
                  </>
                ) : (
                  <Card className="bg-slate-900 border-slate-800">
                    <CardContent className="py-8 text-center text-slate-400">
                      <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-amber-400" />
                      <p>Cannot fit all projects on one plate with group constraints (min 2 outs each).</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Two Plate Tab */}
              <TabsContent value="two" className="space-y-6 mt-4">
                {result.twoPlateResult ? (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <KPICard label="Total Sheets" value={result.twoPlateResult.totalSheets.toLocaleString()} sub={`P1: ${result.twoPlateResult.plate1.runLength.toLocaleString()} | P2: ${result.twoPlateResult.plate2.runLength.toLocaleString()}`} accent="text-amber-400" />
                      <KPICard label="Total Produced" value={result.twoPlateResult.totalProduced.toLocaleString()} sub={`Overage: +${result.twoPlateResult.totalOverage.toLocaleString()}`} accent="text-slate-200" />
                      <KPICard label="Material Yield" value={`${result.twoPlateResult.materialYield.toFixed(1)}%`} accent="text-emerald-400" />
                      <KPICard label="Sheets Saved" value={result.twoPlateResult.sheetsSaved > 0 ? `-${result.twoPlateResult.sheetsSaved}` : `+${Math.abs(result.twoPlateResult.sheetsSaved)}`} sub={result.twoPlateResult.sheetsSaved > 0 ? "vs single plate" : "more than single"} accent={result.twoPlateResult.sheetsSaved > 0 ? "text-emerald-400" : "text-red-400"} />
                    </div>

                    {/* Cost info */}
                    <Card className="bg-slate-800/50 border-amber-700/30">
                      <CardContent className="py-4">
                        <div className="flex items-start gap-3">
                          <Info className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
                          <div className="text-sm text-slate-300">
                            {result.twoPlateResult.sheetsSaved > 0 ? (
                              <>
                                Two plates <span className="text-emerald-400 font-semibold">save {result.twoPlateResult.sheetsSaved.toLocaleString()} sheets</span> but cost{" "}
                                <span className="text-amber-400 font-semibold">1 extra plate set + setup</span>. Evaluate if paper savings outweigh the additional plate cost.
                              </>
                            ) : (
                              <>Two plates do not save sheets for this configuration.</>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Plate 1 */}
                    <Card className="bg-slate-900 border-slate-800">
                      <CardHeader>
                        <CardTitle className="text-slate-100 text-base flex items-center gap-2">
                          <div className="w-3 h-3 rounded-sm bg-cyan-500" />
                          Plate 1 — {result.twoPlateResult.plate1.runLength.toLocaleString()} sheets
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <AllocationTable allocation={result.twoPlateResult.plate1.allocation} projectColors={PROJECT_COLORS} projectNames={projectNames} packMode={packMode} />
                        <SVGPlateVisualization
                          plateResult={result.twoPlateResult.plate1}
                          sheetWidth={sheetWidth}
                          sheetHeight={sheetHeight}
                          bleedInches={bleedInches}
                          projectColors={PROJECT_COLORS}
                          projectNames={projectNames}
                          title={`Plate 1 — ${result.twoPlateResult.plate1.runLength.toLocaleString()} sheets`}
                          plateLabel="plate1"
                          packMode={packMode}
                        />
                      </CardContent>
                    </Card>

                    {/* Plate 2 */}
                    <Card className="bg-slate-900 border-slate-800">
                      <CardHeader>
                        <CardTitle className="text-slate-100 text-base flex items-center gap-2">
                          <div className="w-3 h-3 rounded-sm bg-amber-500" />
                          Plate 2 — {result.twoPlateResult.plate2.runLength.toLocaleString()} sheets
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <AllocationTable allocation={result.twoPlateResult.plate2.allocation} projectColors={PROJECT_COLORS} projectNames={projectNames} packMode={packMode} />
                        <SVGPlateVisualization
                          plateResult={result.twoPlateResult.plate2}
                          sheetWidth={sheetWidth}
                          sheetHeight={sheetHeight}
                          bleedInches={bleedInches}
                          projectColors={PROJECT_COLORS}
                          projectNames={projectNames}
                          title={`Plate 2 — ${result.twoPlateResult.plate2.runLength.toLocaleString()} sheets`}
                          plateLabel="plate2"
                          packMode={packMode}
                        />
                      </CardContent>
                    </Card>

                    {/* Combined summary */}
                    <Card className="bg-slate-900 border-slate-800">
                      <CardHeader>
                        <CardTitle className="text-slate-100 text-base">Combined Summary</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ProductionBarChart
                          allocation={[
                            ...result.twoPlateResult.plate1.allocation,
                            ...result.twoPlateResult.plate2.allocation,
                          ]}
                          projectColors={PROJECT_COLORS}
                          projectNames={projectNames}
                          packMode={packMode}
                        />
                      </CardContent>
                    </Card>
                  </>
                ) : (
                  <Card className="bg-slate-900 border-slate-800">
                    <CardContent className="py-8 text-center text-slate-400">
                      <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-amber-400" />
                      <p>Two-plate optimization not available.</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>
    </div>
  );
}
