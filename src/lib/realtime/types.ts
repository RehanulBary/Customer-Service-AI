export type CallPhase =
  | "idle"
  | "connecting"
  | "listening"
  | "user-speaking"
  | "agent-thinking"
  | "agent-speaking"
  | "ending"
  | "ended"
  | "error";

export type TranscriptRole = "user" | "assistant" | "system";

export type TranscriptEntry = {
  id: string;
  role: TranscriptRole;
  text: string;
  order: number;
  status?: "in_progress" | "completed" | "incomplete";
  severity?: "info" | "warning" | "error";
};

export type ActivityKind = "success" | "info" | "tool" | "warning" | "error";

export type AgentActivity = {
  id: string;
  kind: ActivityKind;
  message: string;
  timestamp: number;
};

export type CallSummary = {
  durationSeconds: number;
  confirmationNumber: string | null;
  escalationDepartment: string | null;
};
