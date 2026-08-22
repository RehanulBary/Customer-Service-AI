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

  // The Realtime API emits `session.updated` multiple times during a session's
  // lifetime: once for the bare session (no tools, no instructions), and again
  // after our `session.update` carrying tools + instructions reaches the server.
  // We only want to act on a fully-loaded session; otherwise we'd report a
  // false "missing tools" error against the bare session.
  const looksComplete =
    instructions.length > 0 && acknowledgedToolNames.length > 0;
  if (!looksComplete) return null;

  return {
    promptLoaded: instructions.includes(HOTEL_AGENT_PROMPT_VERSION),
    promptVersion: HOTEL_AGENT_PROMPT_VERSION,
    acknowledgedToolNames,
    missingTools: HOTEL_TOOL_NAMES.filter(
      (toolName) => !acknowledgedToolNames.includes(toolName),
    ),
  };
}

/**
 * Verifies the live `initialSession` config returned by `RealtimeSession.connect()`
 * carries the versioned prompt and the full 7-tool contract.
 *
 * Unlike `inspectSessionAcknowledgement` (which listens to `session.updated`
 * transport events), this operates on the SDK's `InitialSessionConfig` object
 * so we can fail loud *before* the first user utterance if OpenAI returned a
 * session with tools or instructions stripped out.
 */
export function verifyInitialSessionConfig(config: unknown): SessionAcknowledgement {
  if (!isRecord(config)) {
    return {
      promptLoaded: false,
      promptVersion: HOTEL_AGENT_PROMPT_VERSION,
      acknowledgedToolNames: [],
      missingTools: [...HOTEL_TOOL_NAMES],
    };
  }
  const instructions = typeof config.instructions === "string" ? config.instructions : "";
  const tools = Array.isArray(config.tools) ? config.tools : [];
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
