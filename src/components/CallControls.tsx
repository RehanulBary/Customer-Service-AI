import type { CallPhase } from "@/lib/realtime/types";
import {
  MicIcon,
  MicOffIcon,
  PhoneIcon,
  PhoneOffIcon,
  VolumeIcon,
  VolumeOffIcon,
} from "./Icons";

type CallControlsProps = {
  phase: CallPhase;
  isMuted: boolean;
  isSpeakerMuted: boolean;
  onStart: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
  onToggleSpeaker: () => void;
};

export function CallControls({
  phase,
  isMuted,
  isSpeakerMuted,
  onStart,
  onEnd,
  onToggleMute,
  onToggleSpeaker,
}: CallControlsProps) {
  const active = ["listening", "user-speaking", "agent-thinking", "agent-speaking"].includes(phase);

  if (phase === "idle" || phase === "ended" || phase === "error") {
    return (
      <button className="call-primary" type="button" onClick={onStart}>
        <span className="button-icon"><PhoneIcon /></span>
        {phase === "idle" ? "Call Reception" : phase === "ended" ? "Start New Call" : "Try Again"}
      </button>
    );
  }

  if (phase === "connecting") {
    return (
      <button className="call-primary is-loading" type="button" disabled>
        <span className="spinner" />
        Connecting…
      </button>
    );
  }

  return (
    <div className="call-controls" aria-label="Call controls">
      <button
        className={`round-control ${isMuted ? "is-active" : ""}`}
        type="button"
        onClick={onToggleMute}
        disabled={!active}
        aria-pressed={isMuted}
      >
        {isMuted ? <MicOffIcon /> : <MicIcon />}
        <span>{isMuted ? "Unmute" : "Mute"}</span>
      </button>
      <button className="end-call" type="button" onClick={onEnd} disabled={phase === "ending"}>
        <PhoneOffIcon />
        <span>End Call</span>
      </button>
      <button
        className={`round-control ${isSpeakerMuted ? "is-active" : ""}`}
        type="button"
        onClick={onToggleSpeaker}
        disabled={!active}
        aria-pressed={isSpeakerMuted}
      >
        {isSpeakerMuted ? <VolumeOffIcon /> : <VolumeIcon />}
        <span>Speaker</span>
      </button>
    </div>
  );
}
