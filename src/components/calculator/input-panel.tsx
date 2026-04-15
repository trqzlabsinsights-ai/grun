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
import { Calculator, ChevronDown, ChevronUp, Loader2, Plus, Trash2, Ruler } from "lucide-react";
import type { ProjectInput, IndustryTerms } from "@/lib/types";
import { capitalize, PROJECT_COLORS } from "@/lib/industry-presets";

interface InputPanelProps {
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
  projects: ProjectInput[];
  setProjects: React.Dispatch<React.SetStateAction<ProjectInput[]>>;
}

export function InputPanel({
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
  projects,
  setProjects,
}: InputPanelProps) {

  const addProject = () => {
    const nextLetter = String.fromCharCode(97 + projects.length);
    setProjects((prev) => [
      ...prev,
      { name: nextLetter, quantity: 0, stickerWidth: 3.5, stickerHeight: 4.5 },
    ]);
  };

  const removeProject = (index: number) => {
    setProjects((prev) => prev.filter((_, i) => i !== index));
  };

  const updateProject = (index: number, field: keyof ProjectInput, value: string) => {
    setProjects((prev) =>
      prev.map((p, i) => {
        if (i !== index) return p;
        if (field === "name") return { ...p, name: value };
        return { ...p, [field]: parseFloat(value) || 0 };
      })
    );
  };

  const fillAllSizes = (w: number, h: number) => {
    setProjects((prev) => prev.map((p) => ({ ...p, stickerWidth: w, stickerHeight: h })));
  };

  return (
    <Collapsible open={inputOpen} onOpenChange={setInputOpen}>
      <Card className="bg-white border-gray-200 shadow-sm">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors rounded-t-lg">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-gray-900 flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-blue-600" />
                  Input Parameters
                </CardTitle>
                <CardDescription className="text-gray-500">
                  Enter sheet dimensions, bleed, and project details
                </CardDescription>
              </div>
              {inputOpen ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-6">
            {/* Sheet dimensions and bleed */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">{capitalize(terms.sheet)} Size (inches)</Label>
                <div className="flex items-center gap-2">
                  <Input type="number" step="0.1" min="1" value={sheetWidth} onChange={(e) => setSheetWidth(parseFloat(e.target.value) || 0)} className="bg-white border-gray-300 text-gray-900" placeholder="W" />
                  <span className="text-gray-400">&times;</span>
                  <Input type="number" step="0.1" min="1" value={sheetHeight} onChange={(e) => setSheetHeight(parseFloat(e.target.value) || 0)} className="bg-white border-gray-300 text-gray-900" placeholder="H" />
                </div>
              </div>
              {terms.bleed !== "\u2014" ? (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">{capitalize(terms.bleed)} (mm per side, per group)</Label>
                  <Input type="number" step="0.5" min="0" value={bleed} onChange={(e) => setBleed(parseFloat(e.target.value) || 0)} className="bg-white border-gray-300 text-gray-900" />
                </div>
              ) : (
                <div />
              )}
            </div>

            <Separator className="bg-gray-200" />

            {/* Project list */}
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <Label className="text-sm font-medium text-gray-700">
                  Projects (min 2 {terms.outs} each)
                </Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fillAllSizes(3.5, 4.5)}
                    className="bg-white border-gray-300 text-gray-600 hover:text-gray-900 hover:bg-gray-50 text-xs"
                  >
                    <Ruler className="w-3 h-3 mr-1" /> Fill All 3.5&times;4.5
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addProject}
                    className="bg-white border-gray-300 text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  >
                    <Plus className="w-4 h-4 mr-1" /> Add
                  </Button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <div className="space-y-2 min-w-[600px]">
                  <div className="grid grid-cols-[32px_80px_1fr_1fr_1fr_36px] gap-2 text-xs text-gray-400 font-medium px-1">
                    <span></span>
                    <span>NAME</span>
                    <span>{capitalize(terms.sticker)} W&times;H (in)</span>
                    <span>QUANTITY</span>
                    <span></span>
                    <span></span>
                  </div>
                  {projects.map((project, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-[32px_80px_1fr_1fr_1fr_36px] gap-2 items-center"
                    >
                      <div
                        className="w-4 h-4 rounded-sm shrink-0 mx-auto"
                        style={{ backgroundColor: PROJECT_COLORS[idx % PROJECT_COLORS.length] }}
                      />
                      <Input
                        value={project.name}
                        onChange={(e) => updateProject(idx, "name", e.target.value)}
                        className="bg-white border-gray-300 text-gray-900 h-8 text-sm"
                        placeholder="Name"
                      />
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          step="0.1"
                          min="0.1"
                          value={project.stickerWidth || ""}
                          onChange={(e) => updateProject(idx, "stickerWidth", e.target.value)}
                          className="bg-white border-gray-300 text-gray-900 h-8 text-sm"
                          placeholder="W"
                        />
                        <span className="text-gray-400 text-xs">&times;</span>
                        <Input
                          type="number"
                          step="0.1"
                          min="0.1"
                          value={project.stickerHeight || ""}
                          onChange={(e) => updateProject(idx, "stickerHeight", e.target.value)}
                          className="bg-white border-gray-300 text-gray-900 h-8 text-sm"
                          placeholder="H"
                        />
                      </div>
                      <Input
                        type="number"
                        min="0"
                        value={project.quantity || ""}
                        onChange={(e) => updateProject(idx, "quantity", e.target.value)}
                        className="bg-white border-gray-300 text-gray-900 h-8 text-sm"
                        placeholder="Order Qty"
                      />
                      <span></span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeProject(idx)}
                        className="text-gray-400 hover:text-red-500 hover:bg-red-50 shrink-0 h-8 w-8 p-0"
                        disabled={projects.length <= 1}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Calculate button */}
            <div className="flex items-center gap-4 pt-2">
              <Button onClick={onCalculate} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8" size="lg">
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Optimizing...</> : <><Calculator className="w-4 h-4 mr-2" /> Calculate</>}
              </Button>
              {loading && <span className="text-sm text-gray-500">Exhaustive search with MaxRect packing...</span>}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
