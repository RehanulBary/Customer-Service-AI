import { randomInt } from "node:crypto";
import { calculateAvailability, type AvailabilityResult } from "./availability";
import { dateInTimeZone, nightsBetween } from "./dates";
import { HotelError } from "./errors";
import { JsonHotelRepository, getHotelRepository } from "./repository";
import {
  CancelReservationInputSchema,
  CreateReservationInputSchema,
  EscalateToHumanInputSchema,
  HotelInformationInputSchema,
  LookupReservationInputSchema,
  ModifyReservationInputSchema,
  ReservationSchema,
  SearchAvailabilityInputSchema,
  type CancelReservationInput,
  type CreateReservationInput,
  type EscalateToHumanInput,
  type HotelInformationInput,
  type LookupReservationInput,
  type ModifyReservationInput,
  type Reservation,
  type Room,
  type SearchAvailabilityInput,
} from "./schemas";

function normalizeWords(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizePhone(value: string): string {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) {
    throw new HotelError(
      "INVALID_INPUT",
      "That phone number does not appear to be valid. Please check the digits.",
      422,
    );
  }
  return trimmed.startsWith("+") ? `+${digits}` : digits;
}

function phonesMatch(first: string, second: string): boolean {
  const a = first.replace(/\D/g, "");
  const b = second.replace(/\D/g, "");
  return a === b || (a.length >= 10 && b.length >= 10 && a.slice(-10) === b.slice(-10));
}

function namesMatch(first: string, second: string): boolean {
  return normalizeWords(first) === normalizeWords(second);
}

function omitNullish<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== null && entry !== undefined),
  );
}

function findRoom(rooms: Room[], requested: string): Room {
  const needle = normalizeWords(requested);
  const exact = rooms.find(
    (room) => normalizeWords(room.id) === needle || normalizeWords(room.name) === needle,
  );
  if (exact) return exact;

  const fuzzy = rooms.filter((room) => {
    const id = normalizeWords(room.id);
    const name = normalizeWords(room.name);
    return id.includes(needle) || name.includes(needle) || needle.includes(name);
  });
  if (fuzzy.length === 1) return fuzzy[0];

  throw new HotelError(
    "ROOM_NOT_FOUND",
    "That room type is not in the hotel inventory. Please search availability again.",
    404,
  );
}

function summarizeReservation(reservation: Reservation, room: Room) {
  return {
    confirmationNumber: reservation.confirmationNumber,
    guestName: reservation.guestName,
    phone: reservation.phone,
    email: reservation.email,
    checkInDate: reservation.checkInDate,
    checkOutDate: reservation.checkOutDate,
    numberOfNights: nightsBetween(reservation.checkInDate, reservation.checkOutDate),
    adults: reservation.adults,
    children: reservation.children,
    roomTypeId: reservation.roomType,
    roomTypeName: room.name,
    roomCount: reservation.roomCount,
    preferences: reservation.preferences,
    specialRequests: reservation.specialRequests,
    status: reservation.status,
    nightlyTotal: reservation.pricePerNight,
    totalAmount: reservation.totalAmount,
    currency: reservation.currency,
    createdAt: reservation.createdAt,
    updatedAt: reservation.updatedAt,
    cancelledAt: reservation.cancelledAt,
    cancellationReason: reservation.cancellationReason,
  };
}

type ServiceOptions = {
  clock?: () => Date;
  confirmationNumber?: () => number;
};

export class HotelService {
  private readonly clock: () => Date;
  private readonly confirmationNumber: () => number;

  constructor(
    private readonly repository: JsonHotelRepository,
    options: ServiceOptions = {},
  ) {
    this.clock = options.clock ?? (() => new Date());
    this.confirmationNumber = options.confirmationNumber ?? (() => randomInt(10_000, 100_000));
  }

