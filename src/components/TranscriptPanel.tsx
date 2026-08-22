"use client";

import { useEffect, useRef } from "react";
import type { TranscriptEntry } from "@/lib/realtime/types";
import { ChevronIcon } from "./Icons";

export function TranscriptPanel({ entries }: { entries: TranscriptEntry[] }) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [entries]);

  return (
    <details className="demo-panel transcript-panel" open>
      <summary>
        <span>
          <span className="panel-eyebrow">Transcript</span>
          Live Conversation
        </span>
        <span className="panel-count">{entries.filter((entry) => entry.role !== "system").length}</span>
        <ChevronIcon className="summary-chevron" />
      </summary>
      <div className="panel-scroll" aria-live="polite">
        {entries.length === 0 ? (
          <div className="panel-empty">
            <span className="empty-line" />
            <p>Your live conversation will appear here once the call begins.</p>
          </div>
        ) : (
          entries.map((entry) => (
            <article
              className={`transcript-entry role-${entry.role}${
                entry.severity ? ` severity-${entry.severity}` : ""
              }`}
              key={entry.id}
            >
              <div className="transcript-meta">
                <span>
                  {entry.role === "user"
                    ? "You"
                    : entry.role === "assistant"
                      ? "Receptionist"
                      : entry.severity === "error"
                        ? "System · error"
                        : "System"}
                </span>
                {entry.status === "in_progress" ? <i>live</i> : null}
              </div>
              <p>{entry.text}</p>
            </article>
          ))
        )}
        <div ref={endRef} />
      </div>
    </details>
  );
}
