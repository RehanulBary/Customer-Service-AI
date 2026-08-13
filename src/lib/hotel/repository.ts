import { randomBytes } from "node:crypto";
import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { HotelError } from "./errors";
import {
  HotelSchema,
  ReservationSchema,
  RoomSchema,
  type Hotel,
  type Reservation,
  type Room,
} from "./schemas";

class AsyncMutex {
  private tail: Promise<void> = Promise.resolve();

  async runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.tail;
    let release: (() => void) | undefined;
    this.tail = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;
    try {
      return await operation();
    } finally {
      release?.();
    }
  }
}

const fileLocks = new Map<string, AsyncMutex>();

function lockFor(filePath: string): AsyncMutex {
  const resolved = path.resolve(filePath);
  const existing = fileLocks.get(resolved);
  if (existing) return existing;
  const lock = new AsyncMutex();
  fileLocks.set(resolved, lock);
  return lock;
}

async function readValidated<T>(
  filePath: string,
  schema: z.ZodType<T>,
  label: string,
): Promise<T> {
  try {
    const raw = await readFile(filePath, "utf8");
    return schema.parse(JSON.parse(raw));
  } catch (error) {
    if (error instanceof HotelError) throw error;
    if (process.env.NODE_ENV !== "test") {
      console.error(`[hotel-data] Unable to read ${label}:`, error);
    }
    throw new HotelError(
      "DATA_CORRUPT",
      `The ${label} data is unavailable or malformed.`,
      500,
      true,
    );
  }
}

async function atomicWriteJson<T>(filePath: string, value: T): Promise<void> {
  const temporaryPath = `${filePath}.tmp-${process.pid}-${Date.now()}-${randomBytes(5).toString("hex")}`;
  try {
    await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
    await rename(temporaryPath, filePath);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    if (process.env.NODE_ENV !== "test") {
      console.error("[hotel-data] Atomic reservation write failed:", error);
    }
    throw new HotelError(
      "WRITE_FAILED",
      "The reservation store could not be updated safely.",
      500,
      true,
    );
  }
}

export class JsonHotelRepository {
  private readonly hotelPath: string;
  private readonly roomsPath: string;
  private readonly reservationsPath: string;
  private readonly seedPath: string;
  private readonly reservationLock: AsyncMutex;

  constructor(dataDirectory = path.join(process.cwd(), "data")) {
    this.hotelPath = path.join(dataDirectory, "hotel.json");
    this.roomsPath = path.join(dataDirectory, "rooms.json");
    this.reservationsPath = path.join(dataDirectory, "reservations.json");
    this.seedPath = path.join(dataDirectory, "reservations.seed.json");
    this.reservationLock = lockFor(this.reservationsPath);
  }

  getHotel(): Promise<Hotel> {
    return readValidated(this.hotelPath, HotelSchema, "hotel information");
  }

  getRooms(): Promise<Room[]> {
    return readValidated(this.roomsPath, z.array(RoomSchema), "room inventory");
  }

  getReservations(): Promise<Reservation[]> {
    return readValidated(
      this.reservationsPath,
      z.array(ReservationSchema),
      "reservation",
    );
  }

  async mutateReservations<T>(
    mutation: (
      reservations: Reservation[],
    ) => Promise<{ reservations: Reservation[]; result: T }> | {
      reservations: Reservation[];
      result: T;
    },
  ): Promise<T> {
    return this.reservationLock.runExclusive(async () => {
      const reservations = await this.getReservations();
      const next = await mutation(reservations);
      const validated = z.array(ReservationSchema).parse(next.reservations);
      await atomicWriteJson(this.reservationsPath, validated);
      return next.result;
    });
  }

  async resetReservations(): Promise<Reservation[]> {
    return this.reservationLock.runExclusive(async () => {
      const seed = await readValidated(
        this.seedPath,
        z.array(ReservationSchema),
        "reservation seed",
      );
      await atomicWriteJson(this.reservationsPath, seed);
      return seed;
    });
  }
}

const globalRepository = globalThis as typeof globalThis & {
  __shaplaHotelRepository?: JsonHotelRepository;
};

export function getHotelRepository(): JsonHotelRepository {
  if (!globalRepository.__shaplaHotelRepository) {
    globalRepository.__shaplaHotelRepository = new JsonHotelRepository();
  }
  return globalRepository.__shaplaHotelRepository;
}
