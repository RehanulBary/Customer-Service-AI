"use client";

import { useRealtimeReceptionist } from "@/hooks/useRealtimeReceptionist";
import { AgentActivityPanel } from "./AgentActivityPanel";
import { CallControls } from "./CallControls";
import { CallSummaryCard, formatDuration } from "./CallSummaryCard";
import { ConnectionStatus } from "./ConnectionStatus";
import { HotelHeader } from "./HotelHeader";
import { TranscriptPanel } from "./TranscriptPanel";
import { VoiceOrb } from "./VoiceOrb";
import { AlertIcon } from "./Icons";

export function HotelReceptionistDemo() {
  const call = useRealtimeReceptionist();
  const active = ["listening", "user-speaking", "agent-thinking", "agent-speaking"].includes(call.phase);

  return (
    <main className="site-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <HotelHeader />

      <section className="hero-intro">
        <div>
          <p className="overline"><span /> AI Voice Receptionist</p>
          <h1>Reception, reimagined<br /><em>as a conversation.</em></h1>
        </div>
        <p className="hero-description">
          Speak naturally with Shapla Grand&apos;s realtime receptionist. Ask about the hotel,
          find a room, or make a complete demo reservation by voice.
        </p>
      </section>

      <div className="experience-grid">
        <section className="call-stage">
          <div className="call-stage-topline">
            <span>Shapla Grand · Front Desk</span>
            <span className="realtime-badge"><i /> Realtime</span>
          </div>

          <div className="call-stage-content">
            <VoiceOrb phase={call.phase} audioLevel={call.audioLevel} isMuted={call.isMuted} />
            <ConnectionStatus phase={call.phase} />

            {active || call.phase === "ending" ? (
              <div className="call-duration" aria-label={`Call duration ${formatDuration(call.durationSeconds)}`}>
                {formatDuration(call.durationSeconds)}
              </div>
            ) : null}

            {call.errorMessage ? (
              <div className="call-error" role="alert">
                <AlertIcon />
                <span>{call.errorMessage}</span>
              </div>
            ) : null}

            {call.summary && (call.phase === "ended" || call.phase === "error") ? (
              <CallSummaryCard summary={call.summary} />
            ) : null}

            <CallControls
              phase={call.phase}
              isMuted={call.isMuted}
              isSpeakerMuted={call.isSpeakerMuted}
              onStart={() => void call.startCall()}
              onEnd={call.endCall}
              onToggleMute={call.toggleMute}
              onToggleSpeaker={call.toggleSpeaker}
            />

            <div className="call-assurances" aria-label="Voice demo features">
              <span><i /> Hands-free conversation</span>
              <span><i /> Interrupt naturally</span>
              <span><i /> Secure session key</span>
            </div>
          </div>
        </section>

        <aside className="conversation-rail">
          <TranscriptPanel entries={call.transcript} />
          <AgentActivityPanel events={call.activity} />
          <div className="prototype-note">
            <span>Prototype environment</span>
            <p>Hotel inventory and reservations are fictional and stored locally for this demonstration.</p>
          </div>
        </aside>
      </div>

      <footer className="site-footer">
        <span>Shapla Grand Hotel is a fictional brand created for this demonstration.</span>
        <span>Powered by realtime conversational AI</span>
      </footer>
    </main>
  );
}
