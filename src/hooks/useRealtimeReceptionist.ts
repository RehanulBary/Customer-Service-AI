"use client";

import {
  OpenAIRealtimeWebRTC,
  RealtimeSession,
  type RealtimeItem,
  type TransportEvent,
} from "@openai/agents/realtime";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  isRealtimeModel,
  isRealtimeVoice,
  type RealtimeModel,
  type RealtimeVoice,
} from "@/config/realtime";
import { createHotelReceptionistAgent } from "@/agents/hotelReceptionist";
import {
  CALL_CONNECTED_MARKER,
  HOTEL_AGENT_PROMPT_VERSION,
} from "@/agents/hotelPrompt";
import type { ApiResult } from "@/lib/hotel/errors";
import { HOTEL_TOOL_NAMES } from "@/lib/hotel/tool-names";
import { inspectSessionAcknowledgement } from "@/lib/realtime/session-acknowledgement";
import type {
  AgentActivity,
  ActivityKind,
  CallPhase,
  CallSummary,
  TranscriptEntry,
} from "@/lib/realtime/types";

type ClientSecretData = {
  clientSecret: string;
  expiresAt: number | null;
  model: RealtimeModel;
  voice: RealtimeVoice;
};

class CallSetupError extends Error {}

const TOOL_START_MESSAGES: Record<string, string> = {
  get_hotel_information: "Looking up hotel information…",
  search_room_availability: "Checking room availability…",
  lookup_reservation: "Looking up the reservation…",
  create_reservation: "Creating the reservation…",
  modify_reservation: "Updating the reservation…",
  cancel_reservation: "Cancelling the reservation…",
  escalate_to_human: "Requesting the hotel team…",
};

const TOOL_ACTIVITY_NAMES: Record<string, string> = {
  get_hotel_information: "get_hotel_information",
  search_room_availability: "search_room_availability",
  lookup_reservation: "lookup_reservation",
  create_reservation: "create_reservation",
  modify_reservation: "modify_reservation",
  cancel_reservation: "cancel_reservation",
  escalate_to_human: "escalate_to_human",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function friendlyError(error: unknown): string {
  if (error instanceof CallSetupError) return error.message;
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") {
      return "Microphone access is required to start the voice demo. Allow access in your browser and try again.";
    }
    if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
      return "No microphone was found. Connect a microphone and try again.";
    }
    if (error.name === "NotReadableError" || error.name === "TrackStartError") {
      return "Your microphone is busy in another application. Close it there and try again.";
    }
  }
  return "The realtime voice connection could not be established. Check your network and try again.";
}

