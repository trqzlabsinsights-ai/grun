import { NextResponse } from "next/server";
import { calculateMultiSize } from "@/lib/gang-run-calculator-v2";
import { calculateCircular } from "@/lib/packer-circular";
import { calculateCustom } from "@/lib/packer-custom";
import { calculateSameRect } from "@/lib/packer-rect-same";

export type PackMode = "rect-same" | "rect-mixed" | "circular" | "custom";

interface PlateSuggestion {
  plateCount: number;
  feasible: boolean;
  totalSheets: number;
  description: string;
}

interface CalculateRequest {
  mode: PackMode;
  sheetWidth: number;
  sheetHeight: number;
  bleed: number;
  // rect-same
  stickerWidth?: number;
  stickerHeight?: number;
  // rect-mixed & custom
  projects?: any[];
}

/** Build plate suggestions from single/two plate results */
function buildPlateSuggestions(result: any): PlateSuggestion[] {
  const suggestions: PlateSuggestion[] = [];
  const single = result.singlePlateResult;
  const two = result.twoPlateResult;

  // 1 plate
  if (single) {
    suggestions.push({
      plateCount: 1,
      feasible: true,
      totalSheets: single.totalSheets,
      description: `${single.totalSheets.toLocaleString()} sheets, ${single.runLength.toLocaleString()} run length`,
    });
  } else {
    suggestions.push({
      plateCount: 1,
      feasible: false,
      totalSheets: 0,
      description: "Cannot fit all projects on one plate",
    });
  }

  // 2 plates
  if (two) {
    suggestions.push({
      plateCount: 2,
      feasible: true,
      totalSheets: two.totalSheets,
      description: `${two.totalSheets.toLocaleString()} sheets (P1: ${two.plate1.runLength.toLocaleString()} | P2: ${two.plate2.runLength.toLocaleString()})`,
    });
  } else {
    suggestions.push({
      plateCount: 2,
      feasible: false,
      totalSheets: 0,
      description: "Two-plate split not found",
    });
  }

  // 3+ plates: estimate based on single plate result
  // If we can fit on one plate, more plates won't help (unless for cost reasons)
  // If we can't fit on one plate, estimate linearly
  if (single) {
    // Can already fit on 1 plate, more plates would cost more
    suggestions.push({
      plateCount: 3,
      feasible: true,
      totalSheets: single.totalSheets, // approximately same or more
      description: "Unlikely to save sheets vs 1-2 plates",
    });
    suggestions.push({
      plateCount: 4,
      feasible: true,
      totalSheets: single.totalSheets,
      description: "Unlikely to save sheets vs 1-2 plates",
    });
  } else if (two) {
    suggestions.push({
      plateCount: 3,
      feasible: true,
      totalSheets: two.totalSheets,
      description: `Estimated ~${two.totalSheets.toLocaleString()} sheets`,
    });
    suggestions.push({
      plateCount: 4,
      feasible: true,
      totalSheets: two.totalSheets,
      description: `Estimated ~${two.totalSheets.toLocaleString()} sheets`,
    });
  } else {
    suggestions.push({
      plateCount: 3,
      feasible: false,
      totalSheets: 0,
      description: "Cannot fit",
    });
    suggestions.push({
      plateCount: 4,
      feasible: false,
      totalSheets: 0,
      description: "Cannot fit",
    });
  }

  return suggestions;
}

export async function POST(request: Request) {
  try {
    const body: CalculateRequest = await request.json();
    const mode = body.mode || "rect-mixed";

    let result: any;

    switch (mode) {
      case "rect-same": {
        if (!body.stickerWidth || !body.stickerHeight) {
          return NextResponse.json(
            { error: "Same-size mode requires stickerWidth and stickerHeight." },
            { status: 400 }
          );
        }
        result = calculateSameRect({
          sheetWidth: body.sheetWidth,
          sheetHeight: body.sheetHeight,
          bleed: body.bleed,
          stickerWidth: body.stickerWidth,
          stickerHeight: body.stickerHeight,
          projects: (body.projects || []).map((p: any) => ({
            name: p.name,
            quantity: p.quantity,
          })),
        });
        break;
      }

      case "rect-mixed": {
        result = calculateMultiSize({
          sheetWidth: body.sheetWidth,
          sheetHeight: body.sheetHeight,
          bleed: body.bleed,
          projects: (body.projects || []).map((p: any) => ({
            name: p.name,
            quantity: p.quantity,
            stickerWidth: p.stickerWidth,
            stickerHeight: p.stickerHeight,
          })),
        });
        break;
      }

      case "circular": {
        result = calculateCircular({
          sheetWidth: body.sheetWidth,
          sheetHeight: body.sheetHeight,
          bleed: body.bleed,
          projects: (body.projects || []).map((p: any) => ({
            name: p.name,
            quantity: p.quantity,
            diameter: p.diameter,
          })),
        });
        break;
      }

      case "custom": {
        try {
          result = calculateCustom({
            sheetWidth: body.sheetWidth,
            sheetHeight: body.sheetHeight,
            bleed: body.bleed,
            projects: (body.projects || []).map((p: any) => ({
              name: p.name,
              quantity: p.quantity,
              stickerWidth: p.stickerWidth,
              stickerHeight: p.stickerHeight,
              sides: p.sides || 4,
            })),
          });
        } catch (calcError) {
          console.error("Custom calculation error:", calcError);
          return NextResponse.json(
            {
              error: "Calculation timed out or encountered an error. Try reducing the number of projects or increasing sheet size.",
              plateSuggestions: [],
              mode: "custom",
            },
            { status: 500 }
          );
        }
        break;
      }

      default:
        return NextResponse.json(
          { error: `Unknown mode: ${mode}. Use rect-same, rect-mixed, circular, or custom.` },
          { status: 400 }
        );
    }

    if (result.error) {
      // Return the result with plate suggestions even on error
      return NextResponse.json({ mode, ...result }, { status: 200 });
    }

    // Add plate suggestions if not already present (custom mode has its own)
    if (!result.plateSuggestions) {
      result.plateSuggestions = buildPlateSuggestions(result);
    }

    return NextResponse.json({ mode, ...result });
  } catch (error) {
    console.error("Calculation error:", error);
    return NextResponse.json(
      { error: "Internal calculation error. Please check your inputs and try again." },
      { status: 500 }
    );
  }
}
