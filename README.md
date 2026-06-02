# AgentsApp

WhatsApp-first operating system for real-estate brokers and builders.

This repo is the Next.js 16 + Supabase web application. It hosts the public
landing page, the broker PWA, the builder dashboard, the admin verification
console, and the WhatsApp webhook that powers the in-chat bot.

## Stack

- **Frontend:** Next.js 16 (App Router), React 19, Tailwind CSS v4,
  `lucide-react` icons.
- **Backend:** Supabase (Postgres) accessed via `@supabase/supabase-js`
  with both a public anon client (`src/lib/supabase.ts`) and a server-side
  service-role client (`src/lib/supabaseAdmin.ts`).
- **WhatsApp:** Meta Cloud API webhook handshake (GET) plus inbound POST
  routing for Meta, GallaBox, and a local simulator. Outbound replies go
  through GallaBox.
- **AI:** Not yet wired up. The bot currently uses a regex / keyword
  intent matcher; GPT-4o + Whisper integration is on the roadmap.

## Getting started

```bash
# 1. Install
npm install

# 2. Configure environment
cp .env.example .env.local
# fill in the Supabase + WhatsApp values

# 3. Apply schema + migrations to your Supabase project
#    Run supabase/schema.sql once for a fresh project,
#    then every file in supabase/migrations/ in order.
#    (Open the Supabase SQL editor and paste each file.)

# 4. Develop
npm run dev
# → http://localhost:3000
```

### Demo accounts

After running the seed in `supabase/schema.sql` you can sign in on the
`/auth/login` page with any of these phone numbers. The OTP is generated
server-side and delivered to your WhatsApp via GallaBox; in development
the OTP is also echoed to the server console (see "Auth in dev" below)
so you can grab it without needing a real WhatsApp message.

| Phone              | Role   | Notes                                  |
|--------------------|--------|----------------------------------------|
| `+91 98765 43210`  | agent  | Sreenivas Rao — has leads, points, etc.|
| `+91 88888 88888`  | builder| Prestige Group                          |
| `+91 99999 99999`  | admin  | Verification console                   |

### Auth in dev

When `NODE_ENV !== 'production'`, the `requestOtp` server action also logs
the OTP to the server console and returns it in the response — so you can
log in even if GallaBox isn't configured locally:

```
[auth] OTP for +91 98765 43210: 482917 (delivery: skipped)
```

In production the OTP is **only** delivered via WhatsApp.

### Generating AUTH_SECRET

The session JWT is signed with HS256 keyed by `AUTH_SECRET`. Generate one:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Set it in `.env.local` and in your Vercel project's environment variables.

## Routes

| Path                        | Audience  | Status            |
|-----------------------------|-----------|-------------------|
| `/`                         | public    | Landing page      |
| `/auth/login`               | public    | OTP + onboarding  |
| `/agent/dashboard`          | broker    | Live              |
| `/agent/pipeline`           | broker    | Live (Kanban+List)|
| `/agent/inventory`          | broker    | UI only           |
| `/agent/rewards`            | broker    | Live              |
| `/agent/{documents,launches,reminders,profile,settings}` | broker | UI only |
| `/builder/dashboard`        | builder   | UI only           |
| `/builder/projects/new`     | builder   | UI only           |
| `/builder/agents`           | builder   | Live              |
| `/builder/campaigns`        | builder   | UI only           |
| `/admin/dashboard`          | admin     | UI only           |
| `/admin/verification`       | admin     | Live (approve/reject) |
| `/api/whatsapp/webhook`     | system    | GET + POST        |
| `/api/whatsapp/send`        | system    | Outbound helper   |

## Project documents

The full product, architecture, and screen specs live in `docs/` and at the
repo root:

- `docs/AgentsApp_Project_Document (1).docx` — full project document.
- `docs/agentsapp_production_technical_document.pdf` — technical spec.
- `agentsapp_complete_screen_architecture.pdf` — 76-screen architecture.

## Conventions

- Server-only Supabase access uses `supabaseAdmin` (service-role key).
- Browser-side Supabase access uses the anon client. Once RLS is rolled
  out (PR #2), all sensitive mutations move to server actions.
- WhatsApp webhook POST is signature-verified against
  `WHATSAPP_APP_SECRET` when that env var is set. Leave it blank in dev.

## Scripts

```bash
npm run dev     # next dev
npm run build   # next build
npm run start   # next start
npm run lint    # eslint
```
