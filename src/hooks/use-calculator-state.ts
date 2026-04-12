"use client";

import { useState, useCallback } from "react";
import type {
  PackMode,
  IndustryKey,
  ProjectInput,
  CircleProjectInput,
  CustomProjectInput,
  CalculateResponse,
  PlateSuggestion,
} from "@/lib/types";
import { INDUSTRY_PRESETS } from "@/lib/industry-presets";
import {
  DEFAULT_RECT_SAME_PROJECTS,
  DEFAULT_RECT_MIXED_PROJECTS,
  DEFAULT_CIRCLE_PROJECTS,
  DEFAULT_CUSTOM_PROJECTS,
} from "@/lib/mode-config";

export function useCalculatorState() {
  const [industry, setIndustry] = useState<IndustryKey>("sticker-printing");
  const currentPreset = INDUSTRY_PRESETS[industry];
  const terms = currentPreset.terms;

  const [packMode, setPackMode] = useState<PackMode>("rect-mixed");
  const [sheetWidth, setSheetWidth] = useState(currentPreset.defaults.sheetWidth);
  const [sheetHeight, setSheetHeight] = useState(currentPreset.defaults.sheetHeight);
  const [bleed, setBleed] = useState(currentPreset.defaults.bleed);

  // Per-mode project state
  const [rectSameProjects, setRectSameProjects] = useState<ProjectInput[]>(DEFAULT_RECT_SAME_PROJECTS);
  const [rectSameW, setRectSameW] = useState(3.5);
  const [rectSameH, setRectSameH] = useState(4.5);
  const [rectMixedProjects, setRectMixedProjects] = useState<ProjectInput[]>(DEFAULT_RECT_MIXED_PROJECTS);
  const [circleProjects, setCircleProjects] = useState<CircleProjectInput[]>(DEFAULT_CIRCLE_PROJECTS);
  const [customProjects, setCustomProjects] = useState<CustomProjectInput[]>(DEFAULT_CUSTOM_PROJECTS);
  const [customSides, setCustomSides] = useState(5); // default to Pentagon

  const [inputOpen, setInputOpen] = useState(true);

  const [result, setResult] = useState<CalculateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [plateSuggestions, setPlateSuggestions] = useState<PlateSuggestion[]>([]);
  const [activeTab, setActiveTab] = useState("two");

  // ── Industry change handler ──────────────────────────────────────────────

  const handleIndustryChange = useCallback((newIndustry: IndustryKey) => {
    const preset = INDUSTRY_PRESETS[newIndustry];
    setIndustry(newIndustry);
    setSheetWidth(preset.defaults.sheetWidth);
    setSheetHeight(preset.defaults.sheetHeight);
    setBleed(preset.defaults.bleed);
    setResult(null);
    setError(null);
    setPlateSuggestions([]);
  }, []);

  // ── Mode change handler ─────────────────────────────────────────────────

  const handleModeChange = useCallback((mode: PackMode) => {
    setPackMode(mode);
    setResult(null);
    setError(null);
    setPlateSuggestions([]);
  }, []);

  // ── Calculate ──────────────────────────────────────────────────────────

  const handleCalculate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setPlateSuggestions([]);
    try {
      let body: Record<string, unknown> = { mode: packMode, sheetWidth, sheetHeight, bleed };

      switch (packMode) {
        case "rect-same":
          body.stickerWidth = rectSameW;
          body.stickerHeight = rectSameH;
          body.projects = rectSameProjects.filter((p) => p.quantity > 0);
          break;
        case "rect-mixed":
          body.projects = rectMixedProjects.filter((p) => p.quantity > 0 && p.stickerWidth > 0 && p.stickerHeight > 0);
          break;
        case "circular":
          body.projects = circleProjects.filter((p) => p.quantity > 0 && p.diameter > 0);
          break;
        case "custom":
          body.projects = customProjects.filter((p) => p.quantity > 0 && p.stickerWidth > 0 && p.stickerHeight > 0);
          body.sides = customSides;
          break;
      }

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
      }
    } catch {
      setError("Failed to connect to calculation server.");
      setErrorModalOpen(true);
    } finally {
      setLoading(false);
    }
  }, [packMode, sheetWidth, sheetHeight, bleed, rectSameW, rectSameH, rectSameProjects, rectMixedProjects, circleProjects, customProjects, customSides]);

  // ── Project names (for color mapping) ──────────────────────────────────

  const projectNames = result
    ? [...new Set([
        ...(result.singlePlateResult?.allocation || []),
        ...(result.twoPlateResult?.plate1.allocation || []),
        ...(result.twoPlateResult?.plate2.allocation || []),
      ].map((a) => a.name))]
    : (() => {
        switch (packMode) {
          case "rect-same": return rectSameProjects.map((p) => p.name);
          case "rect-mixed": return rectMixedProjects.map((p) => p.name);
          case "circular": return circleProjects.map((p) => p.name);
          case "custom": return customProjects.map((p) => p.name);
        }
      })();

  const bleedInches = bleed / 25.4;

  return {
    // Industry
    industry,
    currentPreset,
    terms,
    handleIndustryChange,
    // Mode
    packMode,
    handleModeChange,
    // Sheet params
    sheetWidth,
    setSheetWidth,
    sheetHeight,
    setSheetHeight,
    bleed,
    setBleed,
    bleedInches,
    // Projects
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
    customSides,
    setCustomSides,
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
