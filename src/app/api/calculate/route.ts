import { NextResponse } from "next/server";
import { calculateMultiSize } from "@/lib/gang-run-calculator-v2";
import { calculateCircular } from "@/lib/packer-circular";
import { calculateCustom } from "@/lib/packer-custom";
import { calculateSameRect } from "@/lib/packer-rect-same";

export type PackMode = "rect-same" | "rect-mixed" | "circular" | "custom";

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
        result = calculateCustom({
          sheetWidth: body.sheetWidth,
          sheetHeight: body.sheetHeight,
          bleed: body.bleed,
          projects: (body.projects || []).map((p: any) => ({
            name: p.name,
            quantity: p.quantity,
            stickerWidth: p.stickerWidth,
            stickerHeight: p.stickerHeight,
            shapeName: p.shapeName || "diamond",
            vertices: p.vertices || [],
          })),
        });
        break;
      }

      default:
        return NextResponse.json(
          { error: `Unknown mode: ${mode}. Use rect-same, rect-mixed, circular, or custom.` },
          { status: 400 }
        );
    }

    if (result.error) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json({ mode, ...result });
  } catch (error) {
    console.error("Calculation error:", error);
    return NextResponse.json(
      { error: "Internal calculation error." },
      { status: 500 }
    );
  }
}
