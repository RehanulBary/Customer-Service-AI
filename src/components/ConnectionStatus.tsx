import type { CallPhase } from "@/lib/realtime/types";

const STATUS_COPY: Record<CallPhase, { label: string; detail: string }> = {
  idle: { label: "Ready to call reception", detail: "Your microphone starts only when you call" },
  connecting: { label: "Connecting securely", detail: "Preparing your private voice session" },
  listening: { label: "Listening", detail: "Speak naturally whenever you're ready" },
  "user-speaking": { label: "You're speaking", detail: "The receptionist is listening" },
  "agent-thinking": { label: "One moment", detail: "Reception is checking that for you" },
  "agent-speaking": { label: "Receptionist speaking", detail: "You can interrupt at any time" },
  ending: { label: "Ending call", detail: "Closing the audio connection" },
  ended: { label: "Call ended", detail: "Your conversation remains below" },
  error: { label: "Unable to connect", detail: "Review the message and try again" },
};

export function ConnectionStatus({ phase }: { phase: CallPhase }) {
  const copy = STATUS_COPY[phase];
  const active = ["listening", "user-speaking", "agent-thinking", "agent-speaking"].includes(phase);
  return (
    <div className="connection-copy" aria-live="polite">
      <div className={`status-kicker ${active ? "is-connected" : ""}`}>
        <span className="status-dot" />
        {active ? "Connected" : phase === "connecting" ? "Connecting" : "Reception"}
      </div>
      <h2>{copy.label}</h2>
      <p>{copy.detail}</p>
    </div>
  );
}
