import { NextResponse } from "next/server";
import { z } from "zod";
import { success, HotelError } from "@/lib/hotel/errors";
import { apiErrorResponse, assertSameOrigin } from "@/lib/server/http";
import { getRealtimeServerConfig } from "@/lib/server/realtime-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ClientSecretResponseSchema = z
  .object({
    value: z.string().startsWith("ek_"),
    expires_at: z.number().optional(),
  })
  .passthrough();

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { apiKey, model, voice } = getRealtimeServerConfig();
    const upstream = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session: {
          type: "realtime",
          model,
          audio: {
            output: { voice },
          },
        },
      }),
      cache: "no-store",
    });

    if (!upstream.ok) {
      const details = await upstream.text();
      if (process.env.NODE_ENV === "development") {
        console.error(
          `[realtime] Client secret request failed (${upstream.status}): ${details.slice(0, 500)}`,
        );
      }
      throw new HotelError(
        "UPSTREAM_ERROR",
        upstream.status === 401 || upstream.status === 403
          ? "OpenAI authentication failed. Check the server API key and project access."
          : "The realtime voice service could not start a session. Please try again.",
        upstream.status === 401 || upstream.status === 403 ? 502 : 503,
        upstream.status >= 500 || upstream.status === 429,
      );
    }

    const payload = ClientSecretResponseSchema.parse(await upstream.json());
    return NextResponse.json(
      success({
        clientSecret: payload.value,
        expiresAt: payload.expires_at ?? null,
        model,
        voice,
      }),
      { headers: { "Cache-Control": "no-store, private" } },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
