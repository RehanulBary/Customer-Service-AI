import { NextResponse } from "next/server";
import { z } from "zod";
import { failure, HotelError, toHotelError } from "@/lib/hotel/errors";

const MAX_JSON_BYTES = 32_768;

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  const fetchSite = request.headers.get("sec-fetch-site");

  if (fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite)) {
    throw new HotelError("INVALID_INPUT", "Cross-site requests are not allowed.", 403);
  }

  if (origin && host) {
    try {
      if (new URL(origin).host !== host) {
        throw new HotelError("INVALID_INPUT", "Request origin is not allowed.", 403);
      }
    } catch (error) {
      if (error instanceof HotelError) throw error;
      throw new HotelError("INVALID_INPUT", "Request origin is invalid.", 403);
    }
  }
}

export async function readJsonBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new HotelError("INVALID_INPUT", "Content-Type must be application/json.", 415);
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BYTES) {
    throw new HotelError("INVALID_INPUT", "Request body is too large.", 413);
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_JSON_BYTES) {
    throw new HotelError("INVALID_INPUT", "Request body is too large.", 413);
  }

  try {
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new HotelError("INVALID_INPUT", "Request body must be a JSON object.", 422);
    }
    return value;
  } catch (error) {
    if (error instanceof HotelError) throw error;
    throw new HotelError("INVALID_INPUT", "Request body contains malformed JSON.", 400);
  }
}

export function apiErrorResponse(error: unknown): NextResponse {
  const hotelError =
    error instanceof z.ZodError
      ? new HotelError(
          "INVALID_INPUT",
          error.issues[0]?.message ?? "Some supplied information is invalid.",
          422,
        )
      : toHotelError(error);

  if (hotelError.status >= 500 && process.env.NODE_ENV !== "test") {
    console.error(`[api] ${hotelError.code}:`, error);
  }

  return NextResponse.json(failure(hotelError), {
    status: hotelError.status,
    headers: { "Cache-Control": "no-store" },
  });
}
