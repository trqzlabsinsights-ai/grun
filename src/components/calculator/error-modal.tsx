"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import type { PlateSuggestion, IndustryTerms } from "@/lib/types";
import { capitalize } from "@/lib/industry-presets";

export function ErrorModal({
  open,
  onOpenChange,
  error,
  plateSuggestions,
  terms,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  error: string | null;
  plateSuggestions: PlateSuggestion[];
  terms: IndustryTerms;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); }}>
      <DialogContent className="bg-white border-red-200 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-5 h-5" />
            Calculation Error
          </DialogTitle>
          <DialogDescription className="text-gray-600 pt-2">{error}</DialogDescription>
        </DialogHeader>
        {plateSuggestions.length > 0 && (
          <div className="mt-2 space-y-2">
            <p className="text-sm font-medium text-gray-700">{capitalize(terms.plate)} Suggestions:</p>
            <div className="space-y-1.5">
              {plateSuggestions.map((s) => (
                <div
                  key={s.plateCount}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                    s.feasible ? "bg-emerald-50 border border-emerald-200" : "bg-gray-50 border border-gray-200"
                  }`}
                >
                  <span className={`font-bold ${s.feasible ? "text-emerald-600" : "text-gray-400"}`}>
                    {s.plateCount} {s.plateCount === 1 ? terms.plate : `${terms.plate}s`}
                  </span>
                  <span className={s.feasible ? "text-emerald-700" : "text-gray-400"}>{s.description}</span>
                  {s.feasible && (
                    <span className="ml-auto text-xs text-emerald-600">{s.totalSheets.toLocaleString()} {terms.sheet}s</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-gray-300 text-gray-700 hover:bg-gray-50">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
