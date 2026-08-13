# Shapla Grand Realtime Receptionist

A complete browser-based speech-to-speech hotel receptionist prototype. The caller speaks through the browser microphone, hears the receptionist over WebRTC, can interrupt naturally, and can create, modify, look up, or cancel reservations that are persisted to local JSON.

Shapla Grand Hotel and every policy, room, price, phone number, guest, and reservation in this repository are fictional.

## What works

- Native OpenAI Realtime audio-to-audio conversation using `gpt-realtime-2.1`
- `RealtimeAgent` and `RealtimeSession` from the official TypeScript Agents SDK
- Browser microphone and speaker transport over WebRTC
- Server-minted ephemeral client credentials—the standard API key never reaches the browser
- Semantic voice activity detection, hands-free turns, and barge-in
- Live caller and receptionist transcripts
- Observable tool and connection activity without hidden model reasoning
- Typed, server-executed tools for hotel facts, availability, booking, lookup, modification, cancellation, and escalation
- Capacity-aware inventory, date-overlap calculations, and BDT pricing
- Atomic JSON reservation writes protected by a process-level mutex
- Demo admin screen and guarded reset to seed data
- Deterministic backend and SDK-configuration tests

This is not a chained speech-to-text → chat → text-to-speech system. `gpt-realtime-2.1` consumes and produces live audio in one persistent Realtime session. Input transcription is enabled only to render the secondary conversation panel.

## Requirements

- Node.js 20.9 or newer
- A modern browser with microphone and WebRTC support
- An OpenAI API project with access to the selected Realtime model
- An `OPENAI_API_KEY` stored only on the server

## Setup

```bash
npm install
cp .env.example .env.local
```

Open `.env.local` and add your standard server API key:

```dotenv
OPENAI_API_KEY=sk-proj-...
OPENAI_REALTIME_MODEL=gpt-realtime-2.1
OPENAI_REALTIME_VOICE=marin
```

Start the application:

```bash
npm run dev
```

Then:

