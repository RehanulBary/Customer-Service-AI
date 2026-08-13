import path from "node:path";
import { createServer } from "vite";
import { RealtimeSession } from "@openai/agents/realtime";

const origin = process.env.REALTIME_SMOKE_ORIGIN ?? "http://localhost:3000";
const model = process.env.OPENAI_REALTIME_MODEL ?? "gpt-realtime-2.1";
const voice = process.env.OPENAI_REALTIME_VOICE ?? "marin";
const deadlineMs = 45_000;

function waitFor(predicate, label) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const value = predicate();
      if (value) {
        clearInterval(timer);
        resolve(value);
      } else if (Date.now() - startedAt > deadlineMs) {
        clearInterval(timer);
        reject(new Error(`Timed out waiting for ${label}.`));
      }
    }, 100);
  });
}

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  const payload = await response.json();
  if (!response.ok || payload?.ok !== true) {
    throw new Error(payload?.error?.message ?? `${url} returned ${response.status}.`);
  }
  return payload.data;
}

const vite = await createServer({
  appType: "custom",
  logLevel: "error",
  resolve: { alias: { "@": path.resolve("src") } },
  server: { middlewareMode: true },
});

let session;
let createdConfirmation = null;

try {
  const [{ createHotelReceptionistAgent }, credentials] = await Promise.all([
    vite.ssrLoadModule("/src/agents/hotelReceptionist.ts"),
    fetchJson(`${origin}/api/realtime/client-secret`, { method: "POST" }),
  ]);

  const toolExecutions = [];
  const agentOutputs = [];
  const executeHotelTool = async (name, input, signal) =>
    fetchJson(`${origin}/api/hotel/tools/${name}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
      signal,
    }).then((data) => ({ ok: true, data }));

  const agent = createHotelReceptionistAgent(voice, executeHotelTool);
  session = new RealtimeSession(agent, {
    model,
    transport: "websocket",
    tracingDisabled: true,
    config: {
      outputModalities: ["text"],
      audio: { input: { turnDetection: null } },
      reasoning: { effort: "low" },
      parallelToolCalls: false,
    },
  });

  session.on("agent_end", (_context, _agent, output) => {
    if (output.trim()) agentOutputs.push(output.trim());
  });
  session.on("agent_tool_end", (_context, _agent, tool, result) => {
    let parsed = null;
    try {
      parsed = JSON.parse(result);
    } catch {
      parsed = null;
    }
    toolExecutions.push({ name: tool.name, result: parsed });
    if (
      tool.name === "create_reservation" &&
      parsed?.ok === true &&
      typeof parsed.data?.confirmationNumber === "string"
    ) {
      createdConfirmation = parsed.data.confirmationNumber;
    }
  });

  await session.connect({ apiKey: credentials.clientSecret, model: credentials.model });
  session.sendMessage(
    "I want to book one Deluxe King from August 28, 2026 through August 29, 2026 for two adults and no children. The guest name is Realtime Smoke Test. The booking phone is plus eight eight zero one seven one one one two two two three three, and I confirm that number is correct. I prefer a city view. Please check availability and prepare the booking.",
  );

  await waitFor(
    () => toolExecutions.some((entry) => entry.name === "search_room_availability"),
    "search_room_availability",
  );
  await waitFor(
    () => agentOutputs.some((output) => /confirm|proceed|book it/i.test(output)),
    "the final booking confirmation question",
  );

  session.sendMessage(
    "Yes. I explicitly confirm that exact booking. Please create the reservation now.",
  );
  await waitFor(() => createdConfirmation, "create_reservation");

  const reservations = await fetchJson(`${origin}/api/admin/reservations`);
  const persisted = reservations.reservations.some(
    (reservation) => reservation.confirmationNumber === createdConfirmation,
  );
  if (!persisted) throw new Error("The Realtime tool returned success but the record was not persisted.");

  console.log(
    JSON.stringify({
      ok: true,
      promptDrivenToolSequence: toolExecutions.map((entry) => entry.name),
      confirmationNumber: createdConfirmation,
      persisted,
    }),
  );
} finally {
  session?.close();
  await fetchJson(`${origin}/api/admin/reset`, { method: "POST" }).catch(() => undefined);
  await vite.close();
}
