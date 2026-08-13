const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseDateOnly(value: string): Date | null {
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

export function isDateOnly(value: string): boolean {
  return parseDateOnly(value) !== null;
}

export function nightsBetween(checkInDate: string, checkOutDate: string): number {
  const checkIn = parseDateOnly(checkInDate);
  const checkOut = parseDateOnly(checkOutDate);
  if (!checkIn || !checkOut) return 0;
  return Math.round((checkOut.getTime() - checkIn.getTime()) / 86_400_000);
}

export function dateRangesOverlap(
  firstStart: string,
  firstEnd: string,
  secondStart: string,
  secondEnd: string,
): boolean {
  const aStart = parseDateOnly(firstStart);
  const aEnd = parseDateOnly(firstEnd);
  const bStart = parseDateOnly(secondStart);
  const bEnd = parseDateOnly(secondEnd);

  if (!aStart || !aEnd || !bStart || !bEnd) return false;
  return aStart < bEnd && bStart < aEnd;
}

export function dateInTimeZone(date: Date, timeZone = "Asia/Dhaka"): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function formatDhakaDateTime(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}