function extractTranscript(item: RealtimeItem): Omit<TranscriptEntry, "order"> | null {
  if (item.type !== "message" || item.role === "system") return null;

  const text = item.content
    .map((content) => {
      if (content.type === "input_text") return content.text;
      if (content.type === "input_audio") return content.transcript ?? "";
      if (content.type === "output_text") return content.text;
      if (content.type === "output_audio") return content.transcript ?? "";
      return "";
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  if (!text || text.includes(CALL_CONNECTED_MARKER)) return null;
  return {
    id: item.itemId,
    role: item.role === "user" ? "user" : "assistant",
    text,
    status: item.status,
  };
}

async function fetchClientSecret(): Promise<ClientSecretData> {
  const response = await fetch("/api/realtime/client-secret", {
    method: "POST",
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as ApiResult<unknown> | null;

  if (!payload || !payload.ok || !isRecord(payload.data)) {
    const message = payload && !payload.ok ? payload.error.message : "The session service returned an invalid response.";
    throw new CallSetupError(message);
  }

  const data = payload.data;
  if (
    typeof data.clientSecret !== "string" ||
    !data.clientSecret.startsWith("ek_") ||
    typeof data.model !== "string" ||
    !isRealtimeModel(data.model) ||
    typeof data.voice !== "string" ||
    !isRealtimeVoice(data.voice)
  ) {
    throw new CallSetupError("The session service returned invalid realtime configuration.");
  }

  return {
    clientSecret: data.clientSecret,
    expiresAt: typeof data.expiresAt === "number" ? data.expiresAt : null,
    model: data.model,
    voice: data.voice,
  };
}

export function useRealtimeReceptionist() {
  const [phase, setPhase] = useState<CallPhase>("idle");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [activity, setActivity] = useState<AgentActivity[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [summary, setSummary] = useState<CallSummary | null>(null);

  const phaseRef = useRef<CallPhase>("idle");
  const sessionRef = useRef<RealtimeSession | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const meterFrameRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callStartedAtRef = useRef<number | null>(null);
  const confirmationRef = useRef<string | null>(null);
  const escalationRef = useRef<string | null>(null);
  const orderRef = useRef(0);
  const activityIdRef = useRef(0);
  const generationRef = useRef(0);
  const intentionalCloseRef = useRef(false);
  const mountedRef = useRef(true);

  const changePhase = useCallback((next: CallPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const addActivity = useCallback((message: string, kind: ActivityKind = "info") => {
    const next: AgentActivity = {
      id: `activity-${++activityIdRef.current}`,
      kind,
      message,
      timestamp: Date.now(),
    };
    setActivity((current) => [...current.slice(-79), next]);
  }, []);

  const addSystemTranscript = useCallback((text: string) => {
    setTranscript((current) => [
      ...current,
      {
        id: `system-${++orderRef.current}`,
        role: "system",
        text,
        order: orderRef.current,
        status: "completed",
      },
    ]);
  }, []);

  const updateTranscriptFromHistory = useCallback((history: RealtimeItem[]) => {
    setTranscript((current) => {
      const byId = new Map(current.map((entry) => [entry.id, entry]));
      const activeSpeechIds = new Set<string>();

      for (const item of history) {
        const extracted = extractTranscript(item);
        if (!extracted) continue;
        activeSpeechIds.add(extracted.id);
        const existing = byId.get(extracted.id);
        byId.set(extracted.id, {
          ...extracted,
          order: existing?.order ?? ++orderRef.current,
        });
      }

      return [...byId.values()]
        .filter((entry) => entry.role === "system" || activeSpeechIds.has(entry.id))
        .sort((a, b) => a.order - b.order);
    });
  }, []);

  const stopLevelMeter = useCallback(() => {
    if (meterFrameRef.current !== null) {
      cancelAnimationFrame(meterFrameRef.current);
      meterFrameRef.current = null;
    }
    mediaSourceRef.current?.disconnect();
    mediaSourceRef.current = null;
    const audioContext = audioContextRef.current;
    audioContextRef.current = null;
    if (audioContext && audioContext.state !== "closed") {
      void audioContext.close().catch(() => undefined);
    }
    setAudioLevel(0);
  }, []);

  const startLevelMeter = useCallback(
    async (stream: MediaStream, generation: number) => {
      try {
        const audioContext = new AudioContext();
        await audioContext.resume();
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.75;
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        audioContextRef.current = audioContext;
        mediaSourceRef.current = source;
        const samples = new Uint8Array(analyser.fftSize);

        const measure = () => {
          if (generationRef.current !== generation || !mountedRef.current) return;
          analyser.getByteTimeDomainData(samples);
          let sum = 0;
          for (const sample of samples) {
            const normalized = (sample - 128) / 128;
            sum += normalized * normalized;
          }
          const rms = Math.sqrt(sum / samples.length);
          setAudioLevel(Math.min(1, Math.max(0, rms * 5)));
          meterFrameRef.current = requestAnimationFrame(measure);
        };
        measure();
      } catch {
        setAudioLevel(0);
      }
    },
    [],
  );

  const cleanupResources = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    stopLevelMeter();
    sessionRef.current?.close();
    sessionRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.srcObject = null;
      audioElementRef.current.remove();
      audioElementRef.current = null;
    }
  }, [stopLevelMeter]);

  const currentDuration = useCallback(() => {
    const startedAt = callStartedAtRef.current;
    return startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : 0;
  }, []);

  const completeUnexpectedDisconnect = useCallback(() => {
    if (intentionalCloseRef.current || phaseRef.current === "idle" || phaseRef.current === "ended") {
      return;
    }
    intentionalCloseRef.current = true;
    const duration = currentDuration();
    setDurationSeconds(duration);
    setSummary({
      durationSeconds: duration,
      confirmationNumber: confirmationRef.current,
      escalationDepartment: escalationRef.current,
    });
    cleanupResources();
    setErrorMessage("The voice connection ended unexpectedly. Your transcript has been preserved.");
    addActivity("Realtime session disconnected", "error");
    changePhase("error");
  }, [addActivity, changePhase, cleanupResources, currentDuration]);

  const handleToolResult = useCallback(
    (toolName: string, result: string) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(result);
      } catch {
        parsed = null;
      }

      if (!isRecord(parsed) || parsed.ok !== true || !isRecord(parsed.data)) {
        const errorMessage =
          isRecord(parsed) && parsed.ok === false && isRecord(parsed.error) && typeof parsed.error.message === "string"
            ? parsed.error.message
            : "The hotel operation did not complete.";
        addActivity(`${TOOL_ACTIVITY_NAMES[toolName] ?? toolName} returned an issue`, "warning");
        addSystemTranscript(errorMessage);
        return;
      }

      const data = parsed.data;
      if (toolName === "search_room_availability") {
        const count = Array.isArray(data.options) ? data.options.length : 0;
        addActivity(`${count} matching room option${count === 1 ? "" : "s"} found`, "success");
        addSystemTranscript(`${count} room option${count === 1 ? "" : "s"} found`);
      } else if (toolName === "create_reservation" && typeof data.confirmationNumber === "string") {
        confirmationRef.current = data.confirmationNumber;
        addActivity(`${data.confirmationNumber} created`, "success");
        addSystemTranscript(`Reservation ${data.confirmationNumber} created`);
      } else if (toolName === "modify_reservation" && typeof data.confirmationNumber === "string") {
        addActivity(`${data.confirmationNumber} updated`, "success");
        addSystemTranscript(`Reservation ${data.confirmationNumber} updated`);
      } else if (toolName === "cancel_reservation" && typeof data.confirmationNumber === "string") {
        addActivity(`${data.confirmationNumber} cancelled`, "success");
        addSystemTranscript(`Reservation ${data.confirmationNumber} cancelled`);
      } else if (toolName === "lookup_reservation") {
        const count = Array.isArray(data.matches) ? data.matches.length : 0;
        addActivity(`${count} verified reservation match${count === 1 ? "" : "es"} found`, "success");
      } else if (toolName === "escalate_to_human") {
        const department = typeof data.department === "string" ? data.department : "front-desk";
        escalationRef.current = department;
        addActivity(`Human request queued for ${department}`, "success");
        addSystemTranscript(`Human request queued for ${department}`);
      } else {
        addActivity(`${TOOL_ACTIVITY_NAMES[toolName] ?? toolName} completed`, "success");
      }
    },
    [addActivity, addSystemTranscript],
  );

  const handleTransportEvent = useCallback(
    (event: TransportEvent) => {
      const acknowledgement = inspectSessionAcknowledgement(event);
      if (acknowledgement) {
        if (acknowledgement.promptLoaded) {
          addActivity(`Receptionist instructions active · ${HOTEL_AGENT_PROMPT_VERSION}`, "success");
        } else {
          addActivity("Realtime session did not acknowledge the receptionist instructions", "error");
        }

        if (acknowledgement.missingTools.length === 0) {
          addActivity(`All ${HOTEL_TOOL_NAMES.length} hotel tools active`, "success");
        } else {
          addActivity(`Hotel tools missing: ${acknowledgement.missingTools.join(", ")}`, "error");
        }
      } else if (event.type === "input_audio_buffer.speech_started") {
        changePhase("user-speaking");
        addActivity("User speech detected", "info");
      } else if (event.type === "input_audio_buffer.speech_stopped") {
        changePhase("agent-thinking");
      } else if (event.type === "response.created") {
        changePhase("agent-thinking");
      }
    },
    [addActivity, changePhase],
  );

  const startCall = useCallback(async () => {
    const generation = ++generationRef.current;
    intentionalCloseRef.current = true;
    cleanupResources();
    intentionalCloseRef.current = false;
    setTranscript([]);
    setActivity([]);
    setErrorMessage(null);
    setSummary(null);
    setDurationSeconds(0);
    setIsMuted(false);
    setIsSpeakerMuted(false);
    confirmationRef.current = null;
    escalationRef.current = null;
    callStartedAtRef.current = null;
    orderRef.current = 0;
    changePhase("connecting");
    addActivity("Requesting microphone access", "info");

    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === "undefined") {
        throw new CallSetupError(
          "This browser does not provide the microphone and WebRTC features required for the demo.",
        );
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      if (generationRef.current !== generation) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      addActivity("Microphone ready", "success");
      void startLevelMeter(stream, generation);

      const credentials = await fetchClientSecret();
      if (generationRef.current !== generation) return;
      addActivity("Ephemeral session credential received", "success");

      const audioElement = new Audio();
      audioElement.autoplay = true;
      audioElement.setAttribute("playsinline", "true");
      audioElementRef.current = audioElement;
      const transport = new OpenAIRealtimeWebRTC({
        mediaStream: stream,
        audioElement,
      });
      const agent = createHotelReceptionistAgent(credentials.voice);
      const session = new RealtimeSession(agent, {
        model: credentials.model,
        transport,
        historyStoreAudio: false,
        workflowName: "Shapla Grand Voice Reception",
        config: {
          outputModalities: ["audio"],
          audio: {
            input: {
              noiseReduction: { type: "near_field" },
              transcription: {
                model: "gpt-realtime-whisper",
                language: "en",
                delay: "minimal",
                keywords: [
                  "Shapla Grand Hotel",
                  "Dhaka",
                  "Gulshan",
                  "BDT",
                  "taka",
                  "Deluxe Twin",
                  "Family Suite",
                ],
                prompt: "A hotel reception call in English, with Bangladeshi names and BDT prices.",
              },
              turnDetection: {
                type: "semantic_vad",
                eagerness: "auto",
                createResponse: true,
                interruptResponse: true,
              },
            },
            output: { voice: credentials.voice },
          },
          reasoning: { effort: "low" },
          parallelToolCalls: false,
        },
        toolErrorFormatter: ({ toolName }) =>
          JSON.stringify({
            ok: false,
            error: {
              code: "INVALID_INPUT",
              message: `${toolName} could not run with those details. Ask briefly for corrected information.`,
              retryable: false,
            },
          }),
      });
      sessionRef.current = session;

      session.on("history_updated", updateTranscriptFromHistory);
      session.on("transport_event", handleTransportEvent);
      session.on("audio_start", () => changePhase("agent-speaking"));
      session.on("audio_stopped", () => changePhase("listening"));
      session.on("audio_interrupted", () => {
        changePhase("user-speaking");
        addActivity("User interrupted receptionist", "warning");
      });
      session.on("agent_start", () => {
        if (phaseRef.current !== "user-speaking") changePhase("agent-thinking");
      });
      session.on("agent_tool_start", (_context, _agent, selectedTool) => {
        changePhase("agent-thinking");
        const label = TOOL_ACTIVITY_NAMES[selectedTool.name] ?? selectedTool.name;
        addActivity(`→ ${label}`, "tool");
        addSystemTranscript(TOOL_START_MESSAGES[selectedTool.name] ?? "Contacting the hotel system…");
      });
      session.on("agent_tool_end", (_context, _agent, selectedTool, result) => {
        handleToolResult(selectedTool.name, result);
      });
      session.on("error", ({ error }) => {
        if (process.env.NODE_ENV === "development") {
          console.error("[realtime] Session error:", error);
        }
        addActivity("Realtime session reported an error", "error");
      });
      transport.on("connection_change", (status) => {
        if (generationRef.current !== generation) return;
        if (status === "connected") {
          addActivity("Realtime session connected", "success");
        } else if (status === "disconnected") {
          completeUnexpectedDisconnect();
        }
      });

      await session.connect({
        apiKey: credentials.clientSecret,
        model: credentials.model,
      });
      if (generationRef.current !== generation) return;

      const liveConfig = await session.getInitialSessionConfig();
      const liveInstructions =
        typeof liveConfig.instructions === "string" ? liveConfig.instructions : "";
      const liveTools = liveConfig.tools ?? [];
      const liveToolNames = liveTools.flatMap((candidate) =>
        "name" in candidate && typeof candidate.name === "string"
          ? [candidate.name]
          : [],
      );
      const missingTools = HOTEL_TOOL_NAMES.filter(
        (toolName) => !liveToolNames.includes(toolName),
      );
      if (!liveInstructions.includes(HOTEL_AGENT_PROMPT_VERSION) || missingTools.length > 0) {
        throw new CallSetupError(
          "The receptionist configuration did not load completely. End the call, restart the development server, and try again.",
        );
      }

      callStartedAtRef.current = Date.now();
      setDurationSeconds(0);
      timerRef.current = setInterval(() => {
        setDurationSeconds(currentDuration());
      }, 1000);
      changePhase("listening");
      session.sendMessage(CALL_CONNECTED_MARKER);
    } catch (error) {
      if (generationRef.current !== generation) return;
      intentionalCloseRef.current = true;
      cleanupResources();
      const message = friendlyError(error);
      setErrorMessage(message);
      addActivity(message, "error");
      changePhase("error");
    }
  }, [
    addActivity,
    addSystemTranscript,
    changePhase,
    cleanupResources,
    completeUnexpectedDisconnect,
    currentDuration,
    handleToolResult,
    handleTransportEvent,
    startLevelMeter,
    updateTranscriptFromHistory,
  ]);

  const endCall = useCallback(() => {
    if (["idle", "ended", "ending"].includes(phaseRef.current)) return;
    intentionalCloseRef.current = true;
    changePhase("ending");
    addActivity("Call ended by user", "info");
    const duration = currentDuration();
    setDurationSeconds(duration);
    setSummary({
      durationSeconds: duration,
      confirmationNumber: confirmationRef.current,
      escalationDepartment: escalationRef.current,
    });
    cleanupResources();
    changePhase("ended");
  }, [addActivity, changePhase, cleanupResources, currentDuration]);

  const toggleMute = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    const next = !isMuted;
    session.mute(next);
    setIsMuted(next);
    addActivity(next ? "Microphone muted" : "Microphone unmuted", "info");
  }, [addActivity, isMuted]);

  const toggleSpeaker = useCallback(() => {
    const next = !isSpeakerMuted;
    if (audioElementRef.current) audioElementRef.current.muted = next;
    setIsSpeakerMuted(next);
    addActivity(next ? "Speaker muted" : "Speaker unmuted", "info");
  }, [addActivity, isSpeakerMuted]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      intentionalCloseRef.current = true;
      cleanupResources();
    };
  }, [cleanupResources]);

  return {
    phase,
    transcript,
    activity,
    errorMessage,
    durationSeconds,
    isMuted,
    isSpeakerMuted,
    audioLevel,
    summary,
    startCall,
    endCall,
    toggleMute,
    toggleSpeaker,
  };
}
