"use client";

import React from "react";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { Calculator, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import type {
  PackMode,
  ProjectInput,
  CircleProjectInput,
  CustomProjectInput,
  IndustryTerms,
} from "@/lib/types";
import { capitalize } from "@/lib/industry-presets";
import { MODE_CONFIG } from "@/lib/mode-config";
import { RectSameInput } from "./rect-same-input";
import { RectMixedInput } from "./rect-mixed-input";
import { CircularInput } from "./circular-input";
import { CustomInput } from "./custom-input";

interface InputPanelProps {
  packMode: PackMode;
  terms: IndustryTerms;
  sheetWidth: number;
  setSheetWidth: (v: number) => void;
  sheetHeight: number;
  setSheetHeight: (v: number) => void;
  bleed: number;
  setBleed: (v: number) => void;
  inputOpen: boolean;
  setInputOpen: (v: boolean) => void;
  loading: boolean;
  onCalculate: () => void;
  // rect-same
  rectSameProjects: ProjectInput[];
  setRectSameProjects: React.Dispatch<React.SetStateAction<ProjectInput[]>>;
  rectSameW: number;
  setRectSameW: React.Dispatch<React.SetStateAction<number>>;
  rectSameH: number;
  setRectSameH: React.Dispatch<React.SetStateAction<number>>;
  // rect-mixed
  rectMixedProjects: ProjectInput[];
  setRectMixedProjects: React.Dispatch<React.SetStateAction<ProjectInput[]>>;
  // circular
  circleProjects: CircleProjectInput[];
  setCircleProjects: React.Dispatch<React.SetStateAction<CircleProjectInput[]>>;
  // custom
  customProjects: CustomProjectInput[];
  setCustomProjects: React.Dispatch<React.SetStateAction<CustomProjectInput[]>>;
}

export function InputPanel({
  packMode,
  terms,
  sheetWidth,
  setSheetWidth,
  sheetHeight,
  setSheetHeight,
  bleed,
  setBleed,
  inputOpen,
  setInputOpen,
  loading,
  onCalculate,
  rectSameProjects,
  setRectSameProjects,
  rectSameW,
  setRectSameW,
  rectSameH,
  setRectSameH,
  rectMixedProjects,
  setRectMixedProjects,
  circleProjects,
  setCircleProjects,
  customProjects,
  setCustomProjects,
}: InputPanelProps) {
  const modeDescription = terms ? MODE_CONFIG[packMode]?.desc || "" : "";

  return (
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
                  {modeDescription}
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
                <Label className="text-sm font-semibold text-slate-300">{capitalize(terms.sheet)} (inches)</Label>
                <div className="flex items-center gap-2">
                  <Input type="number" step="0.1" min="1" value={sheetWidth} onChange={(e) => setSheetWidth(parseFloat(e.target.value) || 0)} className="bg-slate-800 border-slate-700 text-slate-100" placeholder="W" />
                  <span className="text-slate-500">&times;</span>
                  <Input type="number" step="0.1" min="1" value={sheetHeight} onChange={(e) => setSheetHeight(parseFloat(e.target.value) || 0)} className="bg-slate-800 border-slate-700 text-slate-100" placeholder="H" />
                </div>
              </div>
              {terms.bleed !== "\u2014" ? (
                <div className="space-y-3">
                  <Label className="text-sm font-semibold text-slate-300">{capitalize(terms.bleed)} (mm per side, per group)</Label>
                  <Input type="number" step="0.5" min="0" value={bleed} onChange={(e) => setBleed(parseFloat(e.target.value) || 0)} className="bg-slate-800 border-slate-700 text-slate-100" />
                </div>
              ) : (
                <div />
              )}
            </div>

            <Separator className="bg-slate-700/50" />

            {/* Mode-specific inputs */}
            {packMode === "rect-same" && (
              <RectSameInput
                projects={rectSameProjects}
                setProjects={setRectSameProjects}
                rectSameW={rectSameW}
                setRectSameW={setRectSameW}
                rectSameH={rectSameH}
                setRectSameH={setRectSameH}
                terms={terms}
              />
            )}

            {packMode === "rect-mixed" && (
              <RectMixedInput
                projects={rectMixedProjects}
                setProjects={setRectMixedProjects}
                terms={terms}
              />
            )}

            {packMode === "circular" && (
              <CircularInput
                projects={circleProjects}
                setProjects={setCircleProjects}
                terms={terms}
              />
            )}

            {packMode === "custom" && (
              <CustomInput
                projects={customProjects}
                setProjects={setCustomProjects}
                terms={terms}
              />
            )}

            <div className="flex items-center gap-4 pt-2">
              <Button onClick={onCalculate} disabled={loading} className="bg-cyan-600 hover:bg-cyan-500 text-white font-semibold px-8" size="lg">
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
  );
}
