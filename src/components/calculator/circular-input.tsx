"use client";

import React, { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import type { CircleProjectInput, IndustryTerms } from "@/lib/types";
import { PROJECT_COLORS } from "@/lib/industry-presets";

interface CircularInputProps {
  projects: CircleProjectInput[];
  setProjects: React.Dispatch<React.SetStateAction<CircleProjectInput[]>>;
  terms: IndustryTerms;
}

export function CircularInput({
  projects,
  setProjects,
  terms,
}: CircularInputProps) {
  const addProject = useCallback(() => {
    const nextLetter = String.fromCharCode(97 + projects.length);
    setProjects((prev) => [
      ...prev,
      { name: nextLetter, diameter: 3, quantity: 0 },
    ]);
  }, [projects.length, setProjects]);

  const removeProject = useCallback(
    (index: number) => {
      setProjects((prev) => prev.filter((_, i) => i !== index));
    },
    [setProjects]
  );

  const updateProject = useCallback(
    (index: number, field: keyof CircleProjectInput, value: string) => {
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
          Circle Projects (hexagonal packing)
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
        <div className="space-y-2 min-w-[500px]">
          <div className="grid grid-cols-[32px_80px_1fr_1fr_36px] gap-2 text-xs text-slate-500 font-medium px-1">
            <span></span>
            <span>NAME</span>
            <span>DIAMETER (in)</span>
            <span>QUANTITY</span>
            <span></span>
          </div>
          {projects.map((project, idx) => (
            <div
              key={idx}
              className="grid grid-cols-[32px_80px_1fr_1fr_36px] gap-2 items-center"
            >
              <div
                className="w-4 h-4 rounded-full shrink-0 mx-auto"
                style={{ backgroundColor: PROJECT_COLORS[idx % PROJECT_COLORS.length] }}
              />
              <Input
                value={project.name}
                onChange={(e) => updateProject(idx, "name", e.target.value)}
                className="bg-slate-800 border-slate-700 text-slate-100 h-8 text-sm"
                placeholder="Name"
              />
              <Input
                type="number"
                step="0.1"
                min="0.1"
                value={project.diameter || ""}
                onChange={(e) => updateProject(idx, "diameter", e.target.value)}
                className="bg-slate-800 border-slate-700 text-slate-100 h-8 text-sm"
                placeholder="Diameter"
              />
              <Input
                type="number"
                min="0"
                value={project.quantity || ""}
                onChange={(e) => updateProject(idx, "quantity", e.target.value)}
                className="bg-slate-800 border-slate-700 text-slate-100 h-8 text-sm"
                placeholder="Order Qty"
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
