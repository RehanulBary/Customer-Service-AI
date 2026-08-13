"use client";

import { tool } from "@openai/agents/realtime";
import type { ApiResult } from "@/lib/hotel/errors";
import type { HotelToolName } from "@/lib/hotel/tool-names";
import {
  CancelReservationInputSchema,
  CreateReservationInputSchema,
  EscalateToHumanInputSchema,
  HotelInformationInputSchema,
  LookupReservationInputSchema,
  ModifyReservationInputSchema,
  SearchAvailabilityInputSchema,
} from "@/lib/hotel/schemas";

export type HotelToolExecutor = (
  name: HotelToolName,
  input: unknown,
  signal?: AbortSignal,
) => Promise<ApiResult<unknown>>;

const browserHotelToolExecutor: HotelToolExecutor = async (name, input, signal) => {
  try {
    const response = await fetch(`/api/hotel/tools/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      cache: "no-store",
      signal,
    });
    const payload = (await response.json()) as ApiResult<unknown>;
    if (payload && typeof payload === "object" && "ok" in payload) return payload;
    return {
      ok: false,
      error: {
        code: "UPSTREAM_ERROR",
        message: "The hotel system returned an unexpected response.",
        retryable: true,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UPSTREAM_ERROR",
        message:
          error instanceof DOMException && error.name === "AbortError"
            ? "The hotel request was interrupted."
            : "The hotel system is temporarily unreachable.",
        retryable: true,
      },
    };
  }
};

export function createHotelTools(
  executeHotelTool: HotelToolExecutor = browserHotelToolExecutor,
) {
  return [
    tool({
      name: "get_hotel_information",
      description:
        "READ-ONLY. Retrieve authoritative fictional hotel facts. Call immediately for policies, facilities, location, check-in/out, breakfast, parking, Wi-Fi, restaurant, airport pickup, pool, gym, smoking, children, pets, payments, landmarks, accessibility, or room-number guarantees. Input: a short topic. Success data contains matching facts and FAQs; if absent, say the detail is not represented instead of guessing.",
      parameters: HotelInformationInputSchema,
      execute: (input, _context, details) =>
        executeHotelTool("get_hotel_information", input, details?.signal),
    }),
    tool({
      name: "search_room_availability",
      description:
        "READ-ONLY AND REQUIRED FOR EVERY ROOM SEARCH. Call as soon as check-in date, check-out date, adults, and children are known, before quoting availability or price. Pass null for optional filters not supplied. Success data.options contains exact roomTypeId, roomCount, capacity, availableRooms, nightlyTotal, numberOfNights, estimatedTotal, BDT currency, amenities, views, and preference matches. Retain the selected option's exact IDs and totals for booking. Re-run after dates, guests, room count, room type, view, or budget change.",
      parameters: SearchAvailabilityInputSchema,
      execute: (input, _context, details) =>
        executeHotelTool("search_room_availability", input, details?.signal),
    }),
    tool({
      name: "lookup_reservation",
      description:
        "READ-ONLY. Look up an existing reservation before revealing its status or details, modifying it, or cancelling it. Use a confirmation number or verified phone, optionally with guest name; pass null for identifiers not supplied. A guest name alone is insufficient. Success data.matches contains only verified matching reservations.",
      parameters: LookupReservationInputSchema,
      execute: (input, _context, details) =>
        executeHotelTool("lookup_reservation", input, details?.signal),
    }),
    tool({
      name: "create_reservation",
      description:
        "WRITE ACTION. Persist a real JSON-backed reservation and recheck availability atomically. Call immediately after the caller explicitly confirms the complete latest booking summary. Required: guestName, phone, ISO dates, adults, children, exact roomType and roomCount from search, and confirmed=true; pass null for optional email, preferences, and specialRequests when absent. Success data contains status=confirmed, confirmationNumber, and the persisted reservation. Never claim confirmation unless ok=true.",
      parameters: CreateReservationInputSchema,
      execute: (input, _context, details) =>
        executeHotelTool("create_reservation", input, details?.signal),
    }),
    tool({
      name: "modify_reservation",
      description:
        "WRITE ACTION. Persist confirmed changes to an active reservation and atomically recheck inventory, capacity, and price. Call immediately after lookup, a spoken summary of material changes, and the caller's explicit yes. Supply only changed fields inside changes and confirmed=true. Success data contains status=modified and the updated reservation; never claim an update unless ok=true.",
      parameters: ModifyReservationInputSchema,
      execute: (input, _context, details) =>
        executeHotelTool("modify_reservation", input, details?.signal),
    }),
    tool({
      name: "cancel_reservation",
      description:
        "WRITE ACTION. Mark a reservation cancelled while retaining history. Call immediately after verified lookup, explaining the cancellation policy, and receiving explicit cancellation confirmation. Use the exact confirmationNumber and confirmed=true; reason may be null. Success data contains status=cancelled. Never claim cancellation unless ok=true.",
      parameters: CancelReservationInputSchema,
      execute: (input, _context, details) =>
        executeHotelTool("cancel_reservation", input, details?.signal),
    }),
    tool({
      name: "escalate_to_human",
      description:
        "WRITE-LIKE SIMULATION. Queue a human hotel team request immediately for an explicit human or manager request, emergency, safety issue, payment dispute, lost-property investigation, serious complaint, unsupported request, repeated tool failure, or uncertain high-impact action. Success data identifies the queued department and makes clear that no live transfer occurred.",
      parameters: EscalateToHumanInputSchema,
      execute: (input, _context, details) =>
        executeHotelTool("escalate_to_human", input, details?.signal),
    }),
  ];
}
