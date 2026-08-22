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

/**
 * Surfaced to the dashboard verbatim so an admin can verify the live session
 * will request exactly this configuration. Keep this in sync with the
 * `new RealtimeSession({...})` call in `useRealtimeReceptionist.ts`.
 */
export const REALTIME_SESSION_KNOWN_SETTINGS = {
  outputModalities: ["audio"],
  reasoningEffort: "low",
  parallelToolCalls: false,
  historyStoreAudio: false,
  audio: {
    noiseReduction: "near_field",
    transcriptionModel: "gpt-realtime-whisper",
    transcriptionLanguage: "en",
    transcriptionDelay: "minimal",
    turnDetection: {
      type: "semantic_vad",
      eagerness: "auto",
      createResponse: true,
      interruptResponse: true,
    },
  },
} as const;

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
        sessionSettings: REALTIME_SESSION_KNOWN_SETTINGS,
        // Anchor phrases the live session instructions MUST contain for the
        // agent to behave correctly. Rendered in /admin so a future "tools
        // missing" symptom can be debugged by comparing this list against
        // whatever the SDK actually sends via getInitialSessionConfig().
        promptAnchors: [
          HOTEL_AGENT_PROMPT_VERSION,
          "Never lie about a tool call",
          "Commit immediately on confirmation",
          "Use exactly the seven tools",
          "Shall I confirm that booking?",
          `confirmed: true`,
          "search_room_availability",
          "create_reservation",
        ].map((phrase) => ({
          phrase,
          present: instructions.includes(phrase),
        })),
        // Hard requirements: the live session must match these, or the call fails loud.
        verification: {
          requiredToolCount: HOTEL_TOOL_NAMES.length,
          requiredPromptVersion: HOTEL_AGENT_PROMPT_VERSION,
          requiredModel: ["gpt-realtime-2.1", "gpt-realtime-2.1-mini"],
          requiredOutputModalities: ["audio"],
        },
      }),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
