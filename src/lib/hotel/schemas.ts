import { z } from "zod";
import { isDateOnly, nightsBetween } from "./dates";

export const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use an ISO date in YYYY-MM-DD format")
  .refine(isDateOnly, "Date does not exist");

export const NonEmptyTextSchema = z.string().trim().min(1).max(500);
export const ShortTextSchema = z.string().trim().min(1).max(120);
export const CurrencySchema = z.literal("BDT");

export const HotelSchema = z.object({
  id: ShortTextSchema,
  name: ShortTextSchema,
  description: NonEmptyTextSchema,
  address: z.object({
    street: ShortTextSchema,
    area: ShortTextSchema,
    city: ShortTextSchema,
    country: ShortTextSchema,
    postalCode: ShortTextSchema,
  }),
  phone: ShortTextSchema,
  email: z.email(),
  timezone: ShortTextSchema,
  currency: CurrencySchema,
  checkInTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  checkOutTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  information: z.record(z.string(), NonEmptyTextSchema),
  nearbyLandmarks: z.array(
    z.object({
      name: ShortTextSchema,
      distance: ShortTextSchema,
      travelTime: ShortTextSchema,
    }),
  ),
  faqs: z.array(
    z.object({
      question: ShortTextSchema,
      answer: NonEmptyTextSchema,
    }),
  ),
});

export const RoomSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: ShortTextSchema,
  description: NonEmptyTextSchema,
  capacity: z.number().int().positive().max(12),
  beds: ShortTextSchema,
  pricePerNight: z.number().int().positive(),
  currency: CurrencySchema,
  totalRooms: z.number().int().positive().max(1000),
  amenities: z.array(ShortTextSchema).min(1),
  viewOptions: z.array(ShortTextSchema),
  connectingAvailable: z.boolean(),
});

export const ReservationStatusSchema = z.enum(["confirmed", "cancelled"]);

export const ReservationSchema = z.object({
  confirmationNumber: z.string().regex(/^SGH-\d{5}$/),
  guestName: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(7).max(24),
  email: z.email().optional(),
  checkInDate: IsoDateSchema,
  checkOutDate: IsoDateSchema,
  adults: z.number().int().min(1).max(30),
  children: z.number().int().min(0).max(20),
  roomType: z.string().regex(/^[a-z0-9-]+$/),
  roomCount: z.number().int().min(1).max(10),
  preferences: z.array(ShortTextSchema).max(12),
  specialRequests: z.array(NonEmptyTextSchema).max(12),
  status: ReservationStatusSchema,
  pricePerNight: z.number().int().nonnegative(),
  totalAmount: z.number().int().nonnegative(),
  currency: CurrencySchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  cancelledAt: z.iso.datetime().optional(),
  cancellationReason: NonEmptyTextSchema.optional(),
});

export const HotelInformationInputSchema = z.object({
  topic: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .describe(
      "The hotel fact to retrieve, such as breakfast, parking, check-in, cancellation, pool, location, payment, or a landmark.",
    ),
});

export const SearchAvailabilityInputSchema = z
  .object({
    checkInDate: IsoDateSchema.describe("Arrival date in YYYY-MM-DD format."),
    checkOutDate: IsoDateSchema.describe("Departure date in YYYY-MM-DD format."),
    adults: z.number().int().min(1).max(30),
    children: z.number().int().min(0).max(20),
    roomCount: z
      .number()
      .int()
      .min(1)
      .max(10)
      .optional()
      .describe("Only set when the caller explicitly requests a number of rooms."),
    preferredRoomType: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .optional()
      .describe("A room type named or selected by the caller."),
    preferredView: z.string().trim().min(1).max(100).optional(),
    maxBudget: z
      .number()
      .positive()
      .optional()
      .describe("Maximum combined room price per night in BDT."),
    preferences: z.array(ShortTextSchema).max(12).optional(),
  })
  .refine((value) => nightsBetween(value.checkInDate, value.checkOutDate) > 0, {
    message: "Check-out must be after check-in",
    path: ["checkOutDate"],
  });

