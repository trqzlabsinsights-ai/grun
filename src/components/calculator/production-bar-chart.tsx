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
import type { AllocationEntry } from "@/lib/types";

export function ProductionBarChart({
  allocation,
  projectColors,
  projectNames,
}: {
  allocation: AllocationEntry[];
  projectColors: string[];
  projectNames: string[];
}) {
  const data = allocation.map((entry) => {
    const sizeStr = `${entry.stickerWidth}"\u00d7${entry.stickerHeight}"`;
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
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} />
          <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
          <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, color: "#1e293b" }} />
          <Legend wrapperStyle={{ color: "#64748b" }} />
          <Bar dataKey="order" name="Order Qty" radius={[2, 2, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`order-${index}`} fill={entry.color} fillOpacity={0.35} />
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
