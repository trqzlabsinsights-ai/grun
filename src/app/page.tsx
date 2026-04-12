"use client";

import { useCalculatorState } from "@/hooks/use-calculator-state";
import { CalculatorHeader } from "@/components/calculator/calculator-header";
import { IndustrySelector } from "@/components/calculator/industry-selector";
import { ModeSelector } from "@/components/calculator/mode-selector";
import { InputPanel } from "@/components/calculator/input-panel";
import { ResultsSection } from "@/components/calculator/results-section";

// ── Main Page Component ────────────────────────────────────────────────────

export default function GangRunCalculator() {
  const state = useCalculatorState();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <CalculatorHeader preset={state.currentPreset} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Industry Selector */}
        <IndustrySelector
          industry={state.industry}
          onIndustryChange={state.handleIndustryChange}
          currentPreset={state.currentPreset}
        />

        {/* Mode Selector */}
        <ModeSelector
          packMode={state.packMode}
          onModeChange={state.handleModeChange}
        />

        {/* Input Panel */}
        <InputPanel
          packMode={state.packMode}
          terms={state.terms}
          sheetWidth={state.sheetWidth}
          setSheetWidth={state.setSheetWidth}
          sheetHeight={state.sheetHeight}
          setSheetHeight={state.setSheetHeight}
          bleed={state.bleed}
          setBleed={state.setBleed}
          inputOpen={state.inputOpen}
          setInputOpen={state.setInputOpen}
          loading={state.loading}
          onCalculate={state.handleCalculate}
          rectSameProjects={state.rectSameProjects}
          setRectSameProjects={state.setRectSameProjects}
          rectSameW={state.rectSameW}
          setRectSameW={state.setRectSameW}
          rectSameH={state.rectSameH}
          setRectSameH={state.setRectSameH}
          rectMixedProjects={state.rectMixedProjects}
          setRectMixedProjects={state.setRectMixedProjects}
          circleProjects={state.circleProjects}
          setCircleProjects={state.setCircleProjects}
          customProjects={state.customProjects}
          setCustomProjects={state.setCustomProjects}
          customSides={state.customSides}
          setCustomSides={state.setCustomSides}
        />

        {/* Results */}
        <ResultsSection
          result={state.result}
          packMode={state.packMode}
          terms={state.terms}
          sheetWidth={state.sheetWidth}
          sheetHeight={state.sheetHeight}
          bleedInches={state.bleedInches}
          bleed={state.bleed}
          projectNames={state.projectNames}
          activeTab={state.activeTab}
          setActiveTab={state.setActiveTab}
          error={state.error}
          errorModalOpen={state.errorModalOpen}
          setErrorModalOpen={state.setErrorModalOpen}
          plateSuggestions={state.plateSuggestions}
        />
      </main>
    </div>
  );
}
