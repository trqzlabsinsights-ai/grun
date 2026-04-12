"use client";

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
import type { AllocationEntry, PackMode } from "@/lib/types";
import { PRESET_SHAPES } from "@/lib/packer-custom";

export function ProductionBarChart({
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
