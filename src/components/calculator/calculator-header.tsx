"use client";

import { LayoutGrid } from "lucide-react";
import type { IndustryPreset } from "@/lib/types";

export function CalculatorHeader({ preset }: { preset: IndustryPreset }) {
  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
        <div className="p-2 bg-cyan-500/10 rounded-lg">
          <LayoutGrid className="w-6 h-6 text-cyan-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-100">{preset.headerTitle}</h1>
          <p className="text-xs text-slate-400">{preset.headerSubtitle}</p>
        </div>
      </div>
    </header>
  );
}
