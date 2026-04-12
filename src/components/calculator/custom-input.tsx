"use client";

import React, { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import type { CustomProjectInput, IndustryTerms } from "@/lib/types";
import { PROJECT_COLORS } from "@/lib/industry-presets";
import { getPolygonIcon, getPolygonName } from "@/lib/packer-custom";

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
  void terms; // reserved for future use

  const addProject = useCallback(() => {
    const nextLetter = String.fromCharCode(97 + projects.length);
    setProjects((prev) => [
      ...prev,
      {
        name: nextLetter,
        stickerWidth: 3,
        stickerHeight: 3,
        sides: 4, // default to diamond
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
          return { ...p, [field]: parseFloat(value) || 0 };
        })
      );
    },
    [setProjects]
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Label className="text-sm font-semibold text-slate-300">
          Polygon Projects
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
        <div className="space-y-2 min-w-[700px]">
          <div className="grid grid-cols-[32px_60px_1fr_1fr_80px_1fr_36px] gap-2 text-xs text-slate-500 font-medium px-1">
            <span></span>
            <span>NAME</span>
            <span>W&times;H (in)</span>
            <span>SIDES</span>
            <span>SHAPE</span>
            <span>QTY</span>
            <span></span>
          </div>
          {projects.map((project, idx) => (
            <div
              key={idx}
              className="grid grid-cols-[32px_60px_1fr_1fr_80px_1fr_36px] gap-2 items-center"
            >
              <div
                className="w-4 h-4 shrink-0 mx-auto flex items-center justify-center text-xs"
                style={{ color: PROJECT_COLORS[idx % PROJECT_COLORS.length] }}
              >
                {getPolygonIcon(project.sides || 4)}
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
              <Input
                type="number"
                min="3"
                max="20"
                value={project.sides || ""}
                onChange={(e) => updateProject(idx, "sides", e.target.value)}
                className="bg-slate-800 border-slate-700 text-slate-100 h-8 text-sm"
                placeholder="Sides"
              />
              <div className="text-xs text-slate-400 truncate" title={getPolygonName(project.sides || 4)}>
                {getPolygonName(project.sides || 4)}
              </div>
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
      <p className="text-xs text-slate-500">
        3=Triangle ▲ &middot; 4=Diamond ◆ &middot; 5=Pentagon &middot; 6=Hexagon ⬡ &middot; 8=Octagon &middot; Tessellation: 3, 4, 6 sides
      </p>
    </div>
  );
}