1. Open [http://localhost:3000](http://localhost:3000).
2. Select **Call Reception**.
3. Allow microphone access.
4. Speak normally—there is no push-to-talk button.
5. Interrupt the receptionist whenever you want to change direction.

The demo reservation screen is at [http://localhost:3000/admin](http://localhost:3000/admin).

## Choosing the model or voice

The default model is:

```dotenv
OPENAI_REALTIME_MODEL=gpt-realtime-2.1
```

For a lower-cost test, change only the environment variable and restart the development server:

```dotenv
OPENAI_REALTIME_MODEL=gpt-realtime-2.1-mini
```

Both values are explicitly allowlisted. The voice defaults to `marin`; change `OPENAI_REALTIME_VOICE` to another voice listed in [`src/config/realtime.ts`](src/config/realtime.ts). Realtime voices cannot be changed after a session has begun speaking, so voice selection happens before connection.

## Architecture

```text
Browser / Next.js client
  ├── RealtimeAgent + typed function tools
  ├── RealtimeSession
  ├── microphone, speaker, semantic VAD, transcripts
  └── OpenAIRealtimeWebRTC
              │
              │ ephemeral ek_ credential + WebRTC audio/data
              ▼
       OpenAI Realtime API
       gpt-realtime-2.1
              │
              │ model invokes SDK function tools
              ▼
Browser tool executor (same-origin fetch)
              │
              ▼
Next.js server routes
  ├── Zod validation and stable result envelopes
  ├── hotel service and deterministic availability logic
  ├── JSON repository with mutex + atomic rename
  └── data/*.json
```

The `RealtimeSession` must run in the browser to use the SDK's WebRTC transport and native media handling. Its function tools are thin clients: every operational call is sent to a same-origin Next.js server route. Only the server can access the filesystem or `OPENAI_API_KEY`.

The important separation is:

```text
Voice conversation → typed tool contract → hotel service → repository → JSON
```

A future PMS, REST booking engine, CRM, or PostgreSQL repository can replace the JSON repository without redesigning the voice agent or tool contracts.

## Realtime session flow

1. The call button explicitly requests a microphone stream.
2. `POST /api/realtime/client-secret` uses `OPENAI_API_KEY` server-side to call `POST /v1/realtime/client_secrets`.
3. The server returns only a short-lived `ek_…` credential plus the allowlisted model and voice.
4. The browser constructs `RealtimeAgent`, `RealtimeSession`, and `OpenAIRealtimeWebRTC` with the existing microphone stream.
5. The SDK connects directly to OpenAI using WebRTC and applies the agent instructions, tools, low reasoning effort, output voice, and semantic VAD settings.
6. Realtime events update the call state, transcript, and observable activity panel.
7. On End Call, the session, audio tracks, audio element, level meter, timer, and audio context are released; the transcript and summary remain visible.

The implementation follows the current official [Voice agents guide](https://developers.openai.com/api/docs/guides/voice-agents), [Realtime WebRTC guide](https://developers.openai.com/api/docs/guides/realtime-webrtc), and [Realtime VAD guide](https://developers.openai.com/api/docs/guides/realtime-vad).

## Hotel tools

The agent has seven separate semantic tools:

| Tool | Responsibility |
| --- | --- |
| `get_hotel_information` | Policies, facilities, location, times, meals, parking, payments, and FAQs |
| `search_room_availability` | Live capacity, overlapping inventory, room combinations, nights, and total prices |
| `lookup_reservation` | Privacy-aware lookup by confirmation number or verified phone details |
| `create_reservation` | Validated, explicitly confirmed booking creation |
| `modify_reservation` | Confirmed changes with inventory recheck and repricing |
| `cancel_reservation` | Confirmed status change to `cancelled`, retaining history |
| `escalate_to_human` | Simulated front-desk, manager, or safety queue |

All tool endpoints return one of these predictable envelopes:

```json
{
  "ok": true,
  "data": {}
}
```

```json
{
  "ok": false,
  "error": {
    "code": "ROOM_UNAVAILABLE",
    "message": "That room is no longer available for the requested stay. Please search again.",
    "retryable": false
  }
}
```

The write schemas require `confirmed: true`, providing a backend guard in addition to the receptionist instructions. The agent is instructed to set it only after speaking the essential action summary and hearing an explicit affirmative response.

## JSON data

```text
data/
  hotel.json                fictional policies, amenities, landmarks, and FAQs
  rooms.json                room types, capacity, rates, inventory, views
  reservations.seed.json    immutable demo reset source
  reservations.json         mutable prototype reservation state
```

Reservation IDs use a caller-friendly `SGH-#####` format. Active reservations reduce effective inventory whenever their half-open stay range `[check-in, check-out)` overlaps the requested range. Cancelled reservations remain in history but do not consume rooms.

Writes are serialized inside one Node.js process. Each updated reservation list is validated, written to a unique temporary sibling file, and atomically renamed over `reservations.json`. This prevents partial JSON if two calls finish close together.

### Important persistence limitation

JSON persistence is deliberately limited to this local, single-process prototype. It is not suitable for serverless hosts, multiple application instances, durable production workloads, or untrusted admin access. Replace `JsonHotelRepository` with a transactional database or hotel PMS adapter before deployment.

## Example conversations

### Availability and gradual details

```text
Receptionist: Good evening, you've reached Shapla Grand reception. How may I help?

Caller: I'm coming to Dhaka tomorrow with my family.
Receptionist: Of course. How many of you will be staying, and for how long?

Caller: Six people. Probably two nights.
Receptionist: Certainly—let me see what would work for six guests.

[search_room_availability runs]

Receptionist: Two Deluxe Twin rooms would be seventeen thousand taka per night,
and two Family Suites would be twenty-nine thousand. The twins are the better value.

Caller: Actually, make that three nights. Which has the better view?
```

The last explicit correction replaces the previous duration, and the agent searches again before quoting a new total.

### Explicit booking confirmation

```text
Caller: Let's take the Family Suite.
Receptionist: Certainly. May I have the name and best phone number for the booking?

...

Receptionist: Just to confirm: one Family Suite, Friday through Sunday,
four guests, with a city-view preference, at twenty-nine thousand taka total.
Shall I confirm it?

Caller: Yes.

[create_reservation runs]

Receptionist: You're confirmed. Your reservation number is SGH-28417.
```

Saying “that sounds good” while discussing an option is not enough to write a reservation.

## Admin demonstration

The `/admin` route verifies the versioned prompt source and registered seven-tool contract used to build each Realtime session, without exposing hidden prompt text. A live call's **Agent Activity** panel separately confirms that OpenAI acknowledged those instructions and tools. The admin route reads `reservations.json` through the same repository and shows:

- confirmation number
- guest and booking phone
- stay dates
- room type and count
- total guests
- status
- BDT total

After a successful voice booking, use **Refresh** to show the new record. **Reset Demo Data** uses a two-step confirmation and restores `reservations.seed.json`. The route has no authentication because it is a local demonstration; it is prominently marked as such.

## Quality checks

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

With the development server running and a valid API key configured, you can also run a small live-model integration check:

```bash
npm run test:realtime-smoke
```

It opens a text-mode `gpt-realtime-2.1` session using the same versioned receptionist instructions and tools, drives a confirmed booking, verifies the JSON record, and restores the reservation seed in a `finally` block. It consumes a small amount of Realtime API usage and should only be run against local demo data.

The tests cover:

- date validation, night counts, and half-open overlap boundaries
- room capacity and automatically derived room combinations
- inventory subtraction and cancelled-record behavior
- budget/view filters and full-stay BDT pricing
- creation, modification, cancellation, lookup privacy, and reset
- unavailable inventory rejection
- serialized concurrent booking attempts
- corrupt JSON failures
- explicit confirmation validation
- generated Agents SDK session configuration and all seven tool definitions
- live session acknowledgement of the prompt version and complete tool list
- browser tool execution wiring for `create_reservation`

Natural spoken behavior is intentionally evaluated manually instead of with brittle unit tests. Recommended voice checks include gradual details, corrections, price preferences, mid-sentence interruption, complete booking, specific-room refusal, cancellation confirmation, and immediate human escalation.

## Troubleshooting

### Microphone permission denied

Use the browser's site controls to allow microphone access for `localhost`, then select **Try Again**. A secure context is required for microphone capture; `http://localhost` is accepted by browsers for local development, while a remote deployment must use HTTPS.

### No microphone or microphone busy

Connect an input device and close conferencing or recording applications that may have exclusive access. Reload the page if the operating system changed devices while it was open.

### OpenAI authentication failed

- Confirm `.env.local` exists at the repository root.
- Ensure `OPENAI_API_KEY` is a valid standard server key, not an ephemeral `ek_…` key.
- Confirm the API project has Realtime model access and available usage quota.
- Restart `npm run dev` after changing environment variables.

The standard API key is read only inside `POST /api/realtime/client-secret`. It must never be prefixed with `NEXT_PUBLIC_`.

### WebRTC connection fails

- Try a current Chrome, Edge, Safari, or Firefox release.
- Disable strict VPN/firewall filtering temporarily to identify blocked WebRTC traffic.
- Check that the page is `localhost` or HTTPS.
- Check the browser console and development server log; normal callers see only sanitized messages.
- Select **Try Again** to request a fresh ephemeral credential. Ephemeral credentials are not reused.

### Transcript differs slightly from what was spoken

The caller transcript is a secondary realtime transcription intended for demonstration and debugging. The speech-to-speech model listens directly to the audio; it does not depend on that rendered text to conduct the conversation.

### The agent talks but does not call booking tools

- End the current call and start a new one after any prompt or tool-code change; live Realtime sessions retain the configuration they connected with.
- Restart `npm run dev`, then open `/admin`. **System instructions** should show the `shapla-receptionist-v2.1` version and **Business tools** should show `7/7 active`.
- During a new call, expand **Agent Activity**. It should report that the receptionist instructions and all seven tools were acknowledged. Availability and booking actions then appear as `→ search_room_availability` and `→ create_reservation`.
- A reservation is intentionally written only after the receptionist reads the final booking summary and the caller explicitly confirms it. After that final “yes,” `create_reservation` should run immediately.
- If a tool event shows an issue, use its caller-safe message to correct the missing or invalid value. The full development error is available in the browser console or server log.

### Reservation JSON is malformed

The repository refuses to operate on invalid data instead of overwriting it. Restore a valid file or use the admin reset when `reservations.seed.json` is intact. Server logs include development diagnostics; API responses never return stack traces.

## Not included

This focused prototype intentionally excludes telephony/SIP, Twilio, WhatsApp, payments, authentication, a production database, cloud infrastructure, vector search, multiple agents, and room-level assignment. Browser microphone and speaker audio simulate the future phone call.