  async getHotelInformation(rawInput: HotelInformationInput) {
    const input = HotelInformationInputSchema.parse(rawInput);
    const hotel = await this.repository.getHotel();
    const topic = normalizeWords(input.topic);
    const words = topic.split(" ").filter(Boolean);
    const aliases: Record<string, string[]> = {
      check_in: ["check in", "arrival", "early check in"],
      check_out: ["check out", "departure", "late check out"],
      wifi: ["wi fi", "internet"],
      children: ["child", "children", "kids", "family"],
      pets: ["pet", "pets", "animal"],
      cancellation: ["cancel", "cancellation", "refund"],
      payment: ["pay", "payment", "card", "cash"],
      airport_pickup: ["airport", "pickup", "transfer"],
      room_assignment: ["room number", "specific room", "room assignment"],
    };

    const scoredFacts = Object.entries(hotel.information)
      .map(([key, value]) => {
        const haystack = normalizeWords(
          [key, value, ...(aliases[key] ?? [])].join(" "),
        );
        const score = words.reduce(
          (total, word) => total + (haystack.includes(word) ? 1 : 0),
          0,
        );
        return { key, value, score };
      })
      .filter((fact) => fact.score > 0)
      .sort((a, b) => b.score - a.score);

    const faqMatches = hotel.faqs.filter((faq) => {
      const haystack = normalizeWords(`${faq.question} ${faq.answer}`);
      return words.some((word) => haystack.includes(word));
    });
    const landmarkMatches = hotel.nearbyLandmarks.filter((landmark) => {
      const haystack = normalizeWords(`${landmark.name} ${landmark.distance}`);
      return topic.includes("landmark") || words.some((word) => haystack.includes(word));
    });

    const generalTopic = ["hotel", "overview", "general", "contact", "address"].some((word) =>
      topic.includes(word),
    );
    const facts = scoredFacts.slice(0, 4).map(({ key, value }) => ({
      topic: key,
      information: value,
    }));

    if (facts.length === 0 && generalTopic) {
      facts.push(
        { topic: "description", information: hotel.description },
        {
          topic: "address",
          information: `${hotel.address.street}, ${hotel.address.area}, ${hotel.address.city} ${hotel.address.postalCode}, ${hotel.address.country}.`,
        },
        { topic: "phone", information: hotel.phone },
      );
    }

    return {
      hotelName: hotel.name,
      requestedTopic: input.topic,
      facts,
      nearbyLandmarks: landmarkMatches.slice(0, 4),
      faqs: faqMatches.slice(0, 3),
      message:
        facts.length || landmarkMatches.length || faqMatches.length
          ? "Hotel information found."
          : "That detail is not represented in the fictional hotel data. Offer to ask the front desk rather than guessing.",
    };
  }

  async searchRoomAvailability(rawInput: SearchAvailabilityInput): Promise<AvailabilityResult> {
    const input = SearchAvailabilityInputSchema.parse(rawInput);
    this.assertBookableDates(input.checkInDate, input.checkOutDate);
    const [rooms, reservations] = await Promise.all([
      this.repository.getRooms(),
      this.repository.getReservations(),
    ]);
    return calculateAvailability(rooms, reservations, input);
  }

  async createReservation(rawInput: CreateReservationInput) {
    const input = CreateReservationInputSchema.parse(omitNullish(rawInput));
    this.assertBookableDates(input.checkInDate, input.checkOutDate);
    const rooms = await this.repository.getRooms();
    const room = findRoom(rooms, input.roomType);
    const phone = normalizePhone(input.phone);

    return this.repository.mutateReservations((reservations) => {
      const availability = calculateAvailability(rooms, reservations, {
        checkInDate: input.checkInDate,
        checkOutDate: input.checkOutDate,
        adults: input.adults,
        children: input.children,
        roomCount: input.roomCount,
        preferredRoomType: room.id,
        preferences: input.preferences ?? undefined,
      });
      const option = availability.options.find((candidate) => candidate.roomTypeId === room.id);
      if (!option) {
        throw new HotelError(
          "ROOM_UNAVAILABLE",
          "That room is no longer available for the requested stay. Please search again.",
          409,
        );
      }

      let confirmationNumber = "";
      const existing = new Set(reservations.map((reservation) => reservation.confirmationNumber));
      for (let attempt = 0; attempt < 50; attempt += 1) {
        const candidate = `SGH-${String(this.confirmationNumber()).padStart(5, "0")}`;
        if (!existing.has(candidate)) {
          confirmationNumber = candidate;
          break;
        }
      }
      if (!confirmationNumber) {
        throw new HotelError(
          "WRITE_FAILED",
          "A confirmation number could not be generated. Please try again.",
          500,
          true,
        );
      }

      const now = this.clock().toISOString();
      const reservation = ReservationSchema.parse({
        confirmationNumber,
        guestName: input.guestName,
        phone,
        email: input.email,
        checkInDate: input.checkInDate,
        checkOutDate: input.checkOutDate,
        adults: input.adults,
        children: input.children,
        roomType: room.id,
        roomCount: input.roomCount,
        preferences: input.preferences ?? [],
        specialRequests: input.specialRequests ?? [],
        status: "confirmed",
        pricePerNight: option.nightlyTotal,
        totalAmount: option.estimatedTotal,
        currency: "BDT",
        createdAt: now,
        updatedAt: now,
      });

      return {
        reservations: [...reservations, reservation],
        result: {
          status: "confirmed" as const,
          confirmationNumber,
          reservation: summarizeReservation(reservation, room),
          message: "Reservation created successfully. It is now safe to tell the caller they are confirmed.",
        },
      };
    });
  }

