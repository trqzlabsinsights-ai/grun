"use client";

import { useCalculatorState } from "@/hooks/use-calculator-state";
import { CalculatorHeader } from "@/components/calculator/calculator-header";
import { IndustrySelector } from "@/components/calculator/industry-selector";
import { InputPanel } from "@/components/calculator/input-panel";
import { ResultsSection } from "@/components/calculator/results-section";

export default function GangRunCalculator() {
  const state = useCalculatorState();

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <CalculatorHeader preset={state.currentPreset} />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Industry Selector */}
        <IndustrySelector
          industry={state.industry}
          onIndustryChange={state.handleIndustryChange}
          currentPreset={state.currentPreset}
        />

        {/* Input Panel */}
        <InputPanel
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
          projects={state.projects}
          setProjects={state.setProjects}
        />

        {/* Results */}
        <ResultsSection
          result={state.result}
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
