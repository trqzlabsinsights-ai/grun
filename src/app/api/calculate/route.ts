import { NextResponse } from "next/server";
import { calculateMultiSize } from "@/lib/gang-run-calculator-v2";

interface PlateSuggestion {
  plateCount: number;
  feasible: boolean;
  totalSheets: number;
  description: string;
}

interface CalculateRequest {
  mode: string;
  sheetWidth: number;
  sheetHeight: number;
  bleed: number;
  projects: { name: string; quantity: number; stickerWidth: number; stickerHeight: number }[];
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

  // 3+ plates: estimate
  if (single) {
    suggestions.push({
      plateCount: 3,
      feasible: true,
      totalSheets: single.totalSheets,
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
    suggestions.push({ plateCount: 3, feasible: false, totalSheets: 0, description: "Cannot fit" });
    suggestions.push({ plateCount: 4, feasible: false, totalSheets: 0, description: "Cannot fit" });
  }

  return suggestions;
}

export async function POST(request: Request) {
  try {
    const body: CalculateRequest = await request.json();

    const result = calculateMultiSize({
      sheetWidth: body.sheetWidth,
      sheetHeight: body.sheetHeight,
      bleed: body.bleed,
      projects: (body.projects || []).map((p) => ({
        name: p.name,
        quantity: p.quantity,
        stickerWidth: p.stickerWidth,
        stickerHeight: p.stickerHeight,
      })),
    });

    if (result.error) {
      return NextResponse.json({ mode: "rect-mixed", ...result }, { status: 200 });
    }

    if (!result.plateSuggestions) {
      result.plateSuggestions = buildPlateSuggestions(result);
    }

    return NextResponse.json({ mode: "rect-mixed", ...result });
  } catch (error) {
    console.error("Calculation error:", error);
    return NextResponse.json(
      { error: "Internal calculation error. Please check your inputs and try again." },
      { status: 500 }
    );
  }
}
