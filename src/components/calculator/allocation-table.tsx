"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AllocationEntry, PackMode, IndustryTerms } from "@/lib/types";
import { getPolygonIcon, getPolygonName } from "@/lib/packer-custom";
import { capitalize } from "@/lib/industry-presets";

export function AllocationTable({ allocation, projectColors, projectNames, packMode, terms }: {
  allocation: AllocationEntry[];
  projectColors: string[];
  projectNames: string[];
  packMode: PackMode;
  terms: IndustryTerms;
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-slate-700 hover:bg-transparent">
            <TableHead className="text-slate-400">Project</TableHead>
            {packMode === "circular" ? (
              <TableHead className="text-slate-400">Diameter</TableHead>
            ) : packMode === "custom" ? (
              <TableHead className="text-slate-400">Shape</TableHead>
            ) : (
              <TableHead className="text-slate-400">{capitalize(terms.sticker)} Size</TableHead>
            )}
            <TableHead className="text-slate-400 text-right">Order</TableHead>
            <TableHead className="text-slate-400 text-right">{capitalize(terms.outs)}/{capitalize(terms.sheet)}</TableHead>
            {packMode === "custom" && (
              <TableHead className="text-slate-400 text-right">{capitalize(terms.sheet)}s</TableHead>
            )}
            <TableHead className="text-slate-400 text-right">Group</TableHead>
            <TableHead className="text-slate-400 text-right">Produced</TableHead>
            <TableHead className="text-slate-400 text-right">{capitalize(terms.overage)}</TableHead>
            <TableHead className="text-slate-400 text-right">{capitalize(terms.overage)} %</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {allocation.map((entry) => {
            const pIdx = projectNames.indexOf(entry.name);
            const color = projectColors[pIdx] || "#64748b";
            const gs = entry.groupShape;
            return (
              <TableRow key={entry.name} className="border-slate-700/50 hover:bg-slate-800/50">
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
                    <span className="font-medium text-slate-200">{entry.name}</span>
                  </div>
                </TableCell>
                {packMode === "circular" ? (
                  <TableCell className="text-slate-300 font-mono text-xs">&empty;{entry.diameter}&quot;</TableCell>
                ) : packMode === "custom" ? (
                  <TableCell className="text-slate-300 font-mono text-xs">
                    <span className="mr-1">{getPolygonIcon(entry.sides || 4)}</span>
                    {getPolygonName(entry.sides || 4)} ({entry.stickerWidth}&quot;&times;{entry.stickerHeight}&quot;)
                  </TableCell>
                ) : (
                  <TableCell className="text-slate-300 font-mono text-xs">{entry.stickerWidth}&quot;&times;{entry.stickerHeight}&quot;</TableCell>
                )}
                <TableCell className="text-right text-slate-300">{entry.quantity.toLocaleString()}</TableCell>
                <TableCell className="text-right text-cyan-400 font-semibold">{entry.outs}</TableCell>
                {packMode === "custom" && (
                  <TableCell className="text-right text-amber-400 font-semibold">{entry.sheets || Math.ceil(entry.produced / entry.outs)}</TableCell>
                )}
                <TableCell className="text-right text-slate-400 font-mono text-xs">{gs ? `${gs.w}\u00d7${gs.h}` : "\u2014"}</TableCell>
                <TableCell className="text-right text-slate-300">{entry.produced.toLocaleString()}</TableCell>
                <TableCell className="text-right">
                  <span className={entry.overage > 0 ? "text-amber-400" : "text-slate-400"}>+{entry.overage.toLocaleString()}</span>
                </TableCell>
                <TableCell className="text-right">
                  <span className={entry.overagePct > 20 ? "text-amber-400" : entry.overagePct > 10 ? "text-yellow-500" : "text-emerald-400"}>
                    {entry.overagePct.toFixed(1)}%
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
