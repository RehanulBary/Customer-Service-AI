export const SUPPORTED_REALTIME_MODELS = [
  "gpt-realtime-2.1",
  "gpt-realtime-2.1-mini",
] as const;

export const SUPPORTED_REALTIME_VOICES = [
  "marin",
  "cedar",
  "coral",
  "sage",
  "verse",
  "alloy",
  "ash",
  "ballad",
  "echo",
  "shimmer",
] as const;

export type RealtimeModel = (typeof SUPPORTED_REALTIME_MODELS)[number];
export type RealtimeVoice = (typeof SUPPORTED_REALTIME_VOICES)[number];

export const DEFAULT_REALTIME_MODEL: RealtimeModel = "gpt-realtime-2.1";
export const DEFAULT_REALTIME_VOICE: RealtimeVoice = "marin";

export function isRealtimeModel(value: string): value is RealtimeModel {
  return SUPPORTED_REALTIME_MODELS.includes(value as RealtimeModel);
}

export function isRealtimeVoice(value: string): value is RealtimeVoice {
  return SUPPORTED_REALTIME_VOICES.includes(value as RealtimeVoice);
}
