import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { HotelError } from "@/lib/hotel/errors";
import type { Room } from "@/lib/hotel/schemas";
import { createTestContext } from "./helpers";

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
});

const booking = {
  guestName: "Rehanul Bary",
  phone: "+880 1712 345 678",
  checkInDate: "2026-09-10",
  checkOutDate: "2026-09-13",
  adults: 2,
  children: 2,
  roomType: "family-suite",
  roomCount: 1,
  preferences: ["city view"],
  specialRequests: ["arrival around 8 PM"],
  confirmed: true as const,
};

describe("reservation operations", () => {
  it("creates and atomically persists a priced reservation", async () => {
    const context = await createTestContext();
    cleanups.push(context.cleanup);

    const result = await context.service.createReservation(booking);
    expect(result).toMatchObject({
      status: "confirmed",
      confirmationNumber: "SGH-28417",
      reservation: {
        roomTypeName: "Family Suite",
        nightlyTotal: 14_500,
        numberOfNights: 3,
        totalAmount: 43_500,
      },
    });

    const persisted = await context.repository.getReservations();
    expect(persisted.at(-1)).toMatchObject({
      confirmationNumber: "SGH-28417",
      guestName: "Rehanul Bary",
      phone: "+8801712345678",
      status: "confirmed",
    });
  });

  it("modifies dates and room type after rechecking inventory and repricing", async () => {
    const context = await createTestContext();
    cleanups.push(context.cleanup);
    await context.service.createReservation(booking);

    const result = await context.service.modifyReservation({
      confirmationNumber: "SGH-28417",
      changes: {
        checkOutDate: "2026-09-12",
        roomType: "deluxe-twin",
        roomCount: 2,
      },
      confirmed: true,
    });

    expect(result.reservation).toMatchObject({
      roomTypeName: "Deluxe Twin",
      roomCount: 2,
      numberOfNights: 2,
      nightlyTotal: 17_000,
      totalAmount: 34_000,
    });
  });

  it("cancels without deleting booking history", async () => {
    const context = await createTestContext();
    cleanups.push(context.cleanup);
    await context.service.createReservation(booking);

    const result = await context.service.cancelReservation({
      confirmationNumber: "SGH-28417",
      reason: "Plans changed",
      confirmed: true,
    });
    expect(result.status).toBe("cancelled");
    expect(result.cancellationPolicy).toContain("two calendar days");

    const stored = await context.repository.getReservations();
    expect(stored.find((item) => item.confirmationNumber === "SGH-28417")).toMatchObject({
      status: "cancelled",
      cancellationReason: "Plans changed",
    });
  });

  it("does not reveal reservations using a guest name alone", async () => {
    const context = await createTestContext();
    cleanups.push(context.cleanup);
    await expect(
      context.service.lookupReservation({ guestName: "Nadia Rahman" }),
    ).rejects.toMatchObject({ code: "VERIFICATION_REQUIRED" });
  });

  it("rejects a booking after inventory is exhausted", async () => {
    let confirmation = 30_001;
    const context = await createTestContext({ confirmationNumber: () => confirmation++ });
    cleanups.push(context.cleanup);

    const roomsPath = path.join(context.dataDirectory, "rooms.json");
    const rooms = JSON.parse(await readFile(roomsPath, "utf8")) as Room[];
    const familySuite = rooms.find((room) => room.id === "family-suite");
    if (!familySuite) throw new Error("Fixture room not found");
    familySuite.totalRooms = 1;
    await writeFile(roomsPath, JSON.stringify(rooms, null, 2));

    await context.service.createReservation(booking);
    await expect(
      context.service.createReservation({ ...booking, guestName: "Second Guest" }),
    ).rejects.toMatchObject({ code: "ROOM_UNAVAILABLE" });
  });

  it("serializes competing writes so only available inventory can be booked", async () => {
    let confirmation = 31_001;
    const context = await createTestContext({ confirmationNumber: () => confirmation++ });
    cleanups.push(context.cleanup);

    const roomsPath = path.join(context.dataDirectory, "rooms.json");
    const rooms = JSON.parse(await readFile(roomsPath, "utf8")) as Room[];
    const familySuite = rooms.find((room) => room.id === "family-suite");
    if (!familySuite) throw new Error("Fixture room not found");
    familySuite.totalRooms = 1;
    await writeFile(roomsPath, JSON.stringify(rooms, null, 2));

    const attempts = await Promise.allSettled([
      context.service.createReservation({ ...booking, guestName: "First Guest" }),
      context.service.createReservation({ ...booking, guestName: "Second Guest" }),
    ]);
    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.status === "rejected")).toHaveLength(1);
  });

  it("surfaces malformed JSON as a safe data error", async () => {
    const context = await createTestContext();
    cleanups.push(context.cleanup);
    await writeFile(path.join(context.dataDirectory, "reservations.json"), "{not-json");

    await expect(context.repository.getReservations()).rejects.toEqual(
      expect.objectContaining<Partial<HotelError>>({ code: "DATA_CORRUPT", retryable: true }),
    );
  });

  it("restores seed reservations through the demo reset", async () => {
    const context = await createTestContext();
    cleanups.push(context.cleanup);
    await context.service.createReservation(booking);
    const reset = await context.service.resetDemoData();
    expect(reset).toMatchObject({ reset: true, reservationCount: 4 });
    expect(await context.repository.getReservations()).toHaveLength(4);
  });
});
