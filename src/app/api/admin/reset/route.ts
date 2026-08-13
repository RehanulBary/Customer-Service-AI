import { NextResponse } from "next/server";
import { success } from "@/lib/hotel/errors";
import { getHotelService } from "@/lib/hotel/service";
import { apiErrorResponse, assertSameOrigin } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const result = await getHotelService().resetDemoData();
    return NextResponse.json(success(result), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
