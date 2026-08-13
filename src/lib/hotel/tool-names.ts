export const HOTEL_TOOL_NAMES = [
  "get_hotel_information",
  "search_room_availability",
  "lookup_reservation",
  "create_reservation",
  "modify_reservation",
  "cancel_reservation",
  "escalate_to_human",
] as const;

export type HotelToolName = (typeof HOTEL_TOOL_NAMES)[number];

export function isHotelToolName(value: string): value is HotelToolName {
  return HOTEL_TOOL_NAMES.includes(value as HotelToolName);
}
