"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Shapes } from "lucide-react";
import type { IndustryKey, IndustryPreset } from "@/lib/types";
import { INDUSTRY_PRESETS } from "@/lib/industry-presets";

interface IndustrySelectorProps {
  industry: IndustryKey;
  onIndustryChange: (industry: IndustryKey) => void;
  currentPreset: IndustryPreset;
}

export function IndustrySelector({ industry, onIndustryChange, currentPreset }: IndustrySelectorProps) {
  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Shapes className="w-4 h-4 text-cyan-400" />
            <Label className="text-sm font-semibold text-slate-300 whitespace-nowrap">Industry</Label>
          </div>
          <Select value={industry} onValueChange={(val) => onIndustryChange(val as IndustryKey)}>
            <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100 w-[260px]">
              <SelectValue placeholder="Select industry" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              {(Object.keys(INDUSTRY_PRESETS) as IndustryKey[]).map((key) => {
                const preset = INDUSTRY_PRESETS[key];
                return (
                  <SelectItem key={key} value={key} className="text-slate-200 focus:bg-slate-700 focus:text-slate-100">
                    <span className="mr-2">{preset.icon}</span>
                    {preset.label}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <span className="text-xs text-slate-500">{currentPreset.description}</span>
        </div>
      </CardContent>
    </Card>
  );
}
