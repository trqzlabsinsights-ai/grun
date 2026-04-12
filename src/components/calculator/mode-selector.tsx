"use client";

import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Shapes } from "lucide-react";
import type { PackMode } from "@/lib/types";
import { MODE_CONFIG } from "@/lib/mode-config";

interface ModeSelectorProps {
  packMode: PackMode;
  onModeChange: (mode: PackMode) => void;
}

export function ModeSelector({ packMode, onModeChange }: ModeSelectorProps) {
  return (
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
                onClick={() => onModeChange(mode)}
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
  );
}
