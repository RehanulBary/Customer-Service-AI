import { HotelError } from "./errors";
import type { HotelToolName } from "./tool-names";
export { HOTEL_TOOL_NAMES, isHotelToolName } from "./tool-names";
export type { HotelToolName } from "./tool-names";
import {
  CancelReservationInputSchema,
  CreateReservationInputSchema,
  EscalateToHumanInputSchema,
  HotelInformationInputSchema,
  LookupReservationInputSchema,
  ModifyReservationInputSchema,
  SearchAvailabilityInputSchema,
} from "./schemas";
import { HotelService, getHotelService } from "./service";

export async function executeHotelTool(
  name: HotelToolName,
  input: unknown,
  service: HotelService = getHotelService(),
): Promise<unknown> {
  switch (name) {
    case "get_hotel_information":
      return service.getHotelInformation(HotelInformationInputSchema.parse(input));
    case "search_room_availability":
      return service.searchRoomAvailability(SearchAvailabilityInputSchema.parse(input));
    case "lookup_reservation":
      return service.lookupReservation(LookupReservationInputSchema.parse(input));
    case "create_reservation":
      return service.createReservation(CreateReservationInputSchema.parse(input));
    case "modify_reservation":
      return service.modifyReservation(ModifyReservationInputSchema.parse(input));
    case "cancel_reservation":
      return service.cancelReservation(CancelReservationInputSchema.parse(input));
    case "escalate_to_human":
      return service.escalateToHuman(EscalateToHumanInputSchema.parse(input));
    default:
      throw new HotelError("INVALID_INPUT", "Unknown hotel tool.", 404);
  }
}
