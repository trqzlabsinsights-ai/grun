import { NextResponse } from "next/server";
import { calculate } from "@/lib/gang-run-calculator";

// ── Types ──────────────────────────────────────────────────────────────────

interface ProjectInput {
  name: string;
  quantity: number;
}

interface CalculateRequest {
  sheetWidth: number;
  sheetHeight: number;
  stickerWidth: number;
  stickerHeight: number;
  bleed: number; // mm
  projects: ProjectInput[];
}

// ── POST Handler ───────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body: CalculateRequest = await request.json();

    const result = calculate({
      sheetWidth: body.sheetWidth,
      sheetHeight: body.sheetHeight,
      stickerWidth: body.stickerWidth,
      stickerHeight: body.stickerHeight,
      bleed: body.bleed,
      projects: body.projects,
    });

    if (result.error) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Calculation error:", error);
    return NextResponse.json(
      { capacity: {}, singlePlateResult: null, twoPlateResult: null, error: "Internal calculation error." },
      { status: 500 }
    );
  }
}
