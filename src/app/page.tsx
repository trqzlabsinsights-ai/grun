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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  GitCompare,
  AlertTriangle,
  CheckCircle2,
  Info,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

interface ProjectInput {
  name: string;
  quantity: number;
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

const DEFAULT_PROJECTS: ProjectInput[] = [
  { name: "a", quantity: 6844 },
  { name: "b", quantity: 2860 },
  { name: "c", quantity: 2750 },
  { name: "d", quantity: 2255 },
  { name: "e", quantity: 1674 },
  { name: "f", quantity: 825 },
  { name: "g", quantity: 924 },
];

// ── Registration Mark Component ────────────────────────────────────────────

function RegMark({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  const r = 0.22 * scale;
  return (
    <g>
      <line x1={x - r} y1={y} x2={x + r} y2={y} stroke="#f97316" strokeWidth={0.04} />
      <line x1={x} y1={y - r} x2={x} y2={y + r} stroke="#f97316" strokeWidth={0.04} />
      <circle cx={x} cy={y} r={0.07 * scale} fill="none" stroke="#f97316" strokeWidth={0.03} />
    </g>
  );
}

// ── SVG Grid Visualization ─────────────────────────────────────────────────

function SVGGridVisualization({
  capacity,
  allocation,
  projectColors,
  projectNames,
  title,
}: {
  capacity: CapacityResult;
  allocation: AllocationEntry[];
  projectColors: string[];
  projectNames: string[];
  title: string;
}) {
  const { cols, rows, cellWidth, cellHeight, bleedInches, stickerWidth, stickerHeight, sheetWidth, sheetHeight } = capacity;

  // Calculate gutter spacing
  const totalCellW = cols * cellWidth;
  const totalCellH = rows * cellHeight;
  const gutterW = cols > 1 ? (sheetWidth - totalCellW) / (cols - 1) : 0;
  const gutterH = rows > 1 ? (sheetHeight - totalCellH) / (rows - 1) : 0;

  // Build slot assignment array (left-to-right, top-to-bottom)
  const slotAssignment: { projectName: string; projectIdx: number; col: number; row: number }[] = [];
  let slotIdx = 0;
  for (const entry of allocation) {
    const pIdx = projectNames.indexOf(entry.name);
    for (let s = 0; s < entry.outs; s++) {
      const col = slotIdx % cols;
      const row = Math.floor(slotIdx / cols);
      slotAssignment.push({ projectName: entry.name, projectIdx: pIdx >= 0 ? pIdx : 0, col, row });
      slotIdx++;
    }
  }

  // Identify contiguous groups (flood fill)
  const grid: (string | null)[][] = Array.from({ length: rows }, () => Array(cols).fill(null));
  for (const slot of slotAssignment) {
    if (slot.row < rows && slot.col < cols) {
      grid[slot.row][slot.col] = slot.projectName;
    }
  }

  const visited: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));
  interface GroupInfo { name: string; projectIdx: number; cells: { col: number; row: number }[]; }
  const groups: GroupInfo[] = [];

