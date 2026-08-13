export type HotelErrorCode =
  | "INVALID_INPUT"
  | "INVALID_DATE_RANGE"
  | "PAST_CHECK_IN"
  | "ROOM_NOT_FOUND"
  | "INSUFFICIENT_CAPACITY"
  | "ROOM_UNAVAILABLE"
  | "RESERVATION_NOT_FOUND"
  | "RESERVATION_CANCELLED"
  | "VERIFICATION_REQUIRED"
  | "AMBIGUOUS_MATCH"
  | "DATA_CORRUPT"
  | "WRITE_FAILED"
  | "CONFIGURATION_ERROR"
  | "UPSTREAM_ERROR";

export class HotelError extends Error {
  constructor(
    public readonly code: HotelErrorCode,
    message: string,
    public readonly status = 400,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "HotelError";
  }
}

export type ApiSuccess<T> = { ok: true; data: T };
export type ApiFailure = {
  ok: false;
  error: {
    code: HotelErrorCode;
    message: string;
    retryable: boolean;
  };
};
export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

export function success<T>(data: T): ApiSuccess<T> {
  return { ok: true, data };
}

export function failure(error: HotelError): ApiFailure {
  return {
    ok: false,
    error: {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
    },
  };
}

export function toHotelError(error: unknown): HotelError {
  if (error instanceof HotelError) return error;

  if (error && typeof error === "object" && "issues" in error) {
    return new HotelError(
      "INVALID_INPUT",
      "Some of the supplied information is invalid or incomplete.",
      422,
    );
  }

  return new HotelError(
    "WRITE_FAILED",
    "The hotel system could not complete that request. Please try again.",
    500,
    true,
  );
}
