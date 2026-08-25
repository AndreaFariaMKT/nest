# Nest

Operational platform for **Studio Andréa Faria** — clients, projects, team, AI content engine, multi-platform publishing.

Operating the system: **[docs/usage/](docs/usage/README.md)**.
Technical docs: [docs/](docs/) — carrying a staleness notice each, audited
2026-08-25.

---

## Tech stack

- **Next.js 15** (App Router) · TypeScript · Tailwind CSS
- **Supabase** — Postgres, Auth, Storage (local via CLI)
- **next-intl** — i18n with `pt-BR` (default) + `en`
- **Anthropic Claude API** — content generation + creative refinement
- **puppeteer-core + @sparticuz/chromium** — HTML→PNG for slide creatives and HTML→PDF for reports. Playwright is a dev dependency for E2E tests only; local dev borrows the Chromium it already downloaded.
- **Vercel Cron** — scheduled publishing

---

## Requirements

- Node.js **20+** (tested on 24)
- npm **10+**
- [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) (for local dev)
- Docker (for local Supabase)

---

## Getting started

```bash
# 1. Install deps
npm install

# 2. Copy env and fill the Supabase keys (printed by `supabase start`)
cp .env.example .env.local

# 3. Start Supabase locally (first run pulls Docker images, ~2 min)
supabase start

# 4. Apply the initial schema
supabase db reset

# 5. Run the app
npm run dev
```

App runs at [http://localhost:3000](http://localhost:3000). You'll be redirected to `/today` (PT-BR default) or `/en/today`.

---

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server with HMR |
| `npm run build` | Production build |
| `npm run start` | Run the built app |
| `npm run test` | Vitest, unit |
| `npm run test:e2e` | Playwright, end to end |
| `npm run types:gen` | Regenerate database types — run after every migration |
| `npm run types:check` | Fail if the committed types have drifted from the database |
| `npm run typecheck` | TypeScript no-emit check |

---

## Internationalisation

All **code** (identifiers, routes, column names, comments) is written in **English**. All **user-facing strings** live in `messages/<locale>.json` and are consumed via `next-intl`.

- Default locale: `pt-BR` — Andréa's team is Brazilian
- Supported: `pt-BR`, `en`
- URL strategy: `localePrefix: "as-needed"` — PT-BR URLs are clean (`/today`), English URLs carry the prefix (`/en/today`)

To add a new locale:

1. Add it to `locales` in [`src/i18n/routing.ts`](src/i18n/routing.ts)
2. Create `messages/<locale>.json` with the same keys as `en.json`

---

## Folder structure

```
nest/
├── messages/                      # i18n strings (en.json, pt-BR.json)
├── public/
├── src/
│   ├── app/
│   │   ├── layout.tsx             # root (fonts, globals)
│   │   ├── globals.css            # Tailwind + design tokens
│   │   └── [locale]/
│   │       ├── layout.tsx         # next-intl provider
│   │       ├── page.tsx           # redirects to /today
│   │       ├── login/             # auth
│   │       └── (app)/             # authenticated shell
│   │           ├── layout.tsx     # sidebar + topbar
│   │           ├── today/
│   │           ├── clients/
│   │           ├── projects/
│   │           ├── calendar/
│   │           ├── meetings/
│   │           ├── content-engine/
│   │           ├── brand-kits/
│   │           ├── reports/
│   │           └── team/
│   ├── components/
│   │   ├── layout/                # Sidebar, TopBar
│   │   ├── ui/                    # Button, PageHeader, …
│   │   └── icons/
│   ├── i18n/                      # routing.ts, request.ts
│   ├── lib/
│   │   ├── supabase/              # client.ts, server.ts
│   │   └── utils.ts
│   ├── types/
│   └── middleware.ts              # next-intl locale routing
└── supabase/
    ├── config.toml                # local Supabase config
    └── migrations/
        └── 001_initial_schema.sql
```

---

## Roadmap

The sprint plan lived in a HANDOFF.md that was never committed; ROADMAP.md §3 is what survives of it.

| Sprint | Focus |
|---|---|
| 1–2 | Foundation · auth · clients · brand kits |
| 3–4 | Projects · tasks · team |
| 5–6 | Content engine (text + creative + IG publish) |
| 7–8 | AI chat editor · semantic memory · client approval link |
| 9–10 | Google Calendar · meetings · transcription |
| 11–12 | Reports · client portal · LinkedIn/TikTok |