  function floodFill(r: number, c: number, name: string): { col: number; row: number }[] {
    if (r < 0 || r >= rows || c < 0 || c >= cols) return [];
    if (visited[r][c] || grid[r][c] !== name) return [];
    visited[r][c] = true;
    const cells = [{ col: c, row: r }];
    cells.push(...floodFill(r + 1, c, name));
    cells.push(...floodFill(r - 1, c, name));
    cells.push(...floodFill(r, c + 1, name));
    cells.push(...floodFill(r, c - 1, name));
    return cells;
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!visited[r][c] && grid[r][c]) {
        const cells = floodFill(r, c, grid[r][c]!);
        const pIdx = projectNames.indexOf(grid[r][c]!);
        groups.push({ name: grid[r][c]!, projectIdx: pIdx >= 0 ? pIdx : 0, cells });
      }
    }
  }

  // Helper: cell position in SVG coordinates
  const cellX = (col: number) => col * (cellWidth + gutterW);
  const cellY = (row: number) => row * (cellHeight + gutterH);

  // SVG dimensions
  const padding = 1.5;
  const svgW = sheetWidth + padding * 2;
  const svgH = sheetHeight + padding * 2 + 1.2;

  return (
    <div className="w-full">
      <h4 className="text-sm font-semibold text-slate-300 mb-2">{title}</h4>
      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`${-padding} ${-padding} ${svgW} ${svgH}`}
          className="w-full max-w-4xl mx-auto"
          style={{ minHeight: 280 }}
        >
          {/* Defs */}
          <defs>
            <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#06b6d4" />
            </marker>
          </defs>

          {/* Sheet background */}
          <rect x={0} y={0} width={sheetWidth} height={sheetHeight} rx={0.08} fill="#1e293b" stroke="#475569" strokeWidth={0.06} />

          {/* Render groups (contiguous project blocks) */}
          {groups.map((group, gi) => {
            const color = projectColors[group.projectIdx] || "#64748b";
            const minCol = Math.min(...group.cells.map(c => c.col));
            const maxCol = Math.max(...group.cells.map(c => c.col));
            const minRow = Math.min(...group.cells.map(c => c.row));
            const maxRow = Math.max(...group.cells.map(c => c.row));

            // Group bounding box
            const gx = cellX(minCol);
            const gy = cellY(minRow);
            const gw = (maxCol - minCol + 1) * cellWidth + (maxCol - minCol) * gutterW;
            const gh = (maxRow - minRow + 1) * cellHeight + (maxRow - minRow) * gutterH;

            return (
              <g key={`group-${gi}`}>
                {/* Group background block */}
                <rect x={gx} y={gy} width={gw} height={gh} rx={0.1} fill={color} fillOpacity={0.15} stroke={color} strokeWidth={0.08} />

                {/* Individual cells within group */}
                {group.cells.map((cell, ci) => {
                  const cx = cellX(cell.col);
                  const cy = cellY(cell.row);
                  return (
                    <g key={`cell-${gi}-${ci}`}>
                      {/* Cell background */}
                      <rect x={cx} y={cy} width={cellWidth} height={cellHeight} rx={0.06} fill={color} fillOpacity={0.08} stroke={color} strokeWidth={0.03} strokeOpacity={0.6} />
                      {/* Bleed boundary (die-cut line area) */}
                      <rect
                        x={cx + bleedInches}
                        y={cy + bleedInches}
                        width={stickerWidth}
                        height={stickerHeight}
                        rx={0.04}
                        fill={color}
                        fillOpacity={0.12}
                        stroke="#f97316"
                        strokeWidth={0.025}
                        strokeDasharray="0.12 0.08"
                        strokeOpacity={0.6}
                      />
                      {/* Coordinate label */}
                      <text
                        x={cx + cellWidth - 0.15}
                        y={cy + cellHeight - 0.12}
                        textAnchor="end"
                        dominantBaseline="auto"
                        fill="#475569"
                        fontSize={0.22}
                        fontFamily="monospace"
                      >
                        {cell.col},{cell.row}
                      </text>
                    </g>
                  );
                })}

                {/* Group label (centered) */}
                <text
                  x={gx + gw / 2}
                  y={gy + gh / 2 - 0.15}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={color}
                  fontSize={0.65}
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  {group.name}
                </text>
                <text
                  x={gx + gw / 2}
                  y={gy + gh / 2 + 0.35}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#94a3b8"
                  fontSize={0.25}
                  fontFamily="monospace"
                >
                  {group.cells.length} out{group.cells.length > 1 ? "s" : ""}
                </text>
              </g>
            );
          })}

          {/* Gutter lines (dashed) */}
          {cols > 1 && Array.from({ length: cols - 1 }).map((_, i) => {
            const x = (i + 1) * cellWidth + i * gutterW + gutterW / 2;
            return (
              <line key={`gv-${i}`} x1={x} y1={0} x2={x} y2={sheetHeight} stroke="#334155" strokeWidth={0.02} strokeDasharray="0.15 0.15" />
            );
          })}
          {rows > 1 && Array.from({ length: rows - 1 }).map((_, i) => {
            const y = (i + 1) * cellHeight + i * gutterH + gutterH / 2;
            return (
              <line key={`gh-${i}`} x1={0} y1={y} x2={sheetWidth} y2={y} stroke="#334155" strokeWidth={0.02} strokeDasharray="0.15 0.15" />
            );
          })}

          {/* Registration marks */}
          <RegMark x={-0.4} y={-0.4} />
          <RegMark x={sheetWidth + 0.4} y={-0.4} />
          <RegMark x={-0.4} y={sheetHeight + 0.4} />
          <RegMark x={sheetWidth + 0.4} y={sheetHeight + 0.4} />

          {/* Top dimension: sheet width */}
          <line x1={0} y1={-0.8} x2={sheetWidth} y2={-0.8} stroke="#64748b" strokeWidth={0.03} />
          <line x1={0} y1={-0.95} x2={0} y2={-0.65} stroke="#64748b" strokeWidth={0.03} />
          <line x1={sheetWidth} y1={-0.95} x2={sheetWidth} y2={-0.65} stroke="#64748b" strokeWidth={0.03} />
          <text x={sheetWidth / 2} y={-1.05} textAnchor="middle" fill="#94a3b8" fontSize={0.4} fontFamily="monospace">
            {sheetWidth}&quot;
          </text>

          {/* Right dimension: sheet height */}
          <line x1={sheetWidth + 0.8} y1={0} x2={sheetWidth + 0.8} y2={sheetHeight} stroke="#64748b" strokeWidth={0.03} />
          <line x1={sheetWidth + 0.65} y1={0} x2={sheetWidth + 0.95} y2={0} stroke="#64748b" strokeWidth={0.03} />
          <line x1={sheetWidth + 0.65} y1={sheetHeight} x2={sheetWidth + 0.95} y2={sheetHeight} stroke="#64748b" strokeWidth={0.03} />
          <text
            x={sheetWidth + 1.15}
            y={sheetHeight / 2}
            textAnchor="middle"
            fill="#94a3b8"
            fontSize={0.4}
            fontFamily="monospace"
            transform={`rotate(90, ${sheetWidth + 1.15}, ${sheetHeight / 2})`}
          >
            {sheetHeight}&quot;
          </text>

          {/* Cell size annotation */}
          <text x={sheetWidth / 2} y={sheetHeight + 0.5} textAnchor="middle" fill="#64748b" fontSize={0.3} fontFamily="monospace">
            {cols}×{rows} = {cols * rows} slots | Cell: {cellWidth.toFixed(3)}&quot; × {cellHeight.toFixed(3)}&quot; | Gutter: {gutterW.toFixed(3)}&quot; × {gutterH.toFixed(3)}&quot;
          </text>

          {/* Grain direction arrow */}
          <line x1={0.5} y1={sheetHeight + 0.9} x2={sheetWidth - 0.5} y2={sheetHeight + 0.9} stroke="#06b6d4" strokeWidth={0.04} markerEnd="url(#arrowhead)" />
          <text x={sheetWidth / 2} y={sheetHeight + 0.8} textAnchor="middle" fill="#06b6d4" fontSize={0.25} fontFamily="monospace">
            GRAIN DIRECTION
          </text>

          {/* Legend */}
          <g transform={`translate(0, ${sheetHeight + 1.15})`}>
            <rect x={0} y={0} width={0.35} height={0.25} rx={0.04} fill="#f97316" fillOpacity={0.3} stroke="#f97316" strokeWidth={0.02} strokeDasharray="0.08 0.05" />
            <text x={0.45} y={0.18} fill="#94a3b8" fontSize={0.25} fontFamily="monospace">= Bleed boundary (die-cut safe zone)</text>

            <circle cx={1.2} cy={0.12} r={0.1} fill="none" stroke="#f97316" strokeWidth={0.02} />
            <line x1={1.05} y1={0.12} x2={1.35} y2={0.12} stroke="#f97316" strokeWidth={0.02} />
            <line x1={1.2} y1={-0.03} x2={1.2} y2={0.27} stroke="#f97316" strokeWidth={0.02} />
            <text x={1.5} y={0.18} fill="#94a3b8" fontSize={0.25} fontFamily="monospace">= Registration mark</text>
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
}: {
  allocation: AllocationEntry[];
  projectColors: string[];
  projectNames: string[];
}) {
  const data = allocation.map((entry, i) => ({
    name: entry.name,
    order: entry.quantity,
    produced: entry.produced,
    color: projectColors[projectNames.indexOf(entry.name)] || "#64748b",
  }));

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} />
          <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1e293b",
              border: "1px solid #475569",
              borderRadius: 8,
              color: "#e2e8f0",
            }}
          />
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

