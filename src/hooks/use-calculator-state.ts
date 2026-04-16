"use client";

import { useState, useCallback } from "react";
import type {
  ProjectInput,
  CalculateResponse,
  PlateSuggestion,
} from "@/lib/types";
import { INDUSTRY_PRESETS } from "@/lib/industry-presets";
import { DEFAULT_PROJECTS } from "@/lib/mode-config";

const STICKER_PRESET = INDUSTRY_PRESETS["sticker-printing"];

export function useCalculatorState() {
  const currentPreset = STICKER_PRESET;
  const terms = currentPreset.terms;

  const [sheetWidth, setSheetWidth] = useState(currentPreset.defaults.sheetWidth);
  const [sheetHeight, setSheetHeight] = useState(currentPreset.defaults.sheetHeight);
  const [bleed, setBleed] = useState(currentPreset.defaults.bleed);

  const [projects, setProjects] = useState<ProjectInput[]>(DEFAULT_PROJECTS);

  const [inputOpen, setInputOpen] = useState(true);

  const [result, setResult] = useState<CalculateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [plateSuggestions, setPlateSuggestions] = useState<PlateSuggestion[]>([]);
  const [activeTab, setActiveTab] = useState("two");

  // ── Calculate ──────────────────────────────────────────────────────────

  const handleCalculate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setPlateSuggestions([]);
    try {
      const body = {
        mode: "rect-mixed",
        sheetWidth,
        sheetHeight,
        bleed,
        projects: projects.filter((p) => p.quantity > 0 && p.stickerWidth > 0 && p.stickerHeight > 0),
      };

      const response = await fetch("/api/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data: CalculateResponse = await response.json();
      if (data.error) {
        setError(data.error);
        setPlateSuggestions(data.plateSuggestions || []);
        setErrorModalOpen(true);
      } else {
        setResult(data);
        setPlateSuggestions(data.plateSuggestions || []);
        setInputOpen(false);
        // Auto-select best tab
        if (data.multiPlateResult && !data.twoPlateResult && !data.singlePlateResult) {
          setActiveTab("multi");
        } else if (data.twoPlateResult) {
          setActiveTab("two");
        } else if (data.singlePlateResult) {
          setActiveTab("single");
        }
      }
    } catch {
      setError("Failed to connect to calculation server.");
      setErrorModalOpen(true);
    } finally {
      setLoading(false);
    }
  }, [sheetWidth, sheetHeight, bleed, projects]);

  // ── Project names (for color mapping) ──────────────────────────────────

  const projectNames = result
    ? [...new Set([
        ...(result.singlePlateResult?.allocation || []),
        ...(result.twoPlateResult?.plate1.allocation || []),
        ...(result.twoPlateResult?.plate2.allocation || []),
        ...(result.multiPlateResult?.plates?.flatMap((p: any) => p.allocation) || []),
      ].map((a) => a.name))]
    : projects.map((p) => p.name);

  const bleedInches = bleed / 25.4;

  return {
    // Preset
    currentPreset,
    terms,
    // Sheet params
    sheetWidth,
    setSheetWidth,
    sheetHeight,
    setSheetHeight,
    bleed,
    setBleed,
    bleedInches,
    // Projects
    projects,
    setProjects,
    // UI state
    inputOpen,
    setInputOpen,
    activeTab,
    setActiveTab,
    // Calculation
    result,
    loading,
    error,
    errorModalOpen,
    setErrorModalOpen,
    plateSuggestions,
    handleCalculate,
    // Derived
    projectNames,
  };
}
