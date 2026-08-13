import { copyFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { JsonHotelRepository } from "@/lib/hotel/repository";
import { HotelService } from "@/lib/hotel/service";

export async function createTestContext(options?: {
  confirmationNumber?: () => number;
}) {
  const dataDirectory = await mkdtemp(path.join(tmpdir(), "shapla-grand-test-"));
  const sourceDirectory = path.join(process.cwd(), "data");
  await Promise.all(
    ["hotel.json", "rooms.json", "reservations.json", "reservations.seed.json"].map(
      (fileName) =>
        copyFile(path.join(sourceDirectory, fileName), path.join(dataDirectory, fileName)),
    ),
  );

  const repository = new JsonHotelRepository(dataDirectory);
  const service = new HotelService(repository, {
    clock: () => new Date("2026-08-13T10:00:00.000Z"),
    confirmationNumber: options?.confirmationNumber ?? (() => 28_417),
  });

  return {
    dataDirectory,
    repository,
    service,
    cleanup: () => rm(dataDirectory, { recursive: true, force: true }),
  };
}
