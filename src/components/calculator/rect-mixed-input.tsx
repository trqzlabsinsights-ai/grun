"use client";

import React, { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Ruler } from "lucide-react";
import type { ProjectInput, IndustryTerms } from "@/lib/types";
import { PROJECT_COLORS, capitalize } from "@/lib/industry-presets";

interface RectMixedInputProps {
  projects: ProjectInput[];
  setProjects: React.Dispatch<React.SetStateAction<ProjectInput[]>>;
  terms: IndustryTerms;
}

export function RectMixedInput({
  projects,
  setProjects,
  terms,
}: RectMixedInputProps) {
  const addProject = useCallback(() => {
    const nextLetter = String.fromCharCode(97 + projects.length);
    setProjects((prev) => [
      ...prev,
      { name: nextLetter, quantity: 0, stickerWidth: 3.5, stickerHeight: 4.5 },
    ]);
  }, [projects.length, setProjects]);

  const removeProject = useCallback(
    (index: number) => {
      setProjects((prev) => prev.filter((_, i) => i !== index));
    },
    [setProjects]
  );

  const updateProject = useCallback(
    (index: number, field: keyof ProjectInput, value: string) => {
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

  const fillAllSizes = useCallback(
    (w: number, h: number) => {
      setProjects((prev) => prev.map((p) => ({ ...p, stickerWidth: w, stickerHeight: h })));
    },
    [setProjects]
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Label className="text-sm font-semibold text-slate-300">
          Projects (min 2 {terms.outs} each — no abandoned projects)
        </Label>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fillAllSizes(3.5, 4.5)}
            className="bg-slate-800 border-slate-700 text-slate-300 hover:text-slate-100 hover:bg-slate-700 text-xs"
          >
            <Ruler className="w-3 h-3 mr-1" /> Fill All 3.5&times;4.5
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={addProject}
            className="bg-slate-800 border-slate-700 text-slate-300 hover:text-slate-100 hover:bg-slate-700"
          >
            <Plus className="w-4 h-4 mr-1" /> Add
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="space-y-2 min-w-[600px]">
          <div className="grid grid-cols-[32px_80px_1fr_1fr_1fr_36px] gap-2 text-xs text-slate-500 font-medium px-1">
            <span></span>
            <span>NAME</span>
            <span>
              {capitalize(terms.sticker)} W&times;H (in)
            </span>
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
                min="0"
                value={project.quantity || ""}
                onChange={(e) => updateProject(idx, "quantity", e.target.value)}
                className="bg-slate-800 border-slate-700 text-slate-100 h-8 text-sm"
                placeholder="Order Qty"
              />
              <span></span>
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
