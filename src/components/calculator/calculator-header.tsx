"use client";

import { LayoutGrid } from "lucide-react";
import type { IndustryPreset } from "@/lib/types";

export function CalculatorHeader({ preset }: { preset: IndustryPreset }) {
  return (
    <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/" className="p-2 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
            <LayoutGrid className="w-6 h-6 text-blue-600" />
          </a>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{preset.headerTitle}</h1>
            <p className="text-xs text-gray-500">{preset.headerSubtitle}</p>
          </div>
        </div>
        <div className="hidden sm:flex text-sm text-gray-500 gap-4">
          <a href="/docs" className="hover:text-blue-600 transition-colors">Documentation</a>
          <a href="/support" className="hover:text-blue-600 transition-colors">Support</a>
        </div>
      </div>
    </header>
  );
}
