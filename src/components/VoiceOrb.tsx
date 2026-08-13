import type { CSSProperties } from "react";
import type { CallPhase } from "@/lib/realtime/types";
import { MicIcon, PhoneIcon } from "./Icons";

type VoiceOrbProps = {
  phase: CallPhase;
  audioLevel: number;
  isMuted: boolean;
};

export function VoiceOrb({ phase, audioLevel, isMuted }: VoiceOrbProps) {
  const visualLevel = phase === "user-speaking" && !isMuted ? audioLevel : 0;
  const style = { "--voice-level": visualLevel.toFixed(3) } as CSSProperties;
  const active = ["listening", "user-speaking", "agent-thinking", "agent-speaking"].includes(phase);

  return (
    <div className={`voice-orb-scene phase-${phase}`} style={style} aria-hidden="true">
      <div className="orb-aura orb-aura-one" />
      <div className="orb-aura orb-aura-two" />
      <div className="voice-orb">
        <div className="orb-shine" />
        {active ? <MicIcon className="orb-icon" /> : <PhoneIcon className="orb-icon" />}
        <div className="orb-waveform">
          {Array.from({ length: 9 }, (_, index) => (
            <span key={index} style={{ animationDelay: `${index * -70}ms` }} />
          ))}
        </div>
      </div>
    </div>
  );
}
