import { describe, expect, it } from "vitest";
import {
  calculateAvailability,
  roomsBookedForStay,
} from "@/lib/hotel/availability";
import { dateRangesOverlap, nightsBetween } from "@/lib/hotel/dates";
import type { Reservation, Room } from "@/lib/hotel/schemas";

const rooms: Room[] = [
  {
    id: "standard-queen",
    name: "Standard Queen",
    description: "A quiet standard room.",
    capacity: 2,
    beds: "1 queen bed",
    pricePerNight: 7_200,
    currency: "BDT",
    totalRooms: 2,
    amenities: ["Wi-Fi", "rain shower"],
    viewOptions: ["courtyard", "city"],
    connectingAvailable: false,
  },
  {
    id: "deluxe-twin",
    name: "Deluxe Twin",
    description: "A larger room for a small family.",
    capacity: 3,
    beds: "2 single beds",
    pricePerNight: 8_500,
    currency: "BDT",
    totalRooms: 2,
    amenities: ["Wi-Fi", "minibar"],
    viewOptions: ["city"],
    connectingAvailable: true,
  },
];

const baseReservation: Reservation = {
  confirmationNumber: "SGH-11111",
  guestName: "Test Guest",
  phone: "+8801711002200",
  checkInDate: "2026-09-10",
  checkOutDate: "2026-09-12",
  adults: 2,
  children: 0,
  roomType: "standard-queen",
  roomCount: 1,
  preferences: [],
  specialRequests: [],
  status: "confirmed",
  pricePerNight: 7_200,
  totalAmount: 14_400,
  currency: "BDT",
  createdAt: "2026-08-13T10:00:00.000Z",
  updatedAt: "2026-08-13T10:00:00.000Z",
};

describe("date calculations", () => {
  it("uses half-open ranges so a same-day turnover does not overlap", () => {
    expect(dateRangesOverlap("2026-09-08", "2026-09-10", "2026-09-10", "2026-09-12")).toBe(false);
    expect(dateRangesOverlap("2026-09-09", "2026-09-11", "2026-09-10", "2026-09-12")).toBe(true);
  });

  it("calculates nights using calendar dates", () => {
    expect(nightsBetween("2026-12-31", "2027-01-02")).toBe(2);
  });
});

describe("availability", () => {
  it("subtracts overlapping active reservations and ignores cancelled stays", () => {
    const cancelled = { ...baseReservation, confirmationNumber: "SGH-22222", status: "cancelled" as const };
    expect(
      roomsBookedForStay("standard-queen", "2026-09-11", "2026-09-13", [baseReservation, cancelled]),
    ).toBe(1);
    expect(
      roomsBookedForStay("standard-queen", "2026-09-12", "2026-09-13", [baseReservation]),
    ).toBe(0);
  });

  it("derives enough rooms for capacity and calculates the complete stay price", () => {
    const result = calculateAvailability(rooms, [], {
      checkInDate: "2026-09-10",
      checkOutDate: "2026-09-13",
      adults: 2,
      children: 2,
      preferences: ["city view"],
    });
    const standard = result.options.find((option) => option.roomTypeId === "standard-queen");
    expect(standard).toMatchObject({
      roomCount: 2,
      nightlyTotal: 14_400,
      numberOfNights: 3,
      estimatedTotal: 43_200,
    });
  });

  it("rejects an explicitly insufficient room count", () => {
    const result = calculateAvailability(rooms, [], {
      checkInDate: "2026-09-10",
      checkOutDate: "2026-09-11",
      adults: 2,
      children: 1,
      roomCount: 1,
      preferredRoomType: "standard queen",
    });
    expect(result.options).toHaveLength(0);
  });

  it("filters against combined nightly budget and preferred view", () => {
    const result = calculateAvailability(rooms, [], {
      checkInDate: "2026-09-10",
      checkOutDate: "2026-09-11",
      adults: 2,
      children: 0,
      maxBudget: 8_000,
      preferredView: "courtyard",
    });
    expect(result.options.map((option) => option.roomTypeId)).toEqual(["standard-queen"]);
  });

  it("returns no option when required inventory is exhausted", () => {
    const result = calculateAvailability(
      rooms,
      [{ ...baseReservation, roomCount: 2 }],
      {
        checkInDate: "2026-09-10",
        checkOutDate: "2026-09-11",
        adults: 2,
        children: 0,
        preferredRoomType: "standard queen",
      },
    );
    expect(result.options).toEqual([]);
  });
});
