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
  CalculateResponse,
  PlateSuggestion,
  IndustryTerms,
} from "@/lib/types";
import { PROJECT_COLORS, capitalize } from "@/lib/industry-presets";
import { KPICard } from "./kpi-card";
import { AllocationTable } from "./allocation-table";
import { SVGPlateVisualization } from "./svg-plate-visualization";
import { ProductionBarChart } from "./production-bar-chart";
import { ErrorModal } from "./error-modal";

interface ResultsSectionProps {
  result: CalculateResponse | null;
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
        onOpenChange={(open) => setErrorModalOpen(open)}
        error={error}
        plateSuggestions={plateSuggestions}
        terms={terms}
      />

      {/* Results */}
      {result && (
        <>
          {/* Sheet Capacity */}
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-gray-900 flex items-center gap-2">
                <LayoutGrid className="w-5 h-5 text-emerald-600" />
                {capitalize(terms.sheet)} Capacity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <KPICard label={`${capitalize(terms.sheet)} Size`} value={`${sheetWidth}" \u00d7 ${sheetHeight}"`} accent="text-emerald-600" />
                <KPICard label="Mode" value="Mixed Rect" sub="Per-project dimensions" accent="text-blue-600" />
                <KPICard label={terms.bleed !== "\u2014" ? `${capitalize(terms.bleed)} Per Side` : "Bleed"} value={terms.bleed !== "\u2014" ? `${bleed}mm` : "0mm"} sub={bleed > 0 ? `${bleedInches.toFixed(4)}"` : undefined} accent="text-amber-600" />
                <KPICard label="Algorithm" value="MaxRect" sub="2D bin packing" accent="text-gray-600" />
              </div>
            </CardContent>
          </Card>

          {/* Plate Suggestions */}
          {plateSuggestions.length > 0 && (
            <Card className="bg-white border-gray-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-gray-900 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-amber-600" />
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
                          ? "bg-emerald-50 border-emerald-200"
                          : "bg-gray-50 border-gray-200"
                      }`}
                    >
                      <div className={`text-2xl font-bold ${s.feasible ? "text-emerald-600" : "text-gray-300"}`}>
                        {s.plateCount}
                      </div>
                      <div className={`text-xs ${s.feasible ? "text-emerald-600" : "text-gray-400"}`}>
                        {s.plateCount === 1 ? terms.plate : `${terms.plate}s`}
                      </div>
                      <div className={`text-xs mt-1 ${s.feasible ? "text-emerald-700" : "text-gray-400"}`}>
                        {s.feasible ? `${s.totalSheets.toLocaleString()} ${terms.sheet}s` : "Cannot fit"}
                      </div>
                      {s.feasible && s.description && (
                        <div className="text-[10px] text-gray-400 mt-1">{s.description}</div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Results Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-gray-100 border border-gray-200">
              <TabsTrigger value="single" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
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
                    <KPICard label="Run Length" value={result.singlePlateResult.runLength.toLocaleString()} accent="text-blue-600" />
                    <KPICard label={`Total ${capitalize(terms.sheet)}s`} value={result.singlePlateResult.totalSheets.toLocaleString()} accent="text-blue-600" />
                    <KPICard label="Total Produced" value={result.singlePlateResult.totalProduced.toLocaleString()} sub={`${capitalize(terms.overage)}: +${result.singlePlateResult.totalOverage.toLocaleString()}`} accent="text-gray-700" />
                    <KPICard label="Material Yield" value={`${result.singlePlateResult.materialYield.toFixed(1)}%`} accent="text-emerald-600" />
                  </div>

                  <Card className="bg-white border-gray-200 shadow-sm">
                    <CardHeader><CardTitle className="text-gray-900 text-base">Slot Allocation</CardTitle></CardHeader>
                    <CardContent>
                      <AllocationTable allocation={result.singlePlateResult.allocation} projectColors={PROJECT_COLORS} projectNames={projectNames} terms={terms} />
                    </CardContent>
                  </Card>

                  <Card className="bg-white border-gray-200 shadow-sm">
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
                        terms={terms}
                        bleedMm={bleed}
                      />
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card className="bg-white border-gray-200 shadow-sm">
                  <CardContent className="py-8 text-center text-gray-500">
                    <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-amber-500" />
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
                    <KPICard label={`Total ${capitalize(terms.sheet)}s`} value={result.twoPlateResult.totalSheets.toLocaleString()} sub={`P1: ${result.twoPlateResult.plate1.runLength.toLocaleString()} | P2: ${result.twoPlateResult.plate2.runLength.toLocaleString()}`} accent="text-amber-600" />
                    <KPICard label="Total Produced" value={result.twoPlateResult.totalProduced.toLocaleString()} sub={`${capitalize(terms.overage)}: +${result.twoPlateResult.totalOverage.toLocaleString()}`} accent="text-gray-700" />
                    <KPICard label="Material Yield" value={`${result.twoPlateResult.materialYield.toFixed(1)}%`} accent="text-emerald-600" />
                    <KPICard label={`${capitalize(terms.sheet)}s Saved`} value={result.twoPlateResult.sheetsSaved > 0 ? `-${result.twoPlateResult.sheetsSaved}` : `+${Math.abs(result.twoPlateResult.sheetsSaved)}`} sub={result.twoPlateResult.sheetsSaved > 0 ? `vs single ${terms.plate}` : `more than single`} accent={result.twoPlateResult.sheetsSaved > 0 ? "text-emerald-600" : "text-red-500"} />
                  </div>

                  {/* Cost info */}
                  <Card className="bg-amber-50 border-amber-200">
                    <CardContent className="py-4">
                      <div className="flex items-start gap-3">
                        <Info className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                        <div className="text-sm text-gray-700">
                          {result.twoPlateResult.sheetsSaved > 0 ? (
                            <>
                              Two {terms.plate}s <span className="text-emerald-600 font-semibold">save {result.twoPlateResult.sheetsSaved.toLocaleString()} {terms.sheet}s</span> but cost{" "}
                              <span className="text-amber-600 font-semibold">1 extra {terms.plate} set + setup</span>. Evaluate if material savings outweigh the additional {terms.plate} cost.
                            </>
                          ) : (
                            <>Two {terms.plate}s do not save {terms.sheet}s for this configuration.</>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Plate 1 */}
                  <Card className="bg-white border-gray-200 shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-gray-900 text-base flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm bg-blue-500" />
                        {capitalize(terms.plate)} 1 — {result.twoPlateResult.plate1.runLength.toLocaleString()} {terms.sheet}s
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <AllocationTable allocation={result.twoPlateResult.plate1.allocation} projectColors={PROJECT_COLORS} projectNames={projectNames} terms={terms} />
                      <SVGPlateVisualization
                        plateResult={result.twoPlateResult.plate1}
                        sheetWidth={sheetWidth}
                        sheetHeight={sheetHeight}
                        bleedInches={bleedInches}
                        projectColors={PROJECT_COLORS}
                        projectNames={projectNames}
                        title={`${capitalize(terms.plate)} 1 — ${result.twoPlateResult.plate1.runLength.toLocaleString()} ${terms.sheet}s`}
                        plateLabel="plate1"
                        terms={terms}
                        bleedMm={bleed}
                      />
                    </CardContent>
                  </Card>

                  {/* Plate 2 */}
                  <Card className="bg-white border-gray-200 shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-gray-900 text-base flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm bg-amber-500" />
                        {capitalize(terms.plate)} 2 — {result.twoPlateResult.plate2.runLength.toLocaleString()} {terms.sheet}s
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <AllocationTable allocation={result.twoPlateResult.plate2.allocation} projectColors={PROJECT_COLORS} projectNames={projectNames} terms={terms} />
                      <SVGPlateVisualization
                        plateResult={result.twoPlateResult.plate2}
                        sheetWidth={sheetWidth}
                        sheetHeight={sheetHeight}
                        bleedInches={bleedInches}
                        projectColors={PROJECT_COLORS}
                        projectNames={projectNames}
                        title={`${capitalize(terms.plate)} 2 — ${result.twoPlateResult.plate2.runLength.toLocaleString()} ${terms.sheet}s`}
                        plateLabel="plate2"
                        terms={terms}
                        bleedMm={bleed}
                      />
                    </CardContent>
                  </Card>

                  {/* Combined summary */}
                  <Card className="bg-white border-gray-200 shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-gray-900 text-base">Combined Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ProductionBarChart
                        allocation={[
                          ...result.twoPlateResult.plate1.allocation,
                          ...result.twoPlateResult.plate2.allocation,
                        ]}
                        projectColors={PROJECT_COLORS}
                        projectNames={projectNames}
                      />
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card className="bg-white border-gray-200 shadow-sm">
                  <CardContent className="py-8 text-center text-gray-500">
                    <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-amber-500" />
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
