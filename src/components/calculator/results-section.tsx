"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Layers, LayoutGrid, AlertTriangle, Info } from "lucide-react";
import type {
  PackMode,
  CalculateResponse,
  PlateSuggestion,
  IndustryTerms,
} from "@/lib/types";
import { PROJECT_COLORS, capitalize } from "@/lib/industry-presets";
import { MODE_CONFIG } from "@/lib/mode-config";
import { KPICard } from "./kpi-card";
import { AllocationTable } from "./allocation-table";
import { SVGPlateVisualization } from "./svg-plate-visualization";
import { ProductionBarChart } from "./production-bar-chart";
import { ErrorModal } from "./error-modal";

interface ResultsSectionProps {
  result: CalculateResponse | null;
  packMode: PackMode;
  terms: IndustryTerms;
  sheetWidth: number;
  sheetHeight: number;
  bleedInches: number;
  bleed: number;
  projectNames: string[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
  error: string | null;
  errorModalOpen: boolean;
  setErrorModalOpen: (open: boolean) => void;
  plateSuggestions: PlateSuggestion[];
}

export function ResultsSection({
  result,
  packMode,
  terms,
  sheetWidth,
  sheetHeight,
  bleedInches,
  bleed,
  projectNames,
  activeTab,
  setActiveTab,
  error,
  errorModalOpen,
  setErrorModalOpen,
  plateSuggestions,
}: ResultsSectionProps) {
  return (
    <>
      {/* Error Modal */}
      <ErrorModal
        open={errorModalOpen}
        onOpenChange={(open) => {
          setErrorModalOpen(open);
        }}
        error={error}
        plateSuggestions={plateSuggestions}
        terms={terms}
      />

      {/* Results */}
      {result && (
        <>
          {/* Sheet Capacity */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-slate-100 flex items-center gap-2">
                <LayoutGrid className="w-5 h-5 text-emerald-400" />
                {capitalize(terms.sheet)} Capacity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <KPICard label={`${capitalize(terms.sheet)} Size`} value={`${sheetWidth}" \u00d7 ${sheetHeight}"`} accent="text-emerald-400" />
                <KPICard label="Mode" value={MODE_CONFIG[packMode].label} sub={MODE_CONFIG[packMode].desc} accent="text-emerald-400" />
                <KPICard label={terms.bleed !== "\u2014" ? `${capitalize(terms.bleed)} Per Side` : "Bleed"} value={terms.bleed !== "\u2014" ? `${bleed}mm` : "0mm"} sub={bleed > 0 ? `${bleedInches.toFixed(4)}"` : undefined} accent="text-amber-400" />
                <KPICard label="Algorithm" value={packMode === "circular" ? "HexPack" : "MaxRect"} sub={packMode === "circular" ? "Hexagonal packing" : "2D bin packing"} accent="text-slate-300" />
              </div>
            </CardContent>
          </Card>

          {/* Plate Suggestions */}
          {plateSuggestions.length > 0 && (
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-slate-100 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-amber-400" />
                  {capitalize(terms.plate)} Suggestions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {plateSuggestions.map((s) => (
                    <div
                      key={s.plateCount}
                      className={`rounded-lg px-4 py-3 text-center border ${
                        s.feasible
                          ? "bg-emerald-950/30 border-emerald-800/40"
                          : "bg-slate-800/30 border-slate-700/30"
                      }`}
                    >
                      <div className={`text-2xl font-bold ${s.feasible ? "text-emerald-400" : "text-slate-600"}`}>
                        {s.plateCount}
                      </div>
                      <div className={`text-xs ${s.feasible ? "text-emerald-300" : "text-slate-500"}`}>
                        {s.plateCount === 1 ? terms.plate : `${terms.plate}s`}
                      </div>
                      <div className={`text-xs mt-1 ${s.feasible ? "text-emerald-400" : "text-slate-500"}`}>
                        {s.feasible ? `${s.totalSheets.toLocaleString()} ${terms.sheet}s` : "Cannot fit"}
                      </div>
                      {s.feasible && s.description && (
                        <div className="text-[10px] text-slate-500 mt-1">{s.description}</div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Results Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-slate-800 border border-slate-700">
              <TabsTrigger value="single" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white">
                <Layers className="w-4 h-4 mr-1" /> Single {capitalize(terms.plate)}
              </TabsTrigger>
              <TabsTrigger value="two" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white">
                <Layers className="w-4 h-4 mr-1" /> Two {capitalize(terms.plate)}
              </TabsTrigger>
            </TabsList>

            {/* Single Plate Tab */}
            <TabsContent value="single" className="space-y-6 mt-4">
              {result.singlePlateResult ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <KPICard label="Run Length" value={result.singlePlateResult.runLength.toLocaleString()} accent="text-cyan-400" />
                    <KPICard label={`Total ${capitalize(terms.sheet)}s`} value={result.singlePlateResult.totalSheets.toLocaleString()} accent="text-cyan-400" />
                    <KPICard label="Total Produced" value={result.singlePlateResult.totalProduced.toLocaleString()} sub={`${capitalize(terms.overage)}: +${result.singlePlateResult.totalOverage.toLocaleString()}`} accent="text-slate-200" />
                    <KPICard label="Material Yield" value={`${result.singlePlateResult.materialYield.toFixed(1)}%`} accent="text-emerald-400" />
                  </div>

                  <Card className="bg-slate-900 border-slate-800">
                    <CardHeader><CardTitle className="text-slate-100 text-base">Slot Allocation</CardTitle></CardHeader>
                    <CardContent>
                      <AllocationTable allocation={result.singlePlateResult.allocation} projectColors={PROJECT_COLORS} projectNames={projectNames} packMode={packMode} terms={terms} />
                    </CardContent>
                  </Card>

                  <Card className="bg-slate-900 border-slate-800">
                    <CardContent className="pt-6">
                      <SVGPlateVisualization
                        plateResult={result.singlePlateResult}
                        sheetWidth={sheetWidth}
                        sheetHeight={sheetHeight}
                        bleedInches={bleedInches}
                        projectColors={PROJECT_COLORS}
                        projectNames={projectNames}
                        title={`Single ${capitalize(terms.plate)} Layout`}
                        plateLabel="single"
                        packMode={packMode}
                        terms={terms}
                        bleedMm={bleed}
                      />
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card className="bg-slate-900 border-slate-800">
                  <CardContent className="py-8 text-center text-slate-400">
                    <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-amber-400" />
                    <p>Cannot fit all projects on one {terms.plate} with group constraints (min 2 {terms.outs} each).</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Two Plate Tab */}
            <TabsContent value="two" className="space-y-6 mt-4">
              {result.twoPlateResult ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <KPICard label={`Total ${capitalize(terms.sheet)}s`} value={result.twoPlateResult.totalSheets.toLocaleString()} sub={`P1: ${result.twoPlateResult.plate1.runLength.toLocaleString()} | P2: ${result.twoPlateResult.plate2.runLength.toLocaleString()}`} accent="text-amber-400" />
                    <KPICard label="Total Produced" value={result.twoPlateResult.totalProduced.toLocaleString()} sub={`${capitalize(terms.overage)}: +${result.twoPlateResult.totalOverage.toLocaleString()}`} accent="text-slate-200" />
                    <KPICard label="Material Yield" value={`${result.twoPlateResult.materialYield.toFixed(1)}%`} accent="text-emerald-400" />
                    <KPICard label={`${capitalize(terms.sheet)}s Saved`} value={result.twoPlateResult.sheetsSaved > 0 ? `-${result.twoPlateResult.sheetsSaved}` : `+${Math.abs(result.twoPlateResult.sheetsSaved)}`} sub={result.twoPlateResult.sheetsSaved > 0 ? `vs single ${terms.plate}` : `more than single`} accent={result.twoPlateResult.sheetsSaved > 0 ? "text-emerald-400" : "text-red-400"} />
                  </div>

                  {/* Cost info */}
                  <Card className="bg-slate-800/50 border-amber-700/30">
                    <CardContent className="py-4">
                      <div className="flex items-start gap-3">
                        <Info className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
                        <div className="text-sm text-slate-300">
                          {result.twoPlateResult.sheetsSaved > 0 ? (
                            <>
                              Two {terms.plate}s <span className="text-emerald-400 font-semibold">save {result.twoPlateResult.sheetsSaved.toLocaleString()} {terms.sheet}s</span> but cost{" "}
                              <span className="text-amber-400 font-semibold">1 extra {terms.plate} set + setup</span>. Evaluate if material savings outweigh the additional {terms.plate} cost.
                            </>
                          ) : (
                            <>Two {terms.plate}s do not save {terms.sheet}s for this configuration.</>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Plate 1 */}
                  <Card className="bg-slate-900 border-slate-800">
                    <CardHeader>
                      <CardTitle className="text-slate-100 text-base flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm bg-cyan-500" />
                        {capitalize(terms.plate)} 1 — {result.twoPlateResult.plate1.runLength.toLocaleString()} {terms.sheet}s
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <AllocationTable allocation={result.twoPlateResult.plate1.allocation} projectColors={PROJECT_COLORS} projectNames={projectNames} packMode={packMode} terms={terms} />
                      <SVGPlateVisualization
                        plateResult={result.twoPlateResult.plate1}
                        sheetWidth={sheetWidth}
                        sheetHeight={sheetHeight}
                        bleedInches={bleedInches}
                        projectColors={PROJECT_COLORS}
                        projectNames={projectNames}
                        title={`${capitalize(terms.plate)} 1 — ${result.twoPlateResult.plate1.runLength.toLocaleString()} ${terms.sheet}s`}
                        plateLabel="plate1"
                        packMode={packMode}
                        terms={terms}
                        bleedMm={bleed}
                      />
                    </CardContent>
                  </Card>

                  {/* Plate 2 */}
                  <Card className="bg-slate-900 border-slate-800">
                    <CardHeader>
                      <CardTitle className="text-slate-100 text-base flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm bg-amber-500" />
                        {capitalize(terms.plate)} 2 — {result.twoPlateResult.plate2.runLength.toLocaleString()} {terms.sheet}s
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <AllocationTable allocation={result.twoPlateResult.plate2.allocation} projectColors={PROJECT_COLORS} projectNames={projectNames} packMode={packMode} terms={terms} />
                      <SVGPlateVisualization
                        plateResult={result.twoPlateResult.plate2}
                        sheetWidth={sheetWidth}
                        sheetHeight={sheetHeight}
                        bleedInches={bleedInches}
                        projectColors={PROJECT_COLORS}
                        projectNames={projectNames}
                        title={`${capitalize(terms.plate)} 2 — ${result.twoPlateResult.plate2.runLength.toLocaleString()} ${terms.sheet}s`}
                        plateLabel="plate2"
                        packMode={packMode}
                        terms={terms}
                        bleedMm={bleed}
                      />
                    </CardContent>
                  </Card>

                  {/* Combined summary */}
                  <Card className="bg-slate-900 border-slate-800">
                    <CardHeader>
                      <CardTitle className="text-slate-100 text-base">Combined Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ProductionBarChart
                        allocation={[
                          ...result.twoPlateResult.plate1.allocation,
                          ...result.twoPlateResult.plate2.allocation,
                        ]}
                        projectColors={PROJECT_COLORS}
                        projectNames={projectNames}
                        packMode={packMode}
                      />
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card className="bg-slate-900 border-slate-800">
                  <CardContent className="py-8 text-center text-slate-400">
                    <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-amber-400" />
                    <p>Two-{terms.plate} optimization not available.</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
    </>
  );
}
