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
    <Card className="bg-white border-gray-200 shadow-sm">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Shapes className="w-4 h-4 text-blue-600" />
            <Label className="text-sm font-medium text-gray-700 whitespace-nowrap">Industry</Label>
          </div>
          <Select value={industry} onValueChange={(val) => onIndustryChange(val as IndustryKey)}>
            <SelectTrigger className="bg-white border-gray-300 text-gray-900 w-[260px]">
              <SelectValue placeholder="Select industry" />
            </SelectTrigger>
            <SelectContent className="bg-white border-gray-200">
              {(Object.keys(INDUSTRY_PRESETS) as IndustryKey[]).map((key) => {
                const preset = INDUSTRY_PRESETS[key];
                return (
                  <SelectItem key={key} value={key} className="text-gray-800 focus:bg-blue-50 focus:text-gray-900">
                    <span className="mr-2">{preset.icon}</span>
                    {preset.label}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <span className="text-xs text-gray-400">{currentPreset.description}</span>
        </div>
      </CardContent>
    </Card>
  );
}
