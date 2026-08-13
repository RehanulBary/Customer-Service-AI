import { NextResponse } from "next/server";
import { success } from "@/lib/hotel/errors";
import { getHotelService } from "@/lib/hotel/service";
import { apiErrorResponse } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const reservations = await getHotelService().listReservations();
    return NextResponse.json(success({ reservations }), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
