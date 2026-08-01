# OpenWhats

A self-hosted "reverse WhatsApp Web": your own machine runs a WhatsApp
client in the background, and your applications talk to it over a local
REST API + outgoing webhooks — no human sitting at the keyboard scanning QR
codes every session, no cloud, no multi-tenant auth by default.

Built on [`@whiskeysockets/baileys`](https://github.com/WhiskeySockets/Baileys)
(no headless Chromium), Express, SQLite, and a React dashboard.

## Installation

**Prerequisites:** Node.js 18+ and npm. No database server, no Docker, no
cloud account — everything (SQLite file, WhatsApp session) lives under
`server/`.

```bash
git clone <this-repo>
cd reverse-whatsapp-web

# Server dependencies
cd server
cp .env.example .env
npm install

# Dashboard dependencies (optional, but recommended for first setup)
cd ../client
npm install
```

The defaults in `.env` work out of the box for local use — `HOST=127.0.0.1`
(not reachable from other devices), `REQUIRE_API_KEY=false`, and sane rate
gate limits. You only need to edit it if you're changing the port, exposing
the server beyond localhost (see [Security](#security)), or tuning the
[rate gate](#rate-gate-anti-ban-throttling).

## Running

### 1. Start the server

```bash
cd server
npm start          # plain node, stable for real use
# npm run dev       # node --watch — restarts (and drops the WhatsApp
                     # connection) on every file save; dev only
```

On first run, no session exists yet, so the server enters `qr_pending`
state and logs `reverse-whatsapp-web server listening on http://127.0.0.1:3000`.

### 2. Pair your WhatsApp account

Either open the dashboard (next step) and scan the QR code shown on the
Dashboard page, or fetch it directly:

```bash
curl http://127.0.0.1:3000/api/qr
```

Decode the returned base64 PNG and scan it from your phone: **WhatsApp →
Settings → Linked Devices → Link a Device**. The server terminal logs
`[whatsapp] state -> connected` once paired. The session is saved to
`server/.baileys-auth/`, so you won't need to re-scan on restart (unless
you log out or WhatsApp invalidates the session).

### 3. Start the dashboard (optional)

```bash
cd client
npm run dev
```

Open the printed URL (typically `http://localhost:5173`). It proxies
`/api/*` to the server on `127.0.0.1:3000` — no separate configuration
needed. The dashboard has four pages, reachable from the collapsible
sidebar:

- **Dashboard** — connection status, QR pairing, and a live Rate Gate panel
  (hourly/daily/new-contact usage meters, warm-up day, queue/backoff state)
- **Logs** — paginated inbound/outbound message history, filterable by direction
- **Playground** — send a text, media (file upload or URL), or bulk message
  by hand to test the API without writing any code
- **Settings** — manage any number of webhooks (add via a modal, paginated list, delete)

The sidebar can be collapsed to an icon-only rail (state persists across
reloads), and the whole UI supports light/dark theme (defaults to your OS
preference, toggle at the bottom of the sidebar) and is responsive down to
mobile widths.

### 4. Send your first message

Once `GET /api/status` reports `{"state":"connected"}`:

```bash
curl -X POST http://127.0.0.1:3000/api/send/text \
  -H "Content-Type: application/json" \
  -d '{"to": "60123456789@s.whatsapp.net", "message": "Hello from OpenWhats!"}'
```

The `to` field is always a WhatsApp JID: `<countrycode><number>@s.whatsapp.net`
(no `+`, no spaces/dashes).

## API usage guide

See `prompt.md` for the full contract this implements. All examples assume
the server is running on the default `http://127.0.0.1:3000`; add
`-H "x-api-key: <key>"` to every call if you've turned on
[`REQUIRE_API_KEY`](#security).

| Endpoint | Purpose |
|---|---|
| `GET /api/status` | `{ state, phoneNumber? }` |
| `GET /api/qr` | `{ qr: "<base64 png>" }`, only when `qr_pending` |
| `POST /api/logout` | clears session, forces re-scan |
| `POST /api/send/text` | `{ to, message }` |
| `POST /api/send/media` | `{ to, mediaUrl, caption?, type }`, or multipart with a `file` field instead of `mediaUrl` |
| `POST /api/send/bulk` | `{ recipients[], message }` or `{ recipients: [{to,...vars}], template }` — see [Rate gate](#rate-gate-anti-ban-throttling) |
| `GET /api/config/webhooks` | paginated list — query: `page`, `pageSize` (max 100) |
| `POST /api/config/webhooks` | create — `{ url, events }`; empty/omitted `events` matches all events |
| `DELETE /api/config/webhooks/:id` | remove a webhook |
| `GET /api/logs` | paginated message log — query: `page`, `pageSize` (max 100), `direction` (`inbound`/`outbound`) |
| `GET /api/rate-gate/status` | current cap usage, warm-up day, queue length, backoff state |

All send endpoints return `{ success, messageId, error? }` — except when a
send can't clear the rate gate's caps right now, in which case they return
`202 { success: false, queued: true, position }` instead of failing (see
[Rate gate](#rate-gate-anti-ban-throttling)).

### Status & pairing

```bash
curl http://127.0.0.1:3000/api/status
# { "state": "connected", "phoneNumber": "60123456789" }

curl http://127.0.0.1:3000/api/qr
# { "qr": "data:image/png;base64,..." }  — only present while state is qr_pending

curl -X POST http://127.0.0.1:3000/api/logout
# { "success": true }  — clears the saved session, next /api/qr issues a fresh code
```

### Sending

```bash
# Plain text
curl -X POST http://127.0.0.1:3000/api/send/text \
  -H "Content-Type: application/json" \
  -d '{"to": "60123456789@s.whatsapp.net", "message": "Hello!"}'

# Media by URL
curl -X POST http://127.0.0.1:3000/api/send/media \
  -H "Content-Type: application/json" \
  -d '{"to": "60123456789@s.whatsapp.net", "mediaUrl": "https://example.com/photo.jpg", "type": "image", "caption": "Check this out"}'

# Media by direct file upload (multipart — no publicly hosted URL needed)
curl -X POST http://127.0.0.1:3000/api/send/media \
  -F "to=60123456789@s.whatsapp.net" \
  -F "type=image" \
  -F "caption=Check this out" \
  -F "file=@/path/to/photo.jpg"

# Bulk — same text to everyone (fine for a couple of recipients)
curl -X POST http://127.0.0.1:3000/api/send/bulk \
  -H "Content-Type: application/json" \
  -d '{"recipients": ["60123456789@s.whatsapp.net", "60198765432@s.whatsapp.net"], "message": "Reminder: event tomorrow!"}'
```

`type` for `/api/send/media` is one of `image`, `video`, `document`. For
messaging more than a couple of people, use a `{{placeholder}}` template
instead of identical bulk text — see
[Avoid identical bulk text](#avoid-identical-bulk-text--use-a-template).

### Webhooks (the "reverse" part — receiving messages)

```bash
# Register a webhook — your app's endpoint receives inbound events here
curl -X POST http://127.0.0.1:3000/api/config/webhooks \
  -H "Content-Type: application/json" \
  -d '{"url": "https://myapp.local/incoming", "events": ["message"]}'

# List registered webhooks (paginated)
curl "http://127.0.0.1:3000/api/config/webhooks?page=1&pageSize=10"

# Remove one
curl -X DELETE http://127.0.0.1:3000/api/config/webhooks/1
```

You can register any number of webhooks. Each inbound event is fanned out
independently to every webhook subscribed to it (empty `events` = subscribed
to everything), each with its own retry/backoff.

`GET /api/config/webhooks` and `GET /api/logs` share the same paginated
response shape:

```json
{ "items": [{ "id": 1, "url": "...", "events": ["message"], "created_at": 1734567890123 }], "page": 1, "pageSize": 10, "total": 3, "totalPages": 1 }
```

Inbound WhatsApp messages are POSTed to each matching webhook URL as:

```json
{ "event": "message", "from": "...@s.whatsapp.net", "message": { "type": "text", "body": "hi" }, "timestamp": 1234567890 }
```

Delivery is retried up to 3 times with exponential backoff; failures are
recorded against the message row (`status: "webhook_failed"`), visible via
`GET /api/logs` or the dashboard's Logs page.

### Logs & rate gate status

```bash
curl "http://127.0.0.1:3000/api/logs?page=1&pageSize=25&direction=inbound"

curl http://127.0.0.1:3000/api/rate-gate/status
# { "hourly": {"count":0,"cap":40}, "daily": {"count":0,"cap":50}, ... }
```

## Security

- The server binds to **127.0.0.1 only** by default — it is not reachable
  from other devices on your network out of the box.
- To expose it beyond localhost, set `HOST=0.0.0.0` in `.env`. **Do this
  only if you understand the risk**: anyone who can reach that host/port can
  send/receive WhatsApp messages as you. The server logs a warning on
  startup if you do this.
- If you do expose it, also set `REQUIRE_API_KEY=true` and `API_KEY=<a
  long random value>` in `.env`, then send that value as an `x-api-key`
  header on every request. With `REQUIRE_API_KEY` unset (the default), the
  API key middleware is a no-op.

## Rate gate (anti-ban throttling)

WhatsApp flags accounts primarily on *sending patterns*, not just raw
volume. Every `/api/send/*` request passes through `whatsapp/rate-gate.js`
before it ever reaches Baileys — routes never call the socket directly.
It has six layers:

1. **Randomized per-message delay** — never a fixed gap. Picked from
   `RATE_MIN_DELAY_MS`–`RATE_MAX_DELAY_MS` (default 1500–4000ms) on every
   single send, floored at 1000ms no matter how it's configured.
2. **Rolling send caps** — `RATE_HOURLY_CAP` / `RATE_DAILY_CAP` (default
   40/hour, 200/day), tracked in a `send_log` table. Once hit, further
   sends don't fail — they're queued and retried automatically in the
   background as capacity frees up (a background worker re-checks every
   `RATE_QUEUE_WORKER_INTERVAL_MS`).
3. **Account warm-up curve** — the daily cap ramps up based on days since
   your *first successful connection* (persisted in the database), instead
   of allowing the full daily cap from day one. Default schedule
   (`RATE_WARMUP_SCHEDULE=1:50,4:100,8:200`): 50/day for days 1–3, 100/day
   for days 4–7, 200/day from day 8 on. Disable with `RATE_WARMUP_ENABLED=false`.
4. **New-contact throttle** — a separate, tighter daily cap
   (`RATE_NEW_CONTACT_DAILY_CAP`, default 25) for messaging numbers you've
   never exchanged a message with before, independent of overall cap headroom.
5. **Chunked bulk sends** — `/api/send/bulk` splits recipients into chunks
   of `RATE_BULK_CHUNK_SIZE` (default 15), with a longer randomized pause
   (`RATE_CHUNK_PAUSE_MIN_MS`–`RATE_CHUNK_PAUSE_MAX_MS`, default 30–90s)
   between chunks, on top of the per-message delay.
6. **Auto backoff on send errors** — after `RATE_ERROR_BACKOFF_THRESHOLD`
   (default 3) consecutive send failures, the queue pauses entirely for a
   bit (doubling on each further failure, capped at
   `RATE_ERROR_BACKOFF_MAX_MS`), then resumes with widened delays for a
   while rather than snapping back to full speed. Visible in the
   dashboard's Rate Gate panel.

### Queued sends

When a send can't clear the caps immediately, the API responds right away
with `202 { success: false, queued: true, position }` instead of blocking
the request — the message is logged with `status: "queued"` and a
background worker sends it automatically once capacity is available,
updating the log to `sent`/`failed` when it finally goes out. Check
`GET /api/logs` or the dashboard to see the final outcome.

### Avoid identical bulk text — use a template

`POST /api/send/bulk` accepts either plain string recipients (uses
`message` verbatim for everyone — fine for a couple of people, but
identical repeated text is itself a risk signal at volume) or recipient
objects paired with a `{{placeholder}}` template, which is the recommended
way to message more than a handful of people:

```json
{
  "recipients": [
    { "to": "60123456789@s.whatsapp.net", "name": "Alice" },
    { "to": "60198765432@s.whatsapp.net", "name": "Bob" }
  ],
  "template": "Hi {{name}}, just checking in!"
}
```

## Repo structure

```
reverse-whatsapp-web/
  server/
    src/
      whatsapp/
        session-manager.js      # Baileys connection lifecycle, QR, reconnect
        message-handler.js      # inbound message -> webhook dispatcher
        webhook-dispatcher.js   # retry-with-backoff HTTP delivery, fans out to all webhooks
        rate-gate.js            # anti-ban throttling — caps, warm-up curve, backoff, queue
      routes/                  # send.js, webhook.js, status.js
      store/                  # db.js, messages.js, webhooks.js, send-log.js
      middleware/              # optional-api-key.js
      config.js
    server.js
    .env.example
  client/
    src/
      pages/                   # Dashboard.jsx, Logs.jsx, Playground.jsx, Settings.jsx
      components/              # Sidebar.jsx, StatusPill.jsx, Modal.jsx, PageHeader.jsx, RateGateCard.jsx
      hooks/                   # useStatus.js, useTheme.js, useSidebarCollapsed.js, useRateGateStatus.js
      icons.jsx
      api.js
      App.jsx
```

## Notes

- The session manager is a singleton `EventEmitter` — there is exactly one
  Baileys socket for the process; routes read from it, they never
  instantiate their own.
- Reconnect logic distinguishes `DisconnectReason.loggedOut` (session is
  dead, clears auth state, waits for a fresh QR scan) from any other
  disconnect reason (auto-reconnects with the existing session).
- The QR code is never written to disk — only held in memory and served
  via `/api/qr` while `state === "qr_pending"`.
- The rate gate's deferred-send queue is in-memory: a queued send survives
  the caller's HTTP request ending, but not a server restart. Rolling caps
  and warm-up state themselves are persisted (SQLite), so restarting
  doesn't reset your quotas — only in-flight queued messages from the last
  few minutes before a restart would need to be resent.