  async lookupReservation(rawInput: LookupReservationInput) {
    const input = LookupReservationInputSchema.parse(omitNullish(rawInput));
    if (input.guestName && !input.phone && !input.confirmationNumber) {
      throw new HotelError(
        "VERIFICATION_REQUIRED",
        "A guest name alone is not enough. Ask for the booking phone number or confirmation number.",
        422,
      );
    }

    const [reservations, rooms] = await Promise.all([
      this.repository.getReservations(),
      this.repository.getRooms(),
    ]);
    const confirmation = input.confirmationNumber?.toUpperCase();
    const matches = reservations.filter((reservation) => {
      if (confirmation && reservation.confirmationNumber !== confirmation) return false;
      if (input.phone && !phonesMatch(reservation.phone, input.phone)) return false;
      if (input.guestName && !namesMatch(reservation.guestName, input.guestName)) return false;
      return true;
    });

    if (matches.length === 0) {
      throw new HotelError(
        "RESERVATION_NOT_FOUND",
        "No reservation matched those details. Ask the caller to verify them.",
        404,
      );
    }

    return {
      matches: matches.map((reservation) => {
        const room = rooms.find((candidate) => candidate.id === reservation.roomType);
        if (!room) {
          throw new HotelError(
            "DATA_CORRUPT",
            "The room linked to that reservation is unavailable.",
            500,
            true,
          );
        }
        return summarizeReservation(reservation, room);
      }),
      message:
        matches.length === 1
          ? "One matching reservation found."
          : `${matches.length} reservations match that verified phone number. Ask which stay they mean.`,
    };
  }

  async modifyReservation(rawInput: ModifyReservationInput) {
    const input = ModifyReservationInputSchema.parse(rawInput);
    const confirmation = input.confirmationNumber.toUpperCase();
    const rooms = await this.repository.getRooms();

    return this.repository.mutateReservations((reservations) => {
      const index = reservations.findIndex(
        (reservation) => reservation.confirmationNumber === confirmation,
      );
      if (index < 0) {
        throw new HotelError("RESERVATION_NOT_FOUND", "That reservation was not found.", 404);
      }

      const current = reservations[index];
      if (current.status === "cancelled") {
        throw new HotelError(
          "RESERVATION_CANCELLED",
          "That reservation is already cancelled and cannot be modified.",
          409,
        );
      }

      const requestedRoom = input.changes.roomType
        ? findRoom(rooms, input.changes.roomType)
        : findRoom(rooms, current.roomType);
      const candidate = {
        ...current,
        ...input.changes,
        roomType: requestedRoom.id,
      };

      this.assertBookableDates(candidate.checkInDate, candidate.checkOutDate);
      const availability = calculateAvailability(
        rooms,
        reservations,
        {
          checkInDate: candidate.checkInDate,
          checkOutDate: candidate.checkOutDate,
          adults: candidate.adults,
          children: candidate.children,
          roomCount: candidate.roomCount,
          preferredRoomType: requestedRoom.id,
          preferences: candidate.preferences,
        },
        confirmation,
      );
      const option = availability.options.find(
        (available) => available.roomTypeId === requestedRoom.id,
      );
      if (!option) {
        throw new HotelError(
          "ROOM_UNAVAILABLE",
          "The requested change cannot be accommodated with current inventory or capacity.",
          409,
        );
      }

      const updated = ReservationSchema.parse({
        ...candidate,
        pricePerNight: option.nightlyTotal,
        totalAmount: option.estimatedTotal,
        updatedAt: this.clock().toISOString(),
      });
      const nextReservations = [...reservations];
      nextReservations[index] = updated;

      return {
        reservations: nextReservations,
        result: {
          status: "modified" as const,
          confirmationNumber: confirmation,
          reservation: summarizeReservation(updated, requestedRoom),
          message: "Reservation updated successfully. It is now safe to confirm the change to the caller.",
        },
      };
    });
  }

