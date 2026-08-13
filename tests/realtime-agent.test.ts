import { RealtimeSession } from "@openai/agents/realtime";
import { describe, expect, it } from "vitest";
import { createHotelReceptionistAgent } from "@/agents/hotelReceptionist";
import { HOTEL_AGENT_PROMPT_VERSION } from "@/agents/hotelPrompt";
import type { HotelToolExecutor } from "@/agents/remoteTools";

describe("realtime agent configuration", () => {
  it("produces a current SDK session configuration with all semantic tools", async () => {
    const agent = createHotelReceptionistAgent("marin");
    const config = await RealtimeSession.computeInitialSessionConfig(agent, {
      model: "gpt-realtime-2.1",
      config: {
        outputModalities: ["audio"],
        reasoning: { effort: "low" },
        audio: {
          input: {
            turnDetection: {
              type: "semantic_vad",
              createResponse: true,
              interruptResponse: true,
            },
          },
          output: { voice: "marin" },
        },
      },
    });

    expect(config.model).toBe("gpt-realtime-2.1");
    expect(
      (config as typeof config & { outputModalities?: string[] }).outputModalities,
    ).toEqual(["audio"]);
    expect(config.reasoning).toEqual({ effort: "low" });
    expect(config.instructions).toContain("Shapla Grand Hotel");
    expect(config.instructions).toContain(HOTEL_AGENT_PROMPT_VERSION);
    expect(config.instructions).toContain(
      "CALL THE WRITE TOOL NOW AS THE NEXT ACTION IN THE SAME TURN",
    );
    expect(config.tools).toHaveLength(7);
    expect(config.tools?.map((tool) => "name" in tool && tool.name)).toEqual([
      "get_hotel_information",
      "search_room_availability",
      "lookup_reservation",
      "create_reservation",
      "modify_reservation",
      "cancel_reservation",
      "escalate_to_human",
    ]);

    const createTool = config.tools?.find(
      (candidate) => "name" in candidate && candidate.name === "create_reservation",
    );
    expect(createTool && "parameters" in createTool ? createTool.parameters : null).toMatchObject({
      type: "object",
      additionalProperties: false,
      properties: {
        confirmed: { const: true },
      },
    });
  });

  it("executes the browser booking tool and returns its structured result", async () => {
    const calls: Array<{ name: string; input: unknown }> = [];
    const execute: HotelToolExecutor = async (name, input) => {
      calls.push({ name, input });
      return {
        ok: true,
        data: {
          status: "confirmed",
          confirmationNumber: "SGH-28417",
        },
      };
    };
    const agent = createHotelReceptionistAgent("marin", execute);
    const bookingTool = agent.tools.find(
      (candidate) => candidate.type === "function" && candidate.name === "create_reservation",
    );

    expect(bookingTool?.type).toBe("function");
    if (!bookingTool || bookingTool.type !== "function") return;

    const output = await bookingTool.invoke(
      {} as never,
      JSON.stringify({
        guestName: "Rehanul Bary",
        phone: "+8801712345678",
        email: null,
        checkInDate: "2026-08-20",
        checkOutDate: "2026-08-22",
        adults: 2,
        children: 0,
        roomType: "deluxe-king",
        roomCount: 1,
        preferences: ["city view"],
        specialRequests: null,
        confirmed: true,
      }),
    );

    expect(calls).toEqual([
      {
        name: "create_reservation",
        input: {
          guestName: "Rehanul Bary",
          phone: "+8801712345678",
          email: null,
          checkInDate: "2026-08-20",
          checkOutDate: "2026-08-22",
          adults: 2,
          children: 0,
          roomType: "deluxe-king",
          roomCount: 1,
          preferences: ["city view"],
          specialRequests: null,
          confirmed: true,
        },
      },
    ]);
    expect(output).toMatchObject({
      ok: true,
      data: { status: "confirmed", confirmationNumber: "SGH-28417" },
    });
  });
});
