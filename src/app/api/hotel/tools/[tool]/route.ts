import { NextResponse } from "next/server";
import { success, HotelError } from "@/lib/hotel/errors";
import { executeHotelTool, isHotelToolName } from "@/lib/hotel/tool-handler";
import {
  apiErrorResponse,
  assertSameOrigin,
  readJsonBody,
} from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ tool: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const { tool } = await context.params;
    if (!isHotelToolName(tool)) {
      throw new HotelError("INVALID_INPUT", "Unknown hotel tool.", 404);
    }
    const input = await readJsonBody(request);
    const result = await executeHotelTool(tool, input);
    return NextResponse.json(success(result), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
