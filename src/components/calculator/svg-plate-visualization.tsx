"use client";

import type { PlateResult, PackMode, IndustryTerms } from "@/lib/types";
import { INDUSTRY_PRESETS } from "@/lib/industry-presets";
import { PRESET_SHAPES } from "@/lib/packer-custom";
import { RegMark } from "./reg-mark";

export function SVGPlateVisualization({
  plateResult,
  sheetWidth,
  sheetHeight,
  bleedInches,
  projectColors,
  projectNames,
  title,
  plateLabel,
  packMode,
  terms,
  bleedMm,
}: {
  plateResult: PlateResult;
  sheetWidth: number;
  sheetHeight: number;
  bleedInches: number;
  projectColors: string[];
  projectNames: string[];
  title: string;
  plateLabel: string;
  packMode: PackMode;
  terms: IndustryTerms;
  bleedMm: number;
}) {
  const { placedGroups, allocation, runLength } = plateResult;
  const pad = 1.2;
  const svgW = sheetWidth + pad * 2;
  const svgH = sheetHeight + pad * 2 + 1.8;
  const uniqueId = plateLabel.replace(/\s/g, "");

  const showGrain = terms.grainDirection !== "—";
  const showBleedZone = terms.bleed !== "—" && bleedMm > 0;

  const cutLineLabel = (() => {
    const key = Object.entries(INDUSTRY_PRESETS).find(([, v]) => v.terms === terms)?.[0];
    switch (key) {
      case "cnc-cutting": return "Cut line";
      case "textile-cutting": return "Pattern boundary";
      case "pallet-loading": return "Item boundary";
      case "glass-cutting": return "Score line";
      case "vlsi-pcb": return "Component outline";
      default: return "Die-cut line";
    }
  })();

  return (
    <div className="w-full">
      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`${-pad} ${-pad} ${svgW} ${svgH}`}
          className="w-full max-w-4xl mx-auto"
          style={{ minHeight: 320 }}
        >
          <defs>
            <marker id={`arrow-${uniqueId}`} markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#06b6d4" />
            </marker>
            <pattern id={`bleed-hatch-${uniqueId}`} patternUnits="userSpaceOnUse" width="0.15" height="0.15" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="0.15" stroke="#f97316" strokeWidth="0.03" strokeOpacity="0.3" />
            </pattern>
          </defs>

          {/* Sheet background */}
          <rect x={0} y={0} width={sheetWidth} height={sheetHeight} rx={0.06} fill="#1e293b" stroke="#475569" strokeWidth={0.05} />

          {/* Render each placed group */}
          {placedGroups.map((group, gi) => {
            const colorIdx = projectNames.indexOf(group.name);
            const color = projectColors[colorIdx >= 0 ? colorIdx : 0] || "#64748b";
            const shape = group.shape;
            const itemType = group.itemType || (packMode === "rect-same" ? "rect-same" : packMode === "rect-mixed" ? "rect" : packMode);
            const bleed = bleedInches;

            let sizeLabel = "";
            if (itemType === "circle" && group.diameter) {
              sizeLabel = `\u2300${group.diameter}"`;
            } else if (itemType === "custom" && group.shapeName) {
              const preset = PRESET_SHAPES[group.shapeName];
              sizeLabel = preset ? `${preset.icon} ${group.stickerWidth}"\u00d7${group.stickerHeight}"` : `${group.shapeName}`;
            } else {
              const sw = group.stickerWidth || 0;
              const sh = group.stickerHeight || 0;
              sizeLabel = `${sw}"\u00d7${sh}"`;
            }

            return (
              <g key={`grp-${gi}`}>
                {/* Group outer boundary */}
                <rect x={group.x} y={group.y} width={group.width} height={group.height} rx={0.06} fill={color} fillOpacity={0.12} stroke={color} strokeWidth={0.08} />

                {/* Bleed zones */}
                {showBleedZone && <rect x={group.x + bleed} y={group.y} width={group.width - 2 * bleed} height={bleed} fill={`url(#bleed-hatch-${uniqueId})`} fillOpacity={0.5} />}
                {showBleedZone && <rect x={group.x + bleed} y={group.y + group.height - bleed} width={group.width - 2 * bleed} height={bleed} fill={`url(#bleed-hatch-${uniqueId})`} fillOpacity={0.5} />}
                {showBleedZone && <rect x={group.x} y={group.y + bleed} width={bleed} height={group.height - 2 * bleed} fill={`url(#bleed-hatch-${uniqueId})`} fillOpacity={0.5} />}
                {showBleedZone && <rect x={group.x + group.width - bleed} y={group.y + bleed} width={bleed} height={group.height - 2 * bleed} fill={`url(#bleed-hatch-${uniqueId})`} fillOpacity={0.5} />}

                {/* CIRCLE MODE */}
                {itemType === "circle" && group.circles && group.diameter && (
                  <>
                    {group.circles.map((c, ci) => {
                      const r = group.diameter! / 2;
                      return (
                        <g key={`circ-${gi}-${ci}`}>
                          <circle cx={c.cx} cy={c.cy} r={r} fill={color} fillOpacity={0.18} stroke={color} strokeWidth={0.04} strokeOpacity={0.7} />
                          <circle cx={c.cx} cy={c.cy} r={r - 0.05} fill="none" stroke="#f97316" strokeWidth={0.02} strokeDasharray="0.1 0.06" strokeOpacity={0.5} />
                        </g>
                      );
                    })}
                  </>
                )}

                {/* CUSTOM SHAPE (tessellation) */}
                {itemType === "custom" && group.tessellated && group.tessPositions && group.tessPositions.length > 0 && group.vertices && group.stickerWidth && group.stickerHeight && (
                  <>
                    {group.tessPositions.map((tp, ti) => {
                      const sw = group.stickerWidth!;
                      const sh = group.stickerHeight!;
                      const inset = 0.05;
                      const verts = tp.flip && group.flipVertices && group.flipVertices.length >= 3 ? group.flipVertices : group.vertices!;
                      const points = verts.map((v) => `${tp.x + v.x * sw},${tp.y + v.y * sh}`).join(" ");
                      const diePoints = verts.map((v) => `${tp.x + inset + v.x * (sw - 2 * inset)},${tp.y + inset + v.y * (sh - 2 * inset)}`).join(" ");
                      return (
                        <g key={`tess-${gi}-${ti}`}>
                          <polygon points={points} fill={color} fillOpacity={tp.flip ? 0.14 : 0.18} stroke={color} strokeWidth={0.04} strokeOpacity={tp.flip ? 0.6 : 0.7} />
                          <polygon points={diePoints} fill="none" stroke="#f97316" strokeWidth={0.02} strokeDasharray="0.1 0.06" strokeOpacity={0.5} />
                        </g>
                      );
                    })}
                  </>
                )}

                {/* CUSTOM SHAPE (non-tessellated, grid) */}
                {itemType === "custom" && !group.tessellated && group.vertices && group.vertices.length >= 3 && group.stickerWidth && group.stickerHeight && (
                  <>
                    {Array.from({ length: shape.h }).flatMap((_, row) =>
                      Array.from({ length: shape.w }).map((_, col) => {
                        const cellX = group.x + bleed + col * group.stickerWidth!;
                        const cellY = group.y + bleed + row * group.stickerHeight!;
                        const sw = group.stickerWidth!;
                        const sh = group.stickerHeight!;
                        const inset = 0.05;
                        const points = group.vertices!.map((v) => `${cellX + v.x * sw},${cellY + v.y * sh}`).join(" ");
                        const diePoints = group.vertices!.map((v) => `${cellX + inset + v.x * (sw - 2 * inset)},${cellY + inset + v.y * (sh - 2 * inset)}`).join(" ");
                        return (
                          <g key={`shape-${gi}-${row}-${col}`}>
                            <polygon points={points} fill={color} fillOpacity={0.18} stroke={color} strokeWidth={0.04} strokeOpacity={0.7} />
                            <polygon points={diePoints} fill="none" stroke="#f97316" strokeWidth={0.02} strokeDasharray="0.1 0.06" strokeOpacity={0.5} />
                          </g>
                        );
                      })
                    )}
                  </>
                )}

                {/* RECT MODES */}
                {(itemType === "rect-same" || itemType === "rect") && group.stickerWidth && group.stickerHeight && (
                  <>
                    {Array.from({ length: shape.h }).flatMap((_, row) =>
                      Array.from({ length: shape.w }).map((_, col) => {
                        const cellX = group.x + bleed + col * group.stickerWidth!;
                        const cellY = group.y + bleed + row * group.stickerHeight!;
                        const sw = group.stickerWidth!;
                        const sh = group.stickerHeight!;
                        return (
                          <g key={`cell-${gi}-${row}-${col}`}>
                            <rect x={cellX} y={cellY} width={sw} height={sh} rx={0.03} fill={color} fillOpacity={0.18} stroke={color} strokeWidth={0.04} strokeOpacity={0.7} />
                            <rect x={cellX + 0.05} y={cellY + 0.05} width={sw - 0.1} height={sh - 0.1} rx={0.02} fill="none" stroke="#f97316" strokeWidth={0.02} strokeDasharray="0.1 0.06" strokeOpacity={0.5} />
                          </g>
                        );
                      })
                    )}
                  </>
                )}

                {/* Group labels */}
                <text x={group.x + group.width / 2} y={group.y + group.height / 2 - 0.2} textAnchor="middle" dominantBaseline="middle" fill={color} fontSize={0.7} fontWeight="bold" fontFamily="monospace">{group.name}</text>
                <text x={group.x + group.width / 2} y={group.y + group.height / 2 + 0.25} textAnchor="middle" dominantBaseline="middle" fill="#cbd5e1" fontSize={0.28} fontFamily="monospace">{group.outs} {terms.outs} ({shape.w}&times;{shape.h})</text>
                <text x={group.x + group.width / 2} y={group.y + group.height / 2 + 0.5} textAnchor="middle" dominantBaseline="middle" fill="#94a3b8" fontSize={0.2} fontFamily="monospace">{sizeLabel}</text>

                {/* Group dimension labels */}
                <text x={group.x + group.width / 2} y={group.y + group.height + 0.25} textAnchor="middle" fill="#64748b" fontSize={0.2} fontFamily="monospace">{group.width.toFixed(2)}&quot;</text>
                <text x={group.x + group.width + 0.2} y={group.y + group.height / 2} textAnchor="start" fill="#64748b" fontSize={0.2} fontFamily="monospace" transform={`rotate(90, ${group.x + group.width + 0.2}, ${group.y + group.height / 2})`}>{group.height.toFixed(2)}&quot;</text>
              </g>
            );
          })}

          {/* Registration marks */}
          <RegMark x={-0.3} y={-0.3} />
          <RegMark x={sheetWidth + 0.3} y={-0.3} />
          <RegMark x={-0.3} y={sheetHeight + 0.3} />
          <RegMark x={sheetWidth + 0.3} y={sheetHeight + 0.3} />

          {/* Sheet dimension — width */}
          <line x1={0} y1={-0.6} x2={sheetWidth} y2={-0.6} stroke="#64748b" strokeWidth={0.025} />
          <line x1={0} y1={-0.75} x2={0} y2={-0.45} stroke="#64748b" strokeWidth={0.025} />
          <line x1={sheetWidth} y1={-0.75} x2={sheetWidth} y2={-0.45} stroke="#64748b" strokeWidth={0.025} />
          <text x={sheetWidth / 2} y={-0.82} textAnchor="middle" fill="#94a3b8" fontSize={0.32} fontFamily="monospace">{sheetWidth}&quot;</text>

          {/* Sheet dimension — height */}
          <line x1={sheetWidth + 0.6} y1={0} x2={sheetWidth + 0.6} y2={sheetHeight} stroke="#64748b" strokeWidth={0.025} />
          <line x1={sheetWidth + 0.45} y1={0} x2={sheetWidth + 0.75} y2={0} stroke="#64748b" strokeWidth={0.025} />
          <line x1={sheetWidth + 0.45} y1={sheetHeight} x2={sheetWidth + 0.75} y2={sheetHeight} stroke="#64748b" strokeWidth={0.025} />
          <text x={sheetWidth + 0.95} y={sheetHeight / 2} textAnchor="middle" fill="#94a3b8" fontSize={0.32} fontFamily="monospace" transform={`rotate(90, ${sheetWidth + 0.95}, ${sheetHeight / 2})`}>{sheetHeight}&quot;</text>

          {/* Plate title */}
          <text x={sheetWidth / 2} y={-1.0} textAnchor="middle" fill="#e2e8f0" fontSize={0.45} fontWeight="bold" fontFamily="monospace">{title}</text>
          <text x={sheetWidth / 2} y={-0.7} textAnchor="middle" fill="#94a3b8" fontSize={0.3} fontFamily="monospace">{runLength.toLocaleString()} {terms.sheet}s &times; {plateResult.allocation.reduce((s, a) => s + a.outs, 0)} {terms.outs}</text>

          {/* Grain direction arrow */}
          {showGrain && (
            <>
              <line x1={0.5} y1={sheetHeight + 0.7} x2={sheetWidth - 0.5} y2={sheetHeight + 0.7} stroke="#06b6d4" strokeWidth={0.035} markerEnd={`url(#arrow-${uniqueId})`} />
              <text x={sheetWidth / 2} y={sheetHeight + 0.6} textAnchor="middle" fill="#06b6d4" fontSize={0.22} fontFamily="monospace">{terms.grainDirection}</text>
            </>
          )}

          {/* Legend */}
          <g transform={`translate(0, ${sheetHeight + 1.0})`}>
            {showBleedZone && (
              <>
                <rect x={0} y={0} width={0.3} height={0.2} rx={0.03} fill={`url(#bleed-hatch-${uniqueId})`} stroke="#f97316" strokeWidth={0.02} />
                <text x={0.4} y={0.15} fill="#94a3b8" fontSize={0.2} fontFamily="monospace">{bleedMm}mm {terms.bleed} zone (per group)</text>
              </>
            )}
            {packMode === "circular" ? (
              <>
                <circle cx={4.15} cy={0.1} r={0.1} fill="none" stroke="#f97316" strokeWidth={0.015} strokeDasharray="0.06 0.03" />
                <text x={4.4} y={0.15} fill="#94a3b8" fontSize={0.2} fontFamily="monospace">{cutLineLabel}</text>
              </>
            ) : (
              <>
                <rect x={4} y={0.02} width={0.3} height={0.16} rx={0.02} fill="none" stroke="#f97316" strokeWidth={0.015} strokeDasharray="0.08 0.04" />
                <text x={4.4} y={0.15} fill="#94a3b8" fontSize={0.2} fontFamily="monospace">{cutLineLabel}</text>
              </>
            )}
            <rect x={7.5} y={0.02} width={0.3} height={0.16} rx={0.02} fill="#06b6d4" fillOpacity={0.15} stroke="#06b6d4" strokeWidth={0.03} />
            <text x={7.9} y={0.15} fill="#94a3b8" fontSize={0.2} fontFamily="monospace">Group boundary</text>
          </g>
        </svg>
      </div>
    </div>
  );
}