  async cancelReservation(rawInput: CancelReservationInput) {
    const input = CancelReservationInputSchema.parse(rawInput);
    const confirmation = input.confirmationNumber.toUpperCase();
    const [hotel, rooms] = await Promise.all([
      this.repository.getHotel(),
      this.repository.getRooms(),
    ]);

    return this.repository.mutateReservations((reservations) => {
      const index = reservations.findIndex(
        (reservation) => reservation.confirmationNumber === confirmation,
      );
      if (index < 0) {
        throw new HotelError("RESERVATION_NOT_FOUND", "That reservation was not found.", 404);
      }

      const current = reservations[index];
      if (current.status === "cancelled") {
        throw new HotelError(
          "RESERVATION_CANCELLED",
          "That reservation is already cancelled.",
          409,
        );
      }
      const room = findRoom(rooms, current.roomType);
      const now = this.clock().toISOString();
      const cancelled = ReservationSchema.parse({
        ...current,
        status: "cancelled",
        cancelledAt: now,
        cancellationReason: input.reason ?? "Cancelled at the caller's request",
        updatedAt: now,
      });
      const nextReservations = [...reservations];
      nextReservations[index] = cancelled;

      return {
        reservations: nextReservations,
        result: {
          status: "cancelled" as const,
          confirmationNumber: confirmation,
          reservation: summarizeReservation(cancelled, room),
          cancellationPolicy: hotel.information.cancellation,
          message: "Reservation cancelled successfully. The history has been retained.",
        },
      };
    });
  }

  async escalateToHuman(rawInput: EscalateToHumanInput) {
    const input = EscalateToHumanInputSchema.parse(rawInput);
    const department =
      input.reason === "payment_dispute" || input.reason === "manager_complaint"
        ? "duty-manager"
        : input.reason === "emergency" || input.reason === "safety_concern"
          ? "security-and-front-desk"
          : "front-desk";

    return {
      status: "queued" as const,
      department,
      reason: input.reason,
      summary: input.summary,
      requestedAt: this.clock().toISOString(),
      message: "Human receptionist requested. This is a simulated queue; no live transfer occurred.",
    };
  }

  async listReservations() {
    const [reservations, rooms] = await Promise.all([
      this.repository.getReservations(),
      this.repository.getRooms(),
    ]);
    return reservations
      .map((reservation) => {
        const room = findRoom(rooms, reservation.roomType);
        return summarizeReservation(reservation, room);
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async resetDemoData() {
    const reservations = await this.repository.resetReservations();
    return {
      reset: true as const,
      reservationCount: reservations.length,
      message: "Demo reservations restored to seed state.",
    };
  }

  private assertBookableDates(checkInDate: string, checkOutDate: string): void {
    if (nightsBetween(checkInDate, checkOutDate) <= 0) {
      throw new HotelError(
        "INVALID_DATE_RANGE",
        "Check-out must be after check-in.",
        422,
      );
    }

    const today = dateInTimeZone(this.clock());
    if (checkInDate < today) {
      throw new HotelError(
        "PAST_CHECK_IN",
        "The check-in date cannot be in the past.",
        422,
      );
    }
  }
}

const globalService = globalThis as typeof globalThis & {
  __shaplaHotelService?: HotelService;
};

export function getHotelService(): HotelService {
  if (!globalService.__shaplaHotelService) {
    globalService.__shaplaHotelService = new HotelService(getHotelRepository());
  }
  return globalService.__shaplaHotelService;
}
