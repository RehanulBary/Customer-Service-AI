import { describe, expect, it } from "vitest";
import { POST as runHotelTool } from "@/app/api/hotel/tools/[tool]/route";
import { GET as getAgentConfiguration } from "@/app/api/admin/agent-config/route";

function request(body: string, headers: HeadersInit = {}) {
  return new Request("http://localhost:3000/api/hotel/tools/search_room_availability", {
    method: "POST",
    body,
    headers: {
      "content-type": "application/json",
      host: "localhost:3000",
      ...headers,
    },
  });
}

describe("hotel tool route", () => {
  it("rejects cross-origin business operations with a safe error envelope", async () => {
    const response = await runHotelTool(
      request("{}", { origin: "https://example.test" }),
      { params: Promise.resolve({ tool: "search_room_availability" }) },
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      ok: false,
      error: {
        code: "INVALID_INPUT",
        message: "Request origin is not allowed.",
        retryable: false,
      },
    });
  });

  it("rejects malformed JSON without exposing implementation details", async () => {
    const response = await runHotelTool(request("{not-json"), {
      params: Promise.resolve({ tool: "search_room_availability" }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      ok: false,
      error: {
        code: "INVALID_INPUT",
        message: "Request body contains malformed JSON.",
        retryable: false,
      },
    });
  });

  it("rejects tool names outside the explicit allowlist", async () => {
    const response = await runHotelTool(request("{}"), {
      params: Promise.resolve({ tool: "arbitrary_action" }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: { code: "INVALID_INPUT", message: "Unknown hotel tool." },
    });
  });
});

describe("agent configuration route", () => {
  it("reports that the dedicated instructions and all hotel tools are loaded", async () => {
    const previousKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "test-server-key";
    try {
      const response = await getAgentConfiguration();
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload).toMatchObject({
        ok: true,
        data: {
          promptVersion: "shapla-receptionist-v2.3",
          promptLoaded: true,
          model: "gpt-realtime-2.1",
        },
      });
      expect(payload.data.instructionCharacters).toBeGreaterThan(1_500);
      // Sanity cap: the v2.3 rewrite is intentionally tight (<5k chars).
      // If this fails, the prompt has grown back to the long-form hedging style.
      expect(payload.data.instructionCharacters).toBeLessThan(6_000);
      expect(payload.data.tools).toHaveLength(7);
      expect(payload.data.tools.every((tool: { loaded: boolean }) => tool.loaded)).toBe(true);
    } finally {
      if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = previousKey;
    }
  });
});
