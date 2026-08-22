"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ApiResult } from "@/lib/hotel/errors";
import {
  AlertIcon,
  CalendarIcon,
  CheckIcon,
  ChevronIcon,
  DatabaseIcon,
  RefreshIcon,
  UsersIcon,
} from "./Icons";

type AdminReservation = {
  confirmationNumber: string;
  guestName: string;
  phone: string;
  checkInDate: string;
  checkOutDate: string;
  adults: number;
  children: number;
  roomTypeName: string;
  roomCount: number;
  status: "confirmed" | "cancelled";
  totalAmount: number;
  currency: "BDT";
  updatedAt: string;
};

type AgentConfiguration = {
  promptVersion: string;
  promptLoaded: boolean;
  instructionCharacters: number;
  model: string;
  voice: string;
  apiKeyConfigured: boolean;
  tools: Array<{ name: string; loaded: boolean }>;
  sessionSettings: {
    outputModalities: string[];
    reasoningEffort: string;
    parallelToolCalls: boolean;
    historyStoreAudio: boolean;
    audio: {
      noiseReduction: string;
      transcriptionModel: string;
      transcriptionLanguage: string;
      transcriptionDelay: string;
      turnDetection: {
        type: string;
        eagerness: string;
        createResponse: boolean;
        interruptResponse: boolean;
      };
    };
  };
  promptAnchors: Array<{ phrase: string; present: boolean }>;
  verification: {
    requiredToolCount: number;
    requiredPromptVersion: string;
    requiredModel: string[];
    requiredOutputModalities: string[];
  };
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 0,
  })
    .format(value)
    .replace("BDT", "৳");
}

async function requestReservations(): Promise<AdminReservation[]> {
  const response = await fetch("/api/admin/reservations", { cache: "no-store" });
  const payload = (await response.json()) as ApiResult<{ reservations: AdminReservation[] }>;
  if (!payload.ok) throw new Error(payload.error.message);
  return payload.data.reservations;
}

async function requestAgentConfiguration(): Promise<AgentConfiguration> {
  const response = await fetch("/api/admin/agent-config", { cache: "no-store" });
  const payload = (await response.json()) as ApiResult<AgentConfiguration>;
  if (!payload.ok) throw new Error(payload.error.message);
  return payload.data;
}

