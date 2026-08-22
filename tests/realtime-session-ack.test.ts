import { describe, expect, it } from "vitest";
import {
  HOTEL_AGENT_PROMPT_VERSION,
  buildHotelReceptionistInstructions,
} from "@/agents/hotelPrompt";
import { HOTEL_TOOL_NAMES } from "@/lib/hotel/tool-names";
import { inspectSessionAcknowledgement } from "@/lib/realtime/session-acknowledgement";

describe("realtime session acknowledgement", () => {
  it("accepts the expected prompt version and complete tool list", () => {
    const result = inspectSessionAcknowledgement({
      type: "session.updated",
      session: {
        instructions: buildHotelReceptionistInstructions(
          new Date("2026-08-13T10:00:00.000Z"),
        ),
        tools: HOTEL_TOOL_NAMES.map((name) => ({ type: "function", name })),
      },
    });

    expect(result).toEqual({
      promptLoaded: true,
      promptVersion: HOTEL_AGENT_PROMPT_VERSION,
      acknowledgedToolNames: [...HOTEL_TOOL_NAMES],
      missingTools: [],
    });
  });

  it("detects an unversioned prompt and missing write tool", () => {
    const result = inspectSessionAcknowledgement({
      type: "session.updated",
      session: {
        instructions: "You are helpful.",
        tools: [{ type: "function", name: "search_room_availability" }],
      },
    });

    expect(result?.promptLoaded).toBe(false);
    expect(result?.missingTools).toContain("create_reservation");
  });

  it("ignores the bare pre-config session.updated event to avoid a race", () => {
    // OpenAI emits `session.updated` once for the freshly-created bare session
    // (no instructions, no tools) and again after our `session.update` carries
    // the full prompt + tool list. We must not report missing tools against the
    // bare event.
    const bare = inspectSessionAcknowledgement({
      type: "session.updated",
      session: { tools: [], instructions: "" },
    });
    expect(bare).toBeNull();
  });
});