export const CreateReservationInputSchema = z
  .object({
    guestName: z.string().trim().min(2).max(100),
    phone: z.string().trim().min(7).max(24),
    email: z.email().nullish(),
    checkInDate: IsoDateSchema,
    checkOutDate: IsoDateSchema,
    adults: z.number().int().min(1).max(30),
    children: z.number().int().min(0).max(20),
    roomType: z.string().trim().min(1).max(100),
    roomCount: z.number().int().min(1).max(10),
    preferences: z.array(ShortTextSchema).max(12).nullish(),
    specialRequests: z.array(NonEmptyTextSchema).max(12).nullish(),
    confirmed: z
      .literal(true)
      .describe("Set to true only after the caller explicitly confirms the complete booking summary."),
  })
  .refine((value) => nightsBetween(value.checkInDate, value.checkOutDate) > 0, {
    message: "Check-out must be after check-in",
    path: ["checkOutDate"],
  });

export const LookupReservationInputSchema = z
  .object({
    confirmationNumber: z
      .string()
      .trim()
      .regex(/^SGH-\d{5}$/i)
      .nullish(),
    phone: z.string().trim().min(7).max(24).nullish(),
    guestName: z.string().trim().min(2).max(100).nullish(),
  })
  .refine(
    (value) => Boolean(value.confirmationNumber || value.phone || value.guestName),
    "Provide a confirmation number, phone, or guest name",
  );

export const ReservationChangesSchema = z.object({
  checkInDate: IsoDateSchema.optional(),
  checkOutDate: IsoDateSchema.optional(),
  adults: z.number().int().min(1).max(30).optional(),
  children: z.number().int().min(0).max(20).optional(),
  roomType: z.string().trim().min(1).max(100).optional(),
  roomCount: z.number().int().min(1).max(10).optional(),
  preferences: z.array(ShortTextSchema).max(12).optional(),
  specialRequests: z.array(NonEmptyTextSchema).max(12).optional(),
});

export const ModifyReservationInputSchema = z
  .object({
    confirmationNumber: z.string().trim().regex(/^SGH-\d{5}$/i),
    changes: ReservationChangesSchema,
    confirmed: z
      .literal(true)
      .describe("Set to true only after the caller explicitly confirms the material changes."),
  })
  .refine((value) => Object.keys(value.changes).length > 0, {
    message: "At least one change is required",
    path: ["changes"],
  });

export const CancelReservationInputSchema = z.object({
  confirmationNumber: z.string().trim().regex(/^SGH-\d{5}$/i),
  reason: z.string().trim().min(1).max(300).optional(),
  confirmed: z
    .literal(true)
    .describe("Set to true only after the caller hears the policy and explicitly confirms cancellation."),
});

export const EscalationReasonSchema = z.enum([
  "human_requested",
  "payment_dispute",
  "emergency",
  "safety_concern",
  "lost_property",
  "manager_complaint",
  "unsupported_request",
  "repeated_tool_failure",
  "uncertain_high_impact_action",
]);

export const EscalateToHumanInputSchema = z.object({
  reason: EscalationReasonSchema,
  summary: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .describe("A concise factual summary for the human front desk. Do not include hidden reasoning."),
});

export type Hotel = z.infer<typeof HotelSchema>;
export type Room = z.infer<typeof RoomSchema>;
export type Reservation = z.infer<typeof ReservationSchema>;
export type HotelInformationInput = z.infer<typeof HotelInformationInputSchema>;
export type SearchAvailabilityInput = z.infer<typeof SearchAvailabilityInputSchema>;
export type CreateReservationInput = z.infer<typeof CreateReservationInputSchema>;
export type LookupReservationInput = z.infer<typeof LookupReservationInputSchema>;
export type ModifyReservationInput = z.infer<typeof ModifyReservationInputSchema>;
export type CancelReservationInput = z.infer<typeof CancelReservationInputSchema>;
export type EscalateToHumanInput = z.infer<typeof EscalateToHumanInputSchema>;
