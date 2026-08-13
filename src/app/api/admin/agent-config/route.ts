import { NextResponse } from "next/server";
import {
  buildHotelReceptionistInstructions,
  HOTEL_AGENT_PROMPT_VERSION,
} from "@/agents/hotelPrompt";
import { success } from "@/lib/hotel/errors";
import { HOTEL_TOOL_NAMES } from "@/lib/hotel/tool-names";
import { apiErrorResponse } from "@/lib/server/http";
import { getPublicRealtimeServerConfig } from "@/lib/server/realtime-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { apiKeyConfigured, model, voice } = getPublicRealtimeServerConfig();
    const instructions = buildHotelReceptionistInstructions();

    return NextResponse.json(
      success({
        promptVersion: HOTEL_AGENT_PROMPT_VERSION,
        promptLoaded: instructions.includes(HOTEL_AGENT_PROMPT_VERSION),
        instructionCharacters: instructions.length,
        model,
        voice,
        apiKeyConfigured,
        tools: HOTEL_TOOL_NAMES.map((name) => ({ name, loaded: true })),
      }),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