export function AdminDashboard() {
  const [reservations, setReservations] = useState<AdminReservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [agentConfiguration, setAgentConfiguration] = useState<AgentConfiguration | null>(null);

  const loadReservations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setReservations(await requestReservations());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Reservations could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([requestReservations(), requestAgentConfiguration()])
      .then(([items, configuration]) => {
        if (!cancelled) {
          setReservations(items);
          setAgentConfiguration(configuration);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Reservations could not be loaded.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const metrics = useMemo(() => {
    const active = reservations.filter((reservation) => reservation.status === "confirmed");
    return {
      total: reservations.length,
      active: active.length,
      guests: active.reduce(
        (sum, reservation) => sum + reservation.adults + reservation.children,
        0,
      ),
      value: active.reduce((sum, reservation) => sum + reservation.totalAmount, 0),
    };
  }, [reservations]);

  const resetData = useCallback(async () => {
    setIsResetting(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/reset", { method: "POST" });
      const payload = (await response.json()) as ApiResult<{ message: string }>;
      if (!payload.ok) throw new Error(payload.error.message);
      setMessage(payload.data.message);
      setConfirmReset(false);
      await loadReservations();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Demo data could not be reset.");
    } finally {
      setIsResetting(false);
    }
  }, [loadReservations]);

  return (
    <section className="admin-content">
      <div className="admin-heading">
        <div>
          <p className="overline"><span /> Demo operations</p>
          <h1>Reservation state</h1>
          <p>Every confirmed voice booking appears here after the tool writes it to the JSON store.</p>
        </div>
        <button className="refresh-button" type="button" onClick={() => void loadReservations()} disabled={isLoading}>
          <RefreshIcon />
          Refresh
        </button>
      </div>

      <div className="admin-notice">
        <AlertIcon />
        <div>
          <strong>Unauthenticated prototype area</strong>
          <span>This screen is for local demonstrations only. Do not expose it as a production admin interface.</span>
        </div>
      </div>

      <div className="agent-config-card">
        <div>
          <span className="panel-eyebrow">Realtime agent configuration</span>
          <h2>Receptionist instructions &amp; tools</h2>
          <p>
            This verifies the versioned prompt source and registered tool contract used to build
            each new live call. Hidden prompt text is not exposed here.
          </p>
        </div>
        {agentConfiguration ? (
          <div className="agent-config-status">
            <div>
              <span className={agentConfiguration.promptLoaded ? "config-ok" : "config-bad"}>
                {agentConfiguration.promptLoaded ? "✓" : "×"}
              </span>
              <strong>System instructions</strong>
              <small>
                {agentConfiguration.promptVersion} ·{" "}
                {agentConfiguration.instructionCharacters.toLocaleString()} characters
              </small>
            </div>
            <div>
              <span
                className={
                  agentConfiguration.tools.every((tool) => tool.loaded) ? "config-ok" : "config-bad"
                }
              >
                {agentConfiguration.tools.every((tool) => tool.loaded) ? "✓" : "×"}
              </span>
              <strong>Business tools</strong>
              <small>
                {agentConfiguration.tools.filter((tool) => tool.loaded).length}/
                {agentConfiguration.tools.length} active · {agentConfiguration.model} ·{" "}
                {agentConfiguration.voice} · key{" "}
                {agentConfiguration.apiKeyConfigured ? "configured" : "missing"}
              </small>
            </div>
            <div>
              <span className="config-ok">✓</span>
              <strong>Live session verification</strong>
              <small>
                requires {agentConfiguration.verification.requiredToolCount} tools · v
                {agentConfiguration.verification.requiredPromptVersion.split("v").pop()} ·{" "}
                {agentConfiguration.sessionSettings.outputModalities.join("+")} · VAD{" "}
                {agentConfiguration.sessionSettings.audio.turnDetection.type.replace("_", " ")}
              </small>
            </div>
          </div>
        ) : null}
        {agentConfiguration ? (
          <details className="prompt-anchors">
            <summary>
              <span>
                Prompt anchor phrases
                <small>
                  {" "}
                  {agentConfiguration.promptAnchors.every((anchor) => anchor.present)
                    ? `${agentConfiguration.promptAnchors.length}/${agentConfiguration.promptAnchors.length} present`
                    : `${agentConfiguration.promptAnchors.filter((anchor) => anchor.present).length}/${agentConfiguration.promptAnchors.length} present`}
                </small>
              </span>
              <ChevronIcon className="summary-chevron" />
            </summary>
            <ul>
              {agentConfiguration.promptAnchors.map((anchor) => (
                <li
                  key={anchor.phrase}
                  className={anchor.present ? "anchor-present" : "anchor-missing"}
                >
                  <span aria-hidden>{anchor.present ? "✓" : "×"}</span>
                  <code>{anchor.phrase}</code>
                </li>
              ))}
            </ul>
          </details>
        ) : (
          <div className="table-state">Checking agent configuration…</div>
        )}
      </div>

      <div className="metrics-grid">
        <article>
          <span className="metric-icon"><DatabaseIcon /></span>
          <div><small>All records</small><strong>{metrics.total}</strong></div>
        </article>
        <article>
          <span className="metric-icon"><CheckIcon /></span>
          <div><small>Confirmed</small><strong>{metrics.active}</strong></div>
        </article>
        <article>
          <span className="metric-icon"><UsersIcon /></span>
          <div><small>Active guests</small><strong>{metrics.guests}</strong></div>
        </article>
        <article>
          <span className="metric-icon"><CalendarIcon /></span>
          <div><small>Booked value</small><strong>{formatMoney(metrics.value)}</strong></div>
        </article>
      </div>

      {error ? <div className="admin-feedback is-error" role="alert">{error}</div> : null}
      {message ? <div className="admin-feedback is-success" role="status">{message}</div> : null}

      <div className="reservations-card">
        <div className="table-header">
          <div>
            <span className="panel-eyebrow">JSON-backed data</span>
            <h2>Demo reservations</h2>
          </div>
          <span className="record-count">{reservations.length} records</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Confirmation</th>
                <th>Guest</th>
                <th>Stay</th>
                <th>Room</th>
                <th>Guests</th>
                <th>Status</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7}><div className="table-state"><span className="spinner dark" /> Loading reservations…</div></td></tr>
              ) : reservations.length === 0 ? (
                <tr><td colSpan={7}><div className="table-state">No reservations in the demo store.</div></td></tr>
              ) : (
                reservations.map((reservation) => (
                  <tr key={reservation.confirmationNumber}>
                    <td><strong className="confirmation-code">{reservation.confirmationNumber}</strong></td>
                    <td><strong>{reservation.guestName}</strong><small>{reservation.phone}</small></td>
                    <td><strong>{formatDate(reservation.checkInDate)}</strong><small>to {formatDate(reservation.checkOutDate)}</small></td>
                    <td><strong>{reservation.roomTypeName}</strong><small>{reservation.roomCount} room{reservation.roomCount === 1 ? "" : "s"}</small></td>
                    <td>{reservation.adults + reservation.children}</td>
                    <td><span className={`reservation-status status-${reservation.status}`}><i /> {reservation.status}</span></td>
                    <td><strong>{formatMoney(reservation.totalAmount)}</strong></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="reset-zone">
        <div>
          <strong>Reset demonstration data</strong>
          <span>Replace current reservations with the four original fictional seed records.</span>
        </div>
        {confirmReset ? (
          <div className="reset-confirmation">
            <span>This replaces all demo changes. Continue?</span>
            <button type="button" onClick={() => setConfirmReset(false)} disabled={isResetting}>Keep data</button>
            <button className="danger-button" type="button" onClick={() => void resetData()} disabled={isResetting}>
              {isResetting ? "Resetting…" : "Reset now"}
            </button>
          </div>
        ) : (
          <button className="reset-button" type="button" onClick={() => setConfirmReset(true)}>Reset Demo Data</button>
        )}
      </div>
    </section>
  );
}
