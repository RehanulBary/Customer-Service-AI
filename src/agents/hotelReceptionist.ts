"use client";

import { RealtimeAgent } from "@openai/agents/realtime";
import type { RealtimeVoice } from "@/config/realtime";
import { buildHotelReceptionistInstructions } from "./hotelPrompt";
import { createHotelTools, type HotelToolExecutor } from "./remoteTools";

export function createHotelReceptionistAgent(
  voice: RealtimeVoice,
  executeHotelTool?: HotelToolExecutor,
) {
  return new RealtimeAgent({
    name: "Shapla Grand Receptionist",
    voice,
    instructions: buildHotelReceptionistInstructions(),
    tools: createHotelTools(executeHotelTool),
  });
}
