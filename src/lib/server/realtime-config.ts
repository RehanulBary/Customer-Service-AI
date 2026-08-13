import {
  DEFAULT_REALTIME_MODEL,
  DEFAULT_REALTIME_VOICE,
  isRealtimeModel,
  isRealtimeVoice,
} from "@/config/realtime";
import { HotelError } from "@/lib/hotel/errors";

export function getRealtimeServerConfig() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new HotelError(
      "CONFIGURATION_ERROR",
      "The voice demo is not configured yet. Add OPENAI_API_KEY to .env.local and restart the server.",
      503,
    );
  }

  const { model, voice } = getPublicRealtimeServerConfig();

  return {
    apiKey,
    model,
    voice,
  };
}

export function getPublicRealtimeServerConfig() {
  const requestedModel = process.env.OPENAI_REALTIME_MODEL?.trim() || DEFAULT_REALTIME_MODEL;
  if (!isRealtimeModel(requestedModel)) {
    throw new HotelError(
      "CONFIGURATION_ERROR",
      "OPENAI_REALTIME_MODEL must be gpt-realtime-2.1 or gpt-realtime-2.1-mini.",
      500,
    );
  }

  const requestedVoice = process.env.OPENAI_REALTIME_VOICE?.trim() || DEFAULT_REALTIME_VOICE;
  if (!isRealtimeVoice(requestedVoice)) {
    throw new HotelError(
      "CONFIGURATION_ERROR",
      "OPENAI_REALTIME_VOICE is not in the supported voice allowlist.",
      500,
    );
  }

  return {
    apiKeyConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
    model: requestedModel,
    voice: requestedVoice,
  };
}
