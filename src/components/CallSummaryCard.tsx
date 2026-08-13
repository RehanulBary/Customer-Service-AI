import type { CallSummary } from "@/lib/realtime/types";
import { CheckIcon } from "./Icons";

export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

export function CallSummaryCard({ summary }: { summary: CallSummary }) {
  return (
    <section className="call-summary-card" aria-label="Call summary">
      <div className="summary-check"><CheckIcon /></div>
      <div>
        <span className="panel-eyebrow">Call summary</span>
        <h3>Thank you for calling</h3>
      </div>
      <dl>
        <div>
          <dt>Duration</dt>
          <dd>{formatDuration(summary.durationSeconds)}</dd>
        </div>
        <div>
          <dt>Reservation</dt>
          <dd>{summary.confirmationNumber ?? "No reservation created"}</dd>
        </div>
        {summary.escalationDepartment ? (
          <div>
            <dt>Hotel team</dt>
            <dd>Queued for {summary.escalationDepartment}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
