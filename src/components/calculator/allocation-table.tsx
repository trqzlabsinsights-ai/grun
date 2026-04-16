"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AllocationEntry, IndustryTerms } from "@/lib/types";
import { capitalize } from "@/lib/industry-presets";

export function AllocationTable({ allocation, projectColors, projectNames, terms }: {
  allocation: AllocationEntry[];
  projectColors: string[];
  projectNames: string[];
  terms: IndustryTerms;
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-gray-200 hover:bg-transparent">
            <TableHead className="text-gray-500">Project</TableHead>
            <TableHead className="text-gray-500">{capitalize(terms.sticker)} Size</TableHead>
            <TableHead className="text-gray-500 text-right">Order</TableHead>
            <TableHead className="text-gray-500 text-right">{capitalize(terms.outs)}/{capitalize(terms.sheet)}</TableHead>
            <TableHead className="text-gray-500 text-right">Group</TableHead>
            <TableHead className="text-gray-500 text-right">Produced</TableHead>
            <TableHead className="text-gray-500 text-right">{capitalize(terms.overage)}</TableHead>
            <TableHead className="text-gray-500 text-right">{capitalize(terms.overage)} %</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {allocation.map((entry) => {
            const pIdx = projectNames.indexOf(entry.name);
            const color = projectColors[pIdx] || "#64748b";
            const gs = entry.groupShape;
            return (
              <TableRow key={entry.name} className="border-gray-100 hover:bg-gray-50">
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
                    <span className="font-medium text-gray-800">{entry.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-gray-600 font-mono text-xs">{entry.stickerWidth}&quot;&times;{entry.stickerHeight}&quot;</TableCell>
                <TableCell className="text-right text-gray-600">{entry.quantity.toLocaleString()}</TableCell>
                <TableCell className="text-right text-blue-600 font-semibold">{entry.outs}</TableCell>
                <TableCell className="text-right text-gray-400 font-mono text-xs">{gs ? `${gs.w}\u00d7${gs.h}` : "\u2014"}</TableCell>
                <TableCell className="text-right text-gray-600">{entry.produced.toLocaleString()}</TableCell>
                <TableCell className="text-right">
                  <span className={entry.overage > 0 ? "text-amber-600" : "text-gray-400"}>+{entry.overage.toLocaleString()}</span>
                </TableCell>
                <TableCell className="text-right">
                  <span className={entry.overagePct > 20 ? "text-amber-600" : entry.overagePct > 10 ? "text-yellow-600" : "text-emerald-600"}>
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
