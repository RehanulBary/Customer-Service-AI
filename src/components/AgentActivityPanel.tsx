import type { AgentActivity } from "@/lib/realtime/types";
import { CheckIcon, ChevronIcon } from "./Icons";

function activityMark(kind: AgentActivity["kind"]): string {
  if (kind === "tool") return "→";
  if (kind === "warning") return "!";
  if (kind === "error") return "×";
  return "✓";
}

export function AgentActivityPanel({ events }: { events: AgentActivity[] }) {
  return (
    <details className="demo-panel activity-panel">
      <summary>
        <span>
          <span className="panel-eyebrow">Observable events</span>
          Agent Activity
        </span>
        <span className="panel-count">{events.length}</span>
        <ChevronIcon className="summary-chevron" />
      </summary>
      <div className="activity-list">
        {events.length === 0 ? (
          <div className="panel-empty compact">
            <CheckIcon />
            <p>Connection and hotel system events will appear here.</p>
          </div>
        ) : (
          events.map((event) => (
            <div className={`activity-row kind-${event.kind}`} key={event.id}>
              <span className="activity-mark">{activityMark(event.kind)}</span>
              <span>{event.message}</span>
              <time>{new Date(event.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time>
            </div>
          ))
        )}
      </div>
    </details>
  );
}
