import { describe, expect, it } from "vitest";
import {
  CreateReservationInputSchema,
  LookupReservationInputSchema,
  SearchAvailabilityInputSchema,
} from "@/lib/hotel/schemas";

describe("tool input validation", () => {
  it("rejects malformed and impossible dates", () => {
    expect(
      SearchAvailabilityInputSchema.safeParse({
        checkInDate: "tomorrow",
        checkOutDate: "2026-02-30",
        adults: 2,
        children: 0,
      }).success,
    ).toBe(false);
  });

  it("rejects checkout before check-in", () => {
    expect(
      SearchAvailabilityInputSchema.safeParse({
        checkInDate: "2026-09-12",
        checkOutDate: "2026-09-10",
        adults: 2,
        children: 0,
      }).success,
    ).toBe(false);
  });

  it("requires explicit confirmation before creating a booking", () => {
    expect(
      CreateReservationInputSchema.safeParse({
        guestName: "Test Guest",
        phone: "+8801711002200",
        checkInDate: "2026-09-10",
        checkOutDate: "2026-09-11",
        adults: 1,
        children: 0,
        roomType: "standard-queen",
        roomCount: 1,
        confirmed: false,
      }).success,
    ).toBe(false);
  });

  it("requires at least one lookup identifier", () => {
    expect(LookupReservationInputSchema.safeParse({}).success).toBe(false);
  });
});
