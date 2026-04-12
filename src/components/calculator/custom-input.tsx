"use client";

import React, { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import type { CustomProjectInput, IndustryTerms } from "@/lib/types";
import { PROJECT_COLORS } from "@/lib/industry-presets";
import { PRESET_SHAPES } from "@/lib/packer-custom";

interface CustomInputProps {
  projects: CustomProjectInput[];
  setProjects: React.Dispatch<React.SetStateAction<CustomProjectInput[]>>;
  terms: IndustryTerms;
}

export function CustomInput({
  projects,
  setProjects,
  terms,
}: CustomInputProps) {
  // Unused terms reference for future extensions (e.g., labels)
  void terms;

  const addProject = useCallback(() => {
    const nextLetter = String.fromCharCode(97 + projects.length);
    setProjects((prev) => [
      ...prev,
      {
        name: nextLetter,
        stickerWidth: 3,
        stickerHeight: 3,
        shapeName: "triangle",
        vertices: PRESET_SHAPES.triangle.vertices,
        quantity: 0,
      },
    ]);
  }, [projects.length, setProjects]);

  const removeProject = useCallback(
    (index: number) => {
      setProjects((prev) => prev.filter((_, i) => i !== index));
    },
    [setProjects]
  );

  const updateProject = useCallback(
    (index: number, field: keyof CustomProjectInput, value: string) => {
      setProjects((prev) =>
        prev.map((p, i) => {
          if (i !== index) return p;
          if (field === "name") return { ...p, name: value };
          if (field === "shapeName") {
            const preset = PRESET_SHAPES[value];
            return { ...p, shapeName: value, vertices: preset ? preset.vertices : p.vertices };
          }
          return { ...p, [field]: parseFloat(value) || 0 };
        })
      );
    },
    [setProjects]
  );

  const updateCustomShape = useCallback(
    (index: number, shapeName: string) => {
      setProjects((prev) =>
        prev.map((p, i) => {
          if (i !== index) return p;
          const preset = PRESET_SHAPES[shapeName];
          return { ...p, shapeName, vertices: preset ? preset.vertices : p.vertices };
        })
      );
    },
    [setProjects]
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Label className="text-sm font-semibold text-slate-300">
          Custom Shape Projects
        </Label>
        <Button
          variant="outline"
          size="sm"
          onClick={addProject}
          className="bg-slate-800 border-slate-700 text-slate-300 hover:text-slate-100 hover:bg-slate-700"
        >
          <Plus className="w-4 h-4 mr-1" /> Add
        </Button>
      </div>
      <div className="overflow-x-auto">
        <div className="space-y-2 min-w-[750px]">
          <div className="grid grid-cols-[32px_60px_1fr_1fr_1fr_36px] gap-2 text-xs text-slate-500 font-medium px-1">
            <span></span>
            <span>NAME</span>
            <span>W&times;H (in)</span>
            <span>SHAPE</span>
            <span>QTY</span>
            <span></span>
          </div>
          {projects.map((project, idx) => (
            <div
              key={idx}
              className="grid grid-cols-[32px_60px_1fr_1fr_1fr_36px] gap-2 items-center"
            >
              <div
                className="w-4 h-4 shrink-0 mx-auto flex items-center justify-center text-xs"
                style={{ color: PROJECT_COLORS[idx % PROJECT_COLORS.length] }}
              >
                {PRESET_SHAPES[project.shapeName]?.icon || "\u25C6"}
              </div>
              <Input
                value={project.name}
                onChange={(e) => updateProject(idx, "name", e.target.value)}
                className="bg-slate-800 border-slate-700 text-slate-100 h-8 text-sm"
                placeholder="Name"
              />
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={project.stickerWidth || ""}
                  onChange={(e) => updateProject(idx, "stickerWidth", e.target.value)}
                  className="bg-slate-800 border-slate-700 text-slate-100 h-8 text-sm"
                  placeholder="W"
                />
                <span className="text-slate-500 text-xs">&times;</span>
                <Input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={project.stickerHeight || ""}
                  onChange={(e) => updateProject(idx, "stickerHeight", e.target.value)}
                  className="bg-slate-800 border-slate-700 text-slate-100 h-8 text-sm"
                  placeholder="H"
                />
              </div>
              <Select
                value={project.shapeName}
                onValueChange={(val) => updateCustomShape(idx, val)}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100 h-8 text-sm">
                  <SelectValue placeholder="Shape" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {Object.entries(PRESET_SHAPES).map(([key, shape]) => (
                    <SelectItem
                      key={key}
                      value={key}
                      className="text-slate-200 focus:bg-slate-700 focus:text-slate-100"
                    >
                      <span className="mr-1.5">{shape.icon}</span>
                      {shape.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                min="0"
                value={project.quantity || ""}
                onChange={(e) => updateProject(idx, "quantity", e.target.value)}
                className="bg-slate-800 border-slate-700 text-slate-100 h-8 text-sm"
                placeholder="Qty"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeProject(idx)}
                className="text-slate-500 hover:text-red-400 hover:bg-red-400/10 shrink-0 h-8 w-8 p-0"
                disabled={projects.length <= 1}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
