import { dateRangesOverlap, nightsBetween } from "./dates";
import type { Reservation, Room, SearchAvailabilityInput } from "./schemas";

export type AvailabilityOption = {
  roomTypeId: string;
  roomTypeName: string;
  description: string;
  roomCount: number;
  beds: string;
  capacityPerRoom: number;
  totalCapacity: number;
  availableRooms: number;
  pricePerNightPerRoom: number;
  nightlyTotal: number;
  numberOfNights: number;
  estimatedTotal: number;
  currency: "BDT";
  amenities: string[];
  viewOptions: string[];
  matchingPreferences: string[];
  connectingRoomsAvailable: boolean;
};

export type AvailabilityResult = {
  checkInDate: string;
  checkOutDate: string;
  numberOfNights: number;
  guests: { adults: number; children: number; total: number };
  options: AvailabilityOption[];
  message: string;
};

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function roomMatchesRequestedType(room: Room, requested?: string): boolean {
  if (!requested) return true;
  const needle = normalize(requested);
  const id = normalize(room.id);
  const name = normalize(room.name);
  return name.includes(needle) || needle.includes(name) || id.includes(needle) || needle.includes(id);
}

function matchingPreferences(room: Room, preferences: string[]): string[] {
  const searchable = normalize(
    [room.name, room.description, room.beds, ...room.amenities, ...room.viewOptions].join(" "),
  );
  return preferences.filter((preference) => {
    const words = normalize(preference).split(" ").filter((word) => word.length > 2);
    return words.some((word) => searchable.includes(word));
  });
}

export function roomsBookedForStay(
  roomTypeId: string,
  checkInDate: string,
  checkOutDate: string,
  reservations: Reservation[],
  excludeConfirmation?: string,
): number {
  return reservations.reduce((count, reservation) => {
    if (
      reservation.status !== "confirmed" ||
      reservation.roomType !== roomTypeId ||
      reservation.confirmationNumber === excludeConfirmation ||
      !dateRangesOverlap(
        checkInDate,
        checkOutDate,
        reservation.checkInDate,
        reservation.checkOutDate,
      )
    ) {
      return count;
    }
    return count + reservation.roomCount;
  }, 0);
}

export function calculateAvailability(
  rooms: Room[],
  reservations: Reservation[],
  input: SearchAvailabilityInput,
  excludeConfirmation?: string,
): AvailabilityResult {
  const numberOfNights = nightsBetween(input.checkInDate, input.checkOutDate);
  const totalGuests = input.adults + input.children;
  const preferences = input.preferences ?? [];

  const options = rooms
    .filter((room) => roomMatchesRequestedType(room, input.preferredRoomType))
    .flatMap((room): AvailabilityOption[] => {
      const roomCount = input.roomCount ?? Math.ceil(totalGuests / room.capacity);
      if (totalGuests > room.capacity * roomCount) return [];

      const booked = roomsBookedForStay(
        room.id,
        input.checkInDate,
        input.checkOutDate,
        reservations,
        excludeConfirmation,
      );
      const availableRooms = Math.max(0, room.totalRooms - booked);
      if (availableRooms < roomCount) return [];

      const normalizedView = input.preferredView ? normalize(input.preferredView) : null;
      if (
        normalizedView &&
        !room.viewOptions.some((view) => {
          const normalized = normalize(view);
          return normalized.includes(normalizedView) || normalizedView.includes(normalized);
        })
      ) {
        return [];
      }

      const nightlyTotal = room.pricePerNight * roomCount;
      if (input.maxBudget !== undefined && nightlyTotal > input.maxBudget) return [];

      const matches = matchingPreferences(room, preferences);
      return [
        {
          roomTypeId: room.id,
          roomTypeName: room.name,
          description: room.description,
          roomCount,
          beds: room.beds,
          capacityPerRoom: room.capacity,
          totalCapacity: room.capacity * roomCount,
          availableRooms,
          pricePerNightPerRoom: room.pricePerNight,
          nightlyTotal,
          numberOfNights,
          estimatedTotal: nightlyTotal * numberOfNights,
          currency: room.currency,
          amenities: room.amenities,
          viewOptions: room.viewOptions,
          matchingPreferences: matches,
          connectingRoomsAvailable: room.connectingAvailable && roomCount > 1,
        },
      ];
    })
    .sort((a, b) => {
      const preferenceDifference = b.matchingPreferences.length - a.matchingPreferences.length;
      if (preferenceDifference !== 0) return preferenceDifference;
      return a.nightlyTotal - b.nightlyTotal;
    });

  return {
    checkInDate: input.checkInDate,
    checkOutDate: input.checkOutDate,
    numberOfNights,
    guests: { adults: input.adults, children: input.children, total: totalGuests },
    options,
    message:
      options.length > 0
        ? `${options.length} suitable room option${options.length === 1 ? "" : "s"} found.`
        : "No room type currently matches all of those dates, capacity, inventory, and preferences.",
  };
}
