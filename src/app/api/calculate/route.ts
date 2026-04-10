import { NextResponse } from "next/server";
import { calculateMultiSize } from "@/lib/gang-run-calculator-v2";

interface ProjectInput {
  name: string;
  quantity: number;
  stickerWidth: number;
  stickerHeight: number;
}

interface CalculateRequest {
  sheetWidth: number;
  sheetHeight: number;
  bleed: number;
  projects: ProjectInput[];
}

export async function POST(request: Request) {
  try {
    const body: CalculateRequest = await request.json();

    const result = calculateMultiSize({
      sheetWidth: body.sheetWidth,
      sheetHeight: body.sheetHeight,
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
      { capacity: null, maxSlots: 0, singlePlateResult: null, twoPlateResult: null, error: "Internal calculation error." },
      { status: 500 }
    );
  }
}
