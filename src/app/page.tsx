"use client";

import { useCalculatorState } from "@/hooks/use-calculator-state";
import { CalculatorHeader } from "@/components/calculator/calculator-header";
import { InputPanel } from "@/components/calculator/input-panel";
import { ResultsSection } from "@/components/calculator/results-section";
import { LayoutGrid } from "lucide-react";

export default function GangRunCalculator() {
  const state = useCalculatorState();

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col">
      <CalculatorHeader preset={state.currentPreset} />

      <main className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6 flex-grow">
        {/* Hero / Narrative Section */}
        <section className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-6 sm:p-8 relative overflow-hidden">
          <div className="relative z-10 max-w-2xl">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Maximize Print Yield. Minimize Waste.</h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              Welcome to your smart pre-press assistant. Enter your master sheet dimensions, configure your bleed allowances, and input your individual projects below. Our proprietary algorithm will automatically calculate the most efficient layout to save you time and material costs.
            </p>
          </div>
          <svg
            className="absolute right-0 top-0 text-blue-200 opacity-30 w-64 h-64 -mt-12 -mr-12 pointer-events-none"
            viewBox="0 0 200 200"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fill="currentColor"
              d="M45.7,-76.4C58.8,-69.3,68.9,-55.5,76.5,-40.7C84.1,-25.9,89.2,-10,87.6,5.3C86,20.6,77.7,35.3,66.8,47.1C55.9,58.9,42.4,67.8,27.5,74.1C12.6,80.4,-3.7,84,-19.7,81.4C-35.7,78.8,-51.4,69.9,-63.3,57.1C-75.2,44.3,-83.3,27.6,-85.8,10.2C-88.3,-7.2,-85.2,-25.3,-75.6,-40.1C-66,-54.9,-49.9,-66.4,-34,-72.6C-18.1,-78.8,-0.4,-79.7,16,-78.1C32.4,-76.5,45.7,-76.4,45.7,-76.4Z"
              transform="translate(100 100)"
            />
          </svg>
        </section>

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

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-8 mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-[18px] h-[18px] text-blue-500" />
            <span className="font-semibold text-gray-700">GangRun</span>
          </div>
          <p>&copy; 2026 GangRun Plate Optimization. All rights reserved.</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-blue-600 transition-colors">Privacy</a>
            <a href="#" className="hover:text-blue-600 transition-colors">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
