import type { TransportEvent } from "@openai/agents/realtime";
import { HOTEL_AGENT_PROMPT_VERSION } from "@/agents/hotelPrompt";
import { HOTEL_TOOL_NAMES, type HotelToolName } from "@/lib/hotel/tool-names";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export type SessionAcknowledgement = {
  promptLoaded: boolean;
  promptVersion: string;
  acknowledgedToolNames: string[];
  missingTools: HotelToolName[];
};

export function inspectSessionAcknowledgement(
  event: TransportEvent,
): SessionAcknowledgement | null {
  if (event.type !== "session.updated" || !isRecord(event.session)) return null;
  const instructions =
    typeof event.session.instructions === "string" ? event.session.instructions : "";
  const tools = Array.isArray(event.session.tools) ? event.session.tools : [];
  const acknowledgedToolNames = tools.flatMap((candidate) =>
    isRecord(candidate) && typeof candidate.name === "string" ? [candidate.name] : [],
  );

  return {
    promptLoaded: instructions.includes(HOTEL_AGENT_PROMPT_VERSION),
    promptVersion: HOTEL_AGENT_PROMPT_VERSION,
    acknowledgedToolNames,
    missingTools: HOTEL_TOOL_NAMES.filter(
      (toolName) => !acknowledgedToolNames.includes(toolName),
    ),
  };
}