function KPICard({
  label,
  value,
  sub,
  accent = "text-cyan-400",
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className={`text-xl font-bold ${accent}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

// ── Allocation Table ───────────────────────────────────────────────────────

function AllocationTable({
  allocation,
  projectColors,
  projectNames,
}: {
  allocation: AllocationEntry[];
  projectColors: string[];
  projectNames: string[];
}) {
  return (
    <div className="overflow-x-auto max-h-80 overflow-y-auto custom-scrollbar">
      <Table>
        <TableHeader>
          <TableRow className="border-slate-700 hover:bg-transparent">
            <TableHead className="text-slate-400">Project</TableHead>
            <TableHead className="text-slate-400 text-right">Order</TableHead>
            <TableHead className="text-slate-400 text-right">Outs</TableHead>
            <TableHead className="text-slate-400 text-right">Produced</TableHead>
            <TableHead className="text-slate-400 text-right">Overage</TableHead>
            <TableHead className="text-slate-400 text-right">Overage %</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {allocation.map((entry) => {
            const pIdx = projectNames.indexOf(entry.name);
            const color = projectColors[pIdx] || "#64748b";
            return (
              <TableRow key={entry.name} className="border-slate-700/50 hover:bg-slate-800/50">
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
                    <span className="font-medium text-slate-200">{entry.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right text-slate-300">{entry.quantity.toLocaleString()}</TableCell>
                <TableCell className="text-right text-cyan-400 font-semibold">{entry.outs}</TableCell>
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
  // Form state
  const [sheetWidth, setSheetWidth] = useState(24);
  const [sheetHeight, setSheetHeight] = useState(16.5);
  const [stickerWidth, setStickerWidth] = useState(3.5);
  const [stickerHeight, setStickerHeight] = useState(4.5);
  const [bleed, setBleed] = useState(5);
  const [projects, setProjects] = useState<ProjectInput[]>(DEFAULT_PROJECTS);
  const [inputOpen, setInputOpen] = useState(true);

  // Result state
  const [result, setResult] = useState<CalculateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("single");

  // Project management
  const addProject = useCallback(() => {
    const nextLetter = String.fromCharCode(97 + projects.length);
    setProjects((prev) => [...prev, { name: nextLetter, quantity: 0 }]);
  }, [projects.length]);

  const removeProject = useCallback((index: number) => {
    setProjects((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateProject = useCallback((index: number, field: "name" | "quantity", value: string) => {
    setProjects((prev) =>
      prev.map((p, i) => {
        if (i !== index) return p;
        if (field === "quantity") return { ...p, quantity: parseInt(value) || 0 };
        return { ...p, name: value };
      })
    );
  }, []);

  // Calculate
  const handleCalculate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sheetWidth,
          sheetHeight,
          stickerWidth,
          stickerHeight,
          bleed,
          projects: projects.filter((p) => p.quantity > 0),
        }),
      });

      const data: CalculateResponse = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        setResult(data);
        setInputOpen(false);
      }
    } catch (err) {
      setError("Failed to connect to calculation server.");
    } finally {
      setLoading(false);
    }
  }, [sheetWidth, sheetHeight, stickerWidth, stickerHeight, bleed, projects]);

  // Derived project names for colors
  const projectNames = (result ? [...new Set([...(result.singlePlateResult?.allocation || []), ...(result.twoPlateResult?.plate1.allocation || []), ...(result.twoPlateResult?.plate2.allocation || [])].map((a) => a.name))] : projects.map((p) => p.name));

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
            <p className="text-xs text-slate-400">Optimize multi-project print sheet layouts</p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* ── Input Panel ─────────────────────────────────────── */}
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
                      Configure sheet, sticker, and project details
                    </CardDescription>
                  </div>
                  {inputOpen ? (
                    <ChevronUp className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  )}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-6">
                {/* Dimensions Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  {/* Sheet Dimensions */}
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold text-slate-300">Sheet Dimensions (inches)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.1"
                        min="1"
                        value={sheetWidth}
                        onChange={(e) => setSheetWidth(parseFloat(e.target.value) || 0)}
                        className="bg-slate-800 border-slate-700 text-slate-100"
                        placeholder="Width"
                      />
                      <span className="text-slate-500">×</span>
                      <Input
                        type="number"
                        step="0.1"
                        min="1"
                        value={sheetHeight}
                        onChange={(e) => setSheetHeight(parseFloat(e.target.value) || 0)}
                        className="bg-slate-800 border-slate-700 text-slate-100"
                        placeholder="Height"
                      />
                    </div>
                  </div>

                  {/* Sticker Dimensions */}
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold text-slate-300">Sticker Dimensions (inches)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={stickerWidth}
                        onChange={(e) => setStickerWidth(parseFloat(e.target.value) || 0)}
                        className="bg-slate-800 border-slate-700 text-slate-100"
                        placeholder="Width"
                      />
                      <span className="text-slate-500">×</span>
                      <Input
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={stickerHeight}
                        onChange={(e) => setStickerHeight(parseFloat(e.target.value) || 0)}
                        className="bg-slate-800 border-slate-700 text-slate-100"
                        placeholder="Height"
                      />
                    </div>
                  </div>

                  {/* Bleed */}
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold text-slate-300">Bleed (mm per side)</Label>
                    <Input
                      type="number"
                      step="0.5"
                      min="0"
                      value={bleed}
                      onChange={(e) => setBleed(parseFloat(e.target.value) || 0)}
                      className="bg-slate-800 border-slate-700 text-slate-100"
                      placeholder="Bleed in mm"
                    />
                  </div>
                </div>

                <Separator className="bg-slate-700/50" />

                {/* Projects Table */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold text-slate-300">Projects</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addProject}
                      className="bg-slate-800 border-slate-700 text-slate-300 hover:text-slate-100 hover:bg-slate-700"
                    >
                      <Plus className="w-4 h-4 mr-1" /> Add Project
                    </Button>
                  </div>
                  <div className="overflow-x-auto">
                    <div className="space-y-2 min-w-[400px]">
                      {projects.map((project, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded-sm shrink-0"
                            style={{ backgroundColor: PROJECT_COLORS[idx % PROJECT_COLORS.length] }}
                          />
                          <Input
                            value={project.name}
                            onChange={(e) => updateProject(idx, "name", e.target.value)}
                            className="bg-slate-800 border-slate-700 text-slate-100 w-24"
                            placeholder="Name"
                          />
                          <Input
                            type="number"
                            min="0"
                            value={project.quantity || ""}
                            onChange={(e) => updateProject(idx, "quantity", e.target.value)}
                            className="bg-slate-800 border-slate-700 text-slate-100 flex-1"
                            placeholder="Order Quantity"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeProject(idx)}
                            className="text-slate-500 hover:text-red-400 hover:bg-red-400/10 shrink-0"
                            disabled={projects.length <= 1}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Calculate Button */}
                <div className="flex items-center gap-4 pt-2">
                  <Button
                    onClick={handleCalculate}
                    disabled={loading}
                    className="bg-cyan-600 hover:bg-cyan-500 text-white font-semibold px-8"
                    size="lg"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Calculating...
                      </>
                    ) : (
                      <>
                        <Calculator className="w-4 h-4 mr-2" /> Calculate
                      </>
                    )}
                  </Button>
                  {loading && (
                    <span className="text-sm text-slate-400">
                      Running exhaustive optimization...
                    </span>
                  )}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* ── Error Display ───────────────────────────────────── */}
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

        {/* ── Results ─────────────────────────────────────────── */}
        {result && (
          <>
            {/* Sheet Capacity Card */}
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-slate-100 flex items-center gap-2">
                  <LayoutGrid className="w-5 h-5 text-emerald-400" />
                  Sheet Capacity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <KPICard label="Grid" value={`${result.capacity.cols} × ${result.capacity.rows}`} accent="text-emerald-400" />
                  <KPICard label="Max Per Sheet" value={result.capacity.maxPerSheet} accent="text-emerald-400" />
                  <KPICard
                    label="Cell Size"
                    value={`${result.capacity.cellWidth.toFixed(3)}" × ${result.capacity.cellHeight.toFixed(3)}"`}
                    sub={`Sticker + ${bleed}mm bleed × 2`}
                    accent="text-slate-300"
                  />
                  <KPICard
                    label="Bleed Per Side"
                    value={`${bleed}mm`}
                    sub={`${result.capacity.bleedInches.toFixed(4)}"`}
                    accent="text-amber-400"
                  />
                </div>
                {/* Mini Grid Diagram */}
                <div className="mt-4 flex justify-center">
                  <svg
                    viewBox={`0 0 ${result.capacity.cols * 2 + 1} ${result.capacity.rows * 2 + 1}`}
                    className="w-32 h-auto"
                  >
                    {Array.from({ length: result.capacity.rows }).flatMap((_, r) =>
                      Array.from({ length: result.capacity.cols }).map((_, c) => (
                        <rect
                          key={`${r}-${c}`}
                          x={c * 2 + 0.5}
                          y={r * 2 + 0.5}
                          width={1.8}
                          height={1.8}
                          rx={0.2}
                          fill="#10b981"
                          fillOpacity={0.15}
                          stroke="#10b981"
                          strokeWidth={0.1}
                        />
                      ))
                    )}
                  </svg>
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
                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <KPICard label="Run Length" value={result.singlePlateResult.runLength.toLocaleString()} accent="text-cyan-400" />
                      <KPICard label="Total Sheets" value={result.singlePlateResult.totalSheets.toLocaleString()} accent="text-cyan-400" />
                      <KPICard label="Total Produced" value={result.singlePlateResult.totalProduced.toLocaleString()} sub={`Overage: +${result.singlePlateResult.totalOverage.toLocaleString()}`} accent="text-slate-200" />
                      <KPICard label="Material Yield" value={`${result.singlePlateResult.materialYield.toFixed(1)}%`} accent="text-emerald-400" />
                    </div>

                    {/* Allocation Table */}
                    <Card className="bg-slate-900 border-slate-800">
                      <CardHeader>
                        <CardTitle className="text-slate-100 text-base">Slot Allocation</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <AllocationTable
                          allocation={result.singlePlateResult.allocation}
                          projectColors={PROJECT_COLORS}
                          projectNames={projectNames}
                        />
                      </CardContent>
                    </Card>

                    {/* Bar Chart */}
                    <Card className="bg-slate-900 border-slate-800">
                      <CardHeader>
                        <CardTitle className="text-slate-100 text-base">Production vs Order</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ProductionBarChart
                          allocation={result.singlePlateResult.allocation}
                          projectColors={PROJECT_COLORS}
                          projectNames={projectNames}
                        />
                      </CardContent>
                    </Card>

                    {/* SVG Grid */}
                    <Card className="bg-slate-900 border-slate-800">
                      <CardContent className="pt-6">
                        <SVGGridVisualization
                          capacity={result.capacity}
                          allocation={result.singlePlateResult.allocation}
                          projectColors={PROJECT_COLORS}
                          projectNames={projectNames}
                          title="Sheet Layout — Single Plate"
                        />
                      </CardContent>
                    </Card>
                  </>
                ) : (
                  <Card className="bg-slate-900 border-slate-800">
                    <CardContent className="py-8 text-center text-slate-400">
                      <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-amber-400" />
                      <p>Too many projects for available sheet slots.</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Two Plate Tab */}
              <TabsContent value="two" className="space-y-6 mt-4">
                {result.twoPlateResult ? (
                  <>
                    {/* Combined KPI Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <KPICard
                        label="Total Sheets"
                        value={result.twoPlateResult.totalSheets.toLocaleString()}
                        sub={`Plate 1: ${result.twoPlateResult.plate1.runLength.toLocaleString()} | Plate 2: ${result.twoPlateResult.plate2.runLength.toLocaleString()}`}
                        accent="text-amber-400"
                      />
                      <KPICard label="Total Produced" value={result.twoPlateResult.totalProduced.toLocaleString()} sub={`Overage: +${result.twoPlateResult.totalOverage.toLocaleString()}`} accent="text-slate-200" />
                      <KPICard label="Material Yield" value={`${result.twoPlateResult.materialYield.toFixed(1)}%`} accent="text-emerald-400" />
                      <KPICard
                        label="Sheets Saved"
                        value={result.twoPlateResult.sheetsSaved > 0 ? `-${result.twoPlateResult.sheetsSaved}` : `+${Math.abs(result.twoPlateResult.sheetsSaved)}`}
                        sub={result.twoPlateResult.sheetsSaved > 0 ? "vs single plate" : "more than single"}
                        accent={result.twoPlateResult.sheetsSaved > 0 ? "text-emerald-400" : "text-red-400"}
                      />
                    </div>

                    {/* Cost Comparison Box */}
                    <Card className="bg-slate-800/50 border-amber-700/30">
                      <CardContent className="py-4">
                        <div className="flex items-start gap-3">
                          <Info className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
                          <div className="text-sm text-slate-300">
                            {result.twoPlateResult.sheetsSaved > 0 ? (
                              <>
                                Two plates <span className="text-emerald-400 font-semibold">save {result.twoPlateResult.sheetsSaved.toLocaleString()} sheets</span> but cost{" "}
                                <span className="text-amber-400 font-semibold">1 extra plate set + setup</span>. Evaluate if the paper savings outweigh the additional plate cost.
                              </>
                            ) : (
                              <>
                                Two plates <span className="text-red-400 font-semibold">do not save sheets</span> for this configuration. Single plate is more efficient.
                              </>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Plate 1 */}
                    <Card className="bg-slate-900 border-slate-800">
                      <CardHeader>
                        <CardTitle className="text-slate-100 text-base flex items-center gap-2">
                          <div className="w-3 h-3 rounded-sm bg-amber-400" />
                          Plate 1 — {result.twoPlateResult.plate1.allocation.map((a) => a.name).join(", ")}
                          <Badge variant="secondary" className="bg-slate-800 text-slate-300 ml-2">
                            L = {result.twoPlateResult.plate1.runLength.toLocaleString()}
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <AllocationTable
                          allocation={result.twoPlateResult.plate1.allocation}
                          projectColors={PROJECT_COLORS}
                          projectNames={projectNames}
                        />
                        <SVGGridVisualization
                          capacity={result.capacity}
                          allocation={result.twoPlateResult.plate1.allocation}
                          projectColors={PROJECT_COLORS}
                          projectNames={projectNames}
                          title="Plate 1 Layout"
                        />
                      </CardContent>
                    </Card>

                    {/* Plate 2 */}
                    <Card className="bg-slate-900 border-slate-800">
                      <CardHeader>
                        <CardTitle className="text-slate-100 text-base flex items-center gap-2">
                          <div className="w-3 h-3 rounded-sm bg-emerald-400" />
                          Plate 2 — {result.twoPlateResult.plate2.allocation.map((a) => a.name).join(", ")}
                          <Badge variant="secondary" className="bg-slate-800 text-slate-300 ml-2">
                            L = {result.twoPlateResult.plate2.runLength.toLocaleString()}
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <AllocationTable
                          allocation={result.twoPlateResult.plate2.allocation}
                          projectColors={PROJECT_COLORS}
                          projectNames={projectNames}
                        />
                        <SVGGridVisualization
                          capacity={result.capacity}
                          allocation={result.twoPlateResult.plate2.allocation}
                          projectColors={PROJECT_COLORS}
                          projectNames={projectNames}
                          title="Plate 2 Layout"
                        />
                      </CardContent>
                    </Card>

                    {/* Combined Bar Chart */}
                    <Card className="bg-slate-900 border-slate-800">
                      <CardHeader>
                        <CardTitle className="text-slate-100 text-base">Combined Production vs Order</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ProductionBarChart
                          allocation={[
                            ...result.twoPlateResult.plate1.allocation,
                            ...result.twoPlateResult.plate2.allocation,
                          ]}
                          projectColors={PROJECT_COLORS}
                          projectNames={projectNames}
                        />
                      </CardContent>
                    </Card>
                  </>
                ) : (
                  <Card className="bg-slate-900 border-slate-800">
                    <CardContent className="py-8 text-center text-slate-400">
                      <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-amber-400" />
                      <p>Two-plate optimization requires at least 2 projects.</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>

            {/* ── Comparison Card ─────────────────────────────── */}
            {result.singlePlateResult && result.twoPlateResult && (
              <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-slate-100 flex items-center gap-2">
                    <GitCompare className="w-5 h-5 text-violet-400" />
                    Comparison: Single Plate vs Two Plates
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    {/* Single Plate */}
                    <div className="bg-cyan-950/30 border border-cyan-800/30 rounded-lg p-4 space-y-2">
                      <div className="text-sm font-semibold text-cyan-400">Single Plate</div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Total Sheets</span>
                          <span className="text-slate-200 font-medium">{result.singlePlateResult.totalSheets.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Total Overage</span>
                          <span className="text-amber-400">+{result.singlePlateResult.totalOverage.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Plates</span>
                          <span className="text-slate-200">1</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Yield</span>
                          <span className="text-emerald-400">{result.singlePlateResult.materialYield.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>

                    {/* Two Plates */}
                    <div className="bg-amber-950/30 border border-amber-800/30 rounded-lg p-4 space-y-2">
                      <div className="text-sm font-semibold text-amber-400">Two Plates</div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Total Sheets</span>
                          <span className="text-slate-200 font-medium">{result.twoPlateResult.totalSheets.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Total Overage</span>
                          <span className="text-amber-400">+{result.twoPlateResult.totalOverage.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Plates</span>
                          <span className="text-slate-200">2</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Yield</span>
                          <span className="text-emerald-400">{result.twoPlateResult.materialYield.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>

                    {/* Recommendation */}
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4 space-y-3">
                      <div className="text-sm font-semibold text-violet-400">Recommendation</div>
                      {result.twoPlateResult.sheetsSaved > 0 ? (
                        <>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                            <span className="text-sm font-semibold text-emerald-400">Two Plates Recommended</span>
                          </div>
                          <div className="text-xs text-slate-400 space-y-1">
                            <p>Saves <span className="text-emerald-400 font-medium">{result.twoPlateResult.sheetsSaved.toLocaleString()} sheets</span> ({((result.twoPlateResult.sheetsSaved / result.singlePlateResult.totalSheets) * 100).toFixed(1)}% reduction)</p>
                            <p>Trade-off: +1 plate set &amp; setup cost</p>
                            <p className="text-slate-500 pt-1">
                              If plate cost &lt; {result.twoPlateResult.sheetsSaved} × sheet cost, two plates win.
                            </p>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-cyan-400" />
                            <span className="text-sm font-semibold text-cyan-400">Single Plate Recommended</span>
                          </div>
                          <div className="text-xs text-slate-400">
                            <p>Two plates don&apos;t save sheets for this configuration.</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Empty state */}
        {!result && !loading && !error && (
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="py-12 text-center">
              <Calculator className="w-12 h-12 mx-auto mb-4 text-slate-600" />
              <h3 className="text-lg font-semibold text-slate-400 mb-2">Ready to Calculate</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                Configure your sheet dimensions, sticker size, and project quantities above, then click Calculate to find the optimal gang run layout.
              </p>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-900/50 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 text-center text-xs text-slate-600">
          Gang Run Calculator — Exhaustive Optimization Engine
        </div>
      </footer>
    </div>
  );
}
