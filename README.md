# Tacet

Find out what the internet knows about you.

You verify your own email or phone number, add your usernames, and Tacet checks breach and leak
databases, thousands of sites and the open web. The report explains what was found and how to get
each item removed. With an account you also get breach monitoring and a data-broker opt-out tracker.

Emails and phones are scanned only after you prove they are yours. Leaked records are never stored,
only facts about them (breach name, date, kinds of data exposed).

## Stack

- Next.js 16 (App Router), React 19, Tailwind CSS 4
- Postgres (`pg`, Neon in production)
- undici for outbound requests, Puppeteer for the browser-based search
- Gemini or Claude for the written analysis, with a rule-based fallback

## Getting started

```bash
npm install
cp .env.example .env.local
npm run dev
```

With `NOISE_DEV_MODE=1` verification codes are shown on screen instead of being sent, so no mail or
SMS provider is needed locally. `DATABASE_URL` must point to a Postgres database; the schema is
created on first start.

```bash
npm run typecheck
npm run lint
npm run build
```

## Project structure

```
src/
  app/                 pages and API routes
  components/
    landing/           marketing page sections
    layout/            header, footer, shared chrome
    scan/              scan flow: input, verification, progress, report
    account/           dashboard and sign-in
    legal/             legal page layout
  lib/                 code shared by client and server
  types/               shared types
  server/
    auth/              accounts, sessions, ownership verification
    scan/              scan pipeline, admission queue, analysis
      sources/         individual data sources
    security/          rate limiting, disposable email filter
    notifications/     email and Telegram
    jobs/              scheduled breach monitoring
    analytics/         anonymous funnel counters
    utils/             concurrency primitives, request helpers
```

## How a scan works

`POST /api/scan` accepts ownership proofs for emails and phones plus usernames, and streams NDJSON
events back (`queue`, `step`, `finding`, `report`, `done`). Steps run in parallel:

| Step | Sources |
|---|---|
| Breaches | HIBP or XposedOrNot, LeakCheck, Hudson Rock |
| Profiles | hand-written probes, WhatsMyName and Maigret site lists |
| Open web | DuckDuckGo, Bing, SearXNG, Wayback Machine, archive.today, Brave |
| Browser search | several search engines through headless Chrome |
| Analysis | Gemini, Claude, or rules |

Everything that costs resources is bounded: scans take slots and wait in a queue when the server is
busy, outbound requests have global and per-host limits, and closing the page cancels the scan.
Limits are configured through the `NOISE_*` variables in `.env.example`.

## Environment

| Variable | Purpose |
|---|---|
| `NOISE_SECRET` | signs verification tokens, required in production |
| `DATABASE_URL` | Postgres connection string |
| `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` | AI analysis, optional |
| `BREVO_API_KEY` / `RESEND_API_KEY` | email delivery |
| `TELEGRAM_BOT_TOKEN` | phone verification via Telegram bot |
| `HIBP_API_KEY` | Have I Been Pwned, falls back to XposedOrNot |
| `CRON_SECRET` | protects `/api/cron/monitor` |
