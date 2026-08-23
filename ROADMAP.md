# Nest · Roadmap

Living document. Source of truth for **what is built**, **what is next**, and **in what order**. Reference doc: [HANDOFF.md](./HANDOFF.md). The original 12-sprint plan is preserved below (§ from "1. Current state" down); this top section is the live state as of **2026-08**.

---

## 0. Current state — 2026-08 (multi-tenant + roles era)

**Live in production** on Vercel (`nest-andrea-faria-mkts-projects.vercel.app`), Supabase Cloud (Free, ref `wntrsavneabdcrztwudf`, region us-east-1). Deploy = push to `main`. Migrations 001–018 applied. Apply new migrations with:
`psql "postgresql://postgres.wntrsavneabdcrztwudf:<DB_PASSWORD>@aws-1-us-east-1.pooler.supabase.com:5432/postgres" -f <file>`

### Shipped this era
- **Production deploy** — Vercel + Supabase Cloud; `/api/health` green; Analytics + Speed Insights wired (enable in dashboard).
- **Chromium renderer** fixed for Lambda (`@sparticuz/chromium` + `puppeteer-core`, `src/lib/browser.ts`) → creatives + report PDF work in prod.
- **Multi-tenancy** — AFM + Nest as tenants (`tenants`, `tenant_members`, `tenant_id` on ~24 tables, RLS `is_tenant_member` + restrictive `tenant_isolation`). Tenant resolved **by login** (membership), theme follows tenant. No in-app tenant switch.
- **8 roles + per-role views** (`src/lib/roles.ts`) — founder/manager/social/designer_social/designer_identity/developer/accountant/client. Sidebar renders the login's menu; founder "View as" previews any role. **Route guards** (`src/lib/guard.ts`, middleware): clients isolated to `/portal`; finance/admin → founder/accountant; business-plan/commercial → founder.
- **Every nav item is a real page** — today, projects(tasks), calendar, meetings, messages, business-plan, administration, finance, commercial, marketing, content-calendar, scheduling, overview, clients, team(people), playbook, production-queue, feedback, identity-projects, website-builds.
- **Client portal** (authenticated) — `clients.portal_user_id` links a client login to one client; `/portal` overview/content/calendar/meetings/invoices/chat, RLS-scoped (`owns_portal_client`, migration 018). Isolation verified in prod.
- **Messages** — internal team channel + per-client chat (`messages.client_id`; null = team).
- **UI** — themeable AFM/Nest tokens, dark grouped sidebar (now **collapsible**, cookie-persisted), edge-to-edge shell, reskinned dashboard.
- **Perf** — `React.cache()` auth dedupe, `staleTimes.dynamic=30`, `loading.tsx` skeleton.
- **Types** — `database.ts` swapped to generated `database.gen.ts` (`npm run types:gen` needs `supabase login`).

### Test logins (admin-created, email confirmed)
| Role · Tenant | Email | Password |
|---|---|---|
| Founder · AFM | afm@andreafariamkt.com | Afm-6de0bad9 |
| Founder · Nest | nest@andreafariamkt.com | Nest-99b6a8c1 |
| Client · AFM | client@andreafariamkt.com | Client-demo123 |

### Social media module — 2026-08

The full social-media operation, as one module over the existing content engine.
Migrations **019 + 020** (apply 019 first, plain autocommit psql — it adds enum
values that 020's defaults use).

- **One pipeline, one table.** `content_drafts` gained the stages the flow was
  missing (`backlog`, `changes_requested`, `rejected`) plus everything a piece
  carries: axis (`pillar`), format, channels, origin, *why this, now*, design
  state, folder link, internal notes for design and for publishing, publish slot,
  and the timestamps of each hand-off. `content-engine`, `production-queue`,
  `scheduling` and the portal keep working and now see the whole flow.
- **Direction approves the argument before anything is drawn** — the text goes up
  at `text_review`, and only an approved text reaches design.
- **Per-piece reply date.** A piece reaches the client five working days before it
  publishes; silence past that runs it as scheduled, so a quiet week never stalls
  the calendar. Pieces go to the client one at a time, never as a fortnight-sized
  pile.
- **Screens** (`/social/*`, client filter carried across all of them): overview
  with client health, waiting-on-you, backlog with a stock meter measured in
  fortnights, fortnight, production kanban, publishing order, calendar, media
  library, shared logins. `/social/pieces/[id]` is the piece record.
- **Rooms, not one inbox.** `messages.room` splits a client's internal room from
  the room the client reads; RLS enforces it (018's portal policy was replaced).
- **Shared logins** store where a credential lives and who holds it. The password
  is AES-256-GCM ciphertext (`SOCIAL_SECRET_KEY`, `src/lib/secrets.ts`) — the
  database never holds one in the clear, and reveal goes through a role-checked
  server action.
- **Meetings** gained summary, agenda/transcript links, and the decision list.
- **Portal** gained per-piece approve / approve-with-changes / not-approved, plus
  read-only media and logins.
- Rules live in `src/lib/social.ts` (pure, 60 unit tests); every refusal returns
  an i18n key so the UI says *why* a move was blocked.
- Client edit carries the module toggle and publications-per-fortnight, which is
  the divisor behind every backlog meter.

Migrations 019+020 are **applied in Supabase Cloud** and `database.gen.ts` was
regenerated from the live schema (`npm run types:check` is green). **021 and 022
still need applying** — see below.

### Audit and hardening — 2026-08

Five independent reviews (correctness, regressions, completeness, security,
readability) were run over the module. The date arithmetic, the crypto, and the
i18n key parity came back clean. The rest produced two migrations and a round of
fixes.

**The pattern worth remembering:** three screens filtered the portal's data in
the application and treated that as the boundary — the room filter on messages,
the stage filter on pieces, the role list on shared logins. None of them was
one. The browser holds the anon key and a client session, so a portal login can
call PostgREST directly and skip every application filter. Two of the three
holes predate this module (016's blanket `messages read`, 018's unfiltered
`portal reads content`, 001's `client_id is null` short-circuit on
tasks/meetings/transcripts); the module made them matter by putting internal
production talk behind them.

- **021** drops `portal decides content`; a client's decision is now written
  server-side with the service role after an ownership check, because RLS is
  row-level and cannot say "only these columns, only these values".
- **022** adds `is_portal_user()` and three restrictive floors — messages
  (own client room only), content_drafts (client-visible stages only), and
  tasks/meetings/transcripts (closing the `client_id is null` branch).
  Restrictive policies AND with every permissive grant, which is why 020's
  `and room = 'client'` did nothing next to 016's older, broader one.
- `revealSecretAction` gained a capability gate and now fails closed on an
  empty access list (it read empty as "everyone"); `shared_logins.access_roles`
  defaults to `{founder}`.
- Every module write now confirms it touched a row. PostgREST answers an UPDATE
  that matched nothing with `error: null`, so a write blocked by RLS looked
  exactly like a write that worked.
- `todayIso()` reads the studio's calendar day (America/São_Paulo) instead of
  UTC's, which rolled over at 21:00 local.
- New transition `approve_on_silence`: past the reply date, coordination can run
  a piece the client never answered. Without it `client_review` was a dead end
  and a quiet client froze the calendar — which contradicted the rule the module
  documents.
- `/messages` gates the room list by capability; the rewrite had exposed every
  client's production talk to accountant, developer and designer_identity. Its
  query also read the OLDEST 600 rows of the tenant, so past that nothing new
  ever appeared.
- The old content-engine editor no longer resets a piece's stage: its status
  list is derived from the enum and `updateDraftAction` validates instead of
  defaulting to `draft`.

### Closing the gaps — 2026-08

Everything the audit left open, except the two items named below. Needs
**migration 023** (portal read policies for the report tables).

- **Performance** — `/social/report` and `/portal/report`, off the same loader.
  Real numbers from `post_metrics` via `src/lib/kpi.ts`, each against the same
  number last month; the axis distribution of what actually published; and the
  written reading from `monthly_reports` when one exists, with the screen honest
  about its absence rather than inventing it. Defaults to the month that just
  closed, matching the studio's own rule about reporting between the 3rd and the
  7th. Rules in `src/lib/social-report.ts`, under test.
- **The client's two questions** land in the client room as a message rather
  than in a table of their own — that room is already where coordination reads
  this client, and a second inbox is an inbox nobody checks.
- **The portal calendar** was a verbatim copy of the portal meetings page: same
  query, same rendering, the function still named `PortalMeetings`. It now shows
  publications and meetings on a month grid.
- **Meeting decisions reach the client.** 020 added them; only the studio could
  see them.
- **`window_note` and `source_ref`** were write-only — collected, stored, never
  rendered. Now on the piece record and editable by coordination.
- **Focus rings.** The module re-derived its own buttons and none of them had
  one, so it was the only part of the app unusable by keyboard. They now go
  through `src/components/ui/Button`, which gained `brand` and `danger`
  variants. Also: the client's comment box and the caption editor gained bound
  labels, and the month arrows an accessible name.

### Prototype parity — 2026-08

A re-read against the prototype caught three nav items the earlier rounds had
missed, all of them "the screen exists, nothing links to it":

- **Meetings and Messages** are in the module's nav for the roles the prototype
  gives them to. Both pages already existed; `/meetings` in particular was in no
  staff sidebar at all, which predates this module.
- **The client's "Waiting on you"** (`/portal/waiting`) — the prototype lists it
  first for that persona. It renders from the same `waitingFor` the studio's
  screens use, given only the client cap, so the reasons and reply dates cannot
  drift from the ones the module computes.

Still true: `/reports` and `/reports/kpi` are in no sidebar. They are the older
AI-generated monthly recap, unrelated to the prototype's Performance screen
(`/social/report`), so they were left where they were.

### Nothing left open — 2026-08

The last three items, plus the optional half of the readability review. Needs
**migration 024** (`clients.social_digest_at`) and the new Vercel cron.

- **The client hears once a day.** `/api/cron/social-digest` (weekdays, 11:00
  UTC) gathers what arrived, what is due today, and what has run past its reply
  date into one notification per client. The per-hand-off notification is gone:
  four pieces on a Tuesday meant four pings, and the one that mattered got lost
  among them. `clients.social_digest_at` is stamped only on success, so a missed
  run is picked up by the next one instead of swallowing a day's arrivals.
  Rules in `src/lib/social-digest.ts`, under test.
- **Playwright** — `tests/e2e/social-module.spec.ts` walks every module screen,
  asserts the shelf meter, proves a theme without a reason is refused *with a
  sentence*, and drives a theme from the shelf into the fortnight. It skips
  cleanly on an empty seed, like the rest of the suite. Route guarding stays a
  unit test, where the rule actually lives.
- **`movesFor()`** — "what can this reader do to this piece" was written twice
  and had already drifted in four places. Both screens (and the portal) now
  render from one answer in `src/lib/social.ts`, and a test asserts the domain
  never offers a move the state machine would refuse.
- **A test that catches missing strings.** Most labels render from a dynamic key
  (`t(\`stage.${p.status}\`)`), which TypeScript cannot see and next-intl throws
  on. `tests/unit/social-i18n.test.ts` checks every enum against both
  dictionaries, so adding a stage without its strings fails the build.
- Also: `DisclosureForm`, `ConfirmDeleteButton` (the repo's two-click pattern,
  not `window.confirm`), `useRefreshingAction`, `ModuleNote`/`EmptyState`,
  `scope.clientName`, one `formatIsoDate`, typed refusal/health/waiting reasons,
  `revalidateModule` derived from `SOCIAL_SCREENS`, and a note on
  `posts_per_cycle` — which this module reads as a **fortnight** rate while
  `src/lib/cycles.ts` uses "cycle" to mean a calendar month.

### Backlog — what's next (roughly prioritized)
1. **Operational / quick**
   - [ ] DNS: `nest.andreafariamkt.com` → CNAME `cname.vercel-dns.com` (Google Cloud DNS); then set `NEXT_PUBLIC_APP_URL` + redeploy.
   - [ ] **Rotate the DB password** (it was used/exposed during setup) — Supabase → Database → Reset password. Does not affect the app (uses keys).
   - [ ] Remove the **demo data** (Demo Client + client@ login + its meeting/contract/draft) once portal testing is done.
   - [ ] Enable Vercel **Web Analytics + Speed Insights** in the dashboard.
   - [ ] SMTP for auth emails (invites/reset); Free-plan **backups** (no daily backup — upgrade Pro or scheduled dump).
2. **Actions on the read-only pages** (currently views)
   - [ ] Client **approves/comments** on content in `/portal/content` (writes `approvals`).
   - [ ] Business plan / Administration → editable (needs tables) instead of static/derived.
   - [ ] Content calendar / Scheduling → create + drag to reschedule.
   - [ ] Commercial → move a prospect through stages; convert to active client.
3. **Roles hardening**
   - [ ] Assign granular roles to real staff logins (015 allows the 8); today all are `founder`.
   - [ ] Tighten per-role route allow-list beyond the sensitive set if needed.
4. **Integrations (code ready, need creds)** — Meta/Instagram, LinkedIn, TikTok, Voyage (semantic memory), Google (already connected). Wire `meta-refresh` token exchange.
5. **Quality** — Sentry (needs DSN), rate-limit → Upstash Redis (public routes), Playwright E2E in CI, pagination/indexes when data grows, per-feature docs.

---

## 1. Current state

### Shipped

| Area | Status | Notes |
|---|---|---|
| Next.js 15 + TS + Tailwind 3 + App Router | ✅ | `src/` with aliases, typed routes |
| i18n (next-intl) · `pt-BR` default + `en` | ✅ | `localePrefix: as-needed` |
| Supabase local (Docker) | ✅ | 24 tables, 45 RLS policies, `auth.users` trigger for `profiles` |
| Manier font (12 weights, local) | ✅ | `next/font/local` wired to `--font-display` |
| Auth: middleware + `(app)` guard + login | ✅ | Password + magic-link flows |
| Dev owner seed (`dev@nest.local`) | ✅ | Idempotent `supabase/seed.sql` |
| Clients CRUD | ✅ | List, create, detail (5 sections), edit, archive, auto re-slug |
| Brand Kit (Phase A — no uploads) | ✅ | Palette editor, typography, voice/tone, do/don't, guidelines URL |
| UI primitives | ✅ | Button, Input, Label, Textarea, Card, Pill, PageHeader, Placeholder, LanguageSwitcher, icons |

### Not started (tracked below)

Brand assets upload · contracts · services catalog · projects/tasks · team · meetings · content engine · scheduling · publishing · reports · client portal · CI/CD · production deploy.

---

## 2. Guiding principles

1. **Thin slices.** Every commit produces something demoable end-to-end (navigate, interact, persist).
2. **English code, PT-BR UI default.** All identifiers/routes/columns in English; strings through `messages/*.json`.
3. **RLS-first.** Never expose data through the anon key unless the policy allows it. Service-role access only from server-side code with explicit business reason.
4. **Verify in Preview before committing.** Use the Preview MCP (Playwright-backed) or manual browser to confirm the happy path. `npx tsc --noEmit` must pass.
5. **Types from the schema.** As soon as v1.5 window opens, switch `src/types/database.ts` to `supabase gen types typescript --local` output.
6. **Server actions over API routes** for form submissions. Route handlers only for webhooks, cron, and public endpoints (approvals, OAuth callbacks).

---

## 3. Sprint plan (12 weeks · 6 sprints)

Each sprint is 2 weeks. Sub-bullets are slices (≈ 1 commit each, each shippable on its own). Checkbox discipline: the slice is done when it passes `tsc --noEmit`, renders without errors in Preview, persists correctly in the DB, and has translations for both locales.

### Sprint 1–2 · Foundation + Clients · **done** (2026-04-22)

Goal: Andréa cadastra clientes, brand kits e contratos.

- [x] Foundation (Next, Supabase, auth, i18n, design system)
- [x] Clients CRUD (list, create, detail, edit, archive)
- [x] Brand Kit Phase A (palette, typography, voice, do/don't, guidelines)
- [x] Testing harness — Vitest (unit) + Playwright (smoke): configs, first tests (slugify + login happy path), `test` / `test:e2e` scripts, ignores. Prerequisite for autonomous mode per `docs/autonomous-protocol.md` §5
- [x] Brand Kit Phase B · asset uploads — bucket `brand-assets` (public), upload + grid + remove, thumbnails on detail
  - migrations 002 + 003 (fix RLS bug where `split_part(name)` resolved to `brand_kits.name`)
  - `src/lib/brand-assets.ts` + 15 unit tests (detect kind, validate file, build path)
  - `uploadBrandAssetAction` (lazy-creates kit) + `deleteBrandAssetAction`
  - `BrandAssets.tsx` — file input, aspect-square thumb grid, kind pill, remove-on-blur
  - playwright smoke: login → new client → brand kit → upload tiny PNG → thumbnail
- [x] Contracts (owner-only) — CRUD + MRR
  - `src/lib/money.ts` (parse/format BRL cents, handles `.` vs `,` disambiguation) + 13 unit tests
  - `src/lib/auth.ts` (`getCurrentProfile`, `isOwner`) — UX owner gate on top of RLS
  - `/clients/[slug]/contracts` list + `new` + `[id]/edit` with inline delete (2-click confirm)
  - `ContractForm` shared (title, BRL input, starts/ends, auto-renew, document, notes)
  - owner-only Contracts card on detail page with active MRR summary
  - playwright smoke: owner creates contract → list shows R$ 4.500,00 + title
- [x] Services catalog — `/services` + per-client assignments
  - `/services` list + `new` + `[id]/edit` (owner-only writes, all authenticated read)
  - `ServiceForm` with name + default monthly BRL + description, auto-slug collision resolver
  - Services card on client detail: active assignments (non-ended) + owner-only attach dropdown + detach-with-`ended_on`
  - Sidebar gains a Services entry (ShieldCheck-style icon)
  - Playwright smoke: create service → new client → attach → row visible
- [x] Global /brand-kits index — grid of all kits with 8-swatch preview + typography line, card links to each client's edit page
- [x] Today page skeleton — greeting + date, owner stats (active clients · active services · MRR), and 3 placeholder blocks (tasks/meetings/approvals) with Sprint-of-origin hints

**Entrega da sprint:** Factory usa o Nest pra gerenciar sua própria base de clientes + contratos + visuais.

---

### Sprint 3–4 · Projects, Tasks, Team · **done** (2026-04-22)

Goal: operação diária migra do Notion pro Nest.

- [x] Monthly cycles — cron + detail display
  - `src/lib/cycles.ts` (`cycleBounds`, `currentYearMonth`, `isCycleActive`, `daysRemainingInCycle`) + 13 unit tests
  - `/api/cron/cycles` (GET+POST) bearer-auth with `CRON_SECRET`, service-role client, idempotent upsert on `(client_id, year, month)`
  - `vercel.json` cron: `0 3 1 * *` (03:00 UTC on day 1 every month)
  - client detail Details card gets a Current cycle row with days-left plural ICU
  - verified by curl: 401 unauth, 401 bad secret, 200 creates 22 rows, second call createdOrKept=0
- [x] Tasks CRUD
  - `/projects` list (due + status/priority pills, clients/assignee inline) — kanban slice replaces this view next
  - `/projects/new` + `/projects/[id]/edit` with shared `TaskForm` (status, priority, datetime-local, assignee + client dropdowns; cycle auto-resolved from client's current cycle)
  - server actions: create, update, delete; `completed_at` auto-stamps on transition to `done` and clears on rollback
  - tests: 48/48 unit + 7/7 smoke (incl. new tasks smoke)
- [x] Kanban board — 5 columns with native HTML5 DnD + useOptimistic snap + URL-param filters (shipped in `aeef233`)
- [x] Task templates — cron clone mechanism
  - migration 004 (`tasks.is_template` bool + partial index)
  - TaskForm "Template" checkbox; kanban filters `is_template = false` by default, `?templates=1` to manage them
  - `/api/cron/cycles` now returns newly-inserted `(id, client_id)` rows, then inserts cloned tasks (matching global or per-client templates) with `cycle_id = new cycle, is_template = false, status = todo`
  - curl verified: fresh cycle for Nayara cloned the "3 carrosséis mensais" template (`clonedTasks: 1`)
- [x] Team invite flow — /team lists members + owner-only invite form posting to `supabase.auth.admin.inviteUserByEmail`; new users land with `role=staff` via the existing `handle_new_user` trigger (Mailpit captures emails in local dev)
- [x] Client assignments — `ClientMembersCard` on client detail (owner-only): attach/detach staff via `client_members` rows; candidate list filtered to `role = staff`
- [x] Notifications — TopBar bell + dropdown + task-assigned trigger
  - `notifyUser()` helper via service-role client bypasses the own-only RLS on notifications
  - TopBar is now a server component fetching last 10 + unread count for `auth.uid()`
  - `NotificationsBell` dropdown with per-item link, unread dot, "mark all read" action
  - `tasks/createTaskAction` + `updateTaskAction` emit `task.assigned` notifications when assignee ≠ created_by ≠ existing
  - mention + approval triggers deferred to later sprints (schema supports arbitrary `type` string)
- [x] Today page · parte 1 — real task mini-list on /today (assignee = me, not done, due ≤ tomorrow) linking to edit; meetings/approvals still placeholders for Sprints 9 and 7

**Entrega:** Factory substitui o Notion pra tracking operacional.

---

### Sprint 5–6 · Content Engine · core

Goal: primeiro post Factory publicado pelo Nest.

- [x] Claude API wrapper — model router + cached-brand system helper + adaptive thinking + streaming via `.finalMessage()` (shipped in `aa56d73`)
- [x] Transcript upload — `/content-engine/new` (paste or .txt/.vtt upload) · `src/lib/vtt.ts` strips WEBVTT headers + timing lines + `<v Name>` tags · creates an ad-hoc `meetings` row so `transcripts` can hang off it (real meetings come in Sprint 9) · list at `/content-engine` shows client + language + word count
- [x] Generate carousels — transcript → Claude → 7 drafts shipped end-to-end (manual verification)
  - `src/lib/carousel-prompt.ts` (buildSystem/buildUser/parseDraftsPayload) + 13 unit tests
  - brand summary + last 10 drafts piped into the user message; brand block cached via `cache_control: ephemeral`
  - server action streams via `.finalMessage()` and bulk-inserts drafts + slides
  - "Generate" button on each transcript row triggers the action; redirects to `/content-engine/transcripts/[id]`
  - manual test: 7 drafts (pillars: Autoconhecimento, Conexão pessoal, etc.), 10 hashtags each, 7 slides each
- [x] Text editor — `/content-engine/drafts/[id]/edit`: full draft editor (title, pillar, status, hook, caption, hashtags) + interactive slide list (add/remove + ↑↓ reorder); on save, `updateDraftAction` replaces all slides atomically
- [x] Creative editor v1 — Playwright HTML→PNG at 1080×1350 into Supabase Storage (shipped in `c83cac4`; 7 slides rendered with brand styling + Portuguese text in manual verification)
- [x] Approval workflow — `approveDraftAction` + "Approve for scheduling" button on the draft editor header; gated by status (pre-approval states only); idempotent
- [x] Instagram Graph API — `src/lib/instagram.ts` (Graph v21.0) + `/api/instagram/publish` endpoint. Real API verification deferred until META creds land; code path tested manually: 401 without bearer, 503 with missing Meta env + structured `missing[]` list. 8 unit tests for URL builders + env guard.
- [x] Scheduling — inline scheduler on the draft editor (visible when status ∈ {approved, scheduled}): datetime-local picker + platform select → `scheduleDraftAction` inserts `scheduled_posts` with `status='pending'` and flips `content_drafts.status` to `scheduled`. Existing scheduled posts rendered in the card for quick audit.
- [x] **Cron publisher** — `/api/cron/publish` (Vercel Cron, a cada 5 min) pega `scheduled_posts` com `scheduled_for <= now()` e `status = pending` → publica → grava `published_posts` + métrica inicial
  - `/api/cron/publish` route (GET + POST) bearer-gated with `CRON_SECRET`; returns 503 + `missing[]` when Meta creds absent so Vercel logs surface the blocker cleanly
  - Picks up to 10 due rows ordered by `scheduled_for`; per row: gather latest creatives → `publishCarousel()` → insert `published_posts` + flip `scheduled_posts.status='published'` + `content_drafts.status='published'`; on failure increment `attempt_count` and record `last_error`, flip to `failed` after 3 attempts
  - Skips LinkedIn/TikTok rows for now (wrappers come in Sprint 11-12) with `platform_unsupported:<p>` reason
  - `vercel.json` cron schedule: `*/5 * * * *`
  - curl verified: 401 unauth, 401 bad bearer, 503 creds missing (structured `missing[]`); success + failure paths unblocked by Meta creds

**Entrega:** Andréa publica primeiro post da Factory via Nest.

---

### Sprint 7–8 · Content Engine · advanced

Goal: fluxo completo pra Nayara.

- [x] AI chat in creative editor — MVP single-shot rewrite. User types an instruction, Claude returns revised slides (+ optional hook/caption), changes apply atomically, `ai_edits` row logs the exchange. Verified end-to-end: "deixa o primeiro slide mais direto, com menos palavras" → Claude shortened + added punch per instruction.
- [x] **Semantic memory** — embeddings dos últimos 30-60 drafts por cliente (pgvector), busca antes de gerar pra evitar repetição temática; extensão `vector` já habilitável no Supabase local
  - migration 006: `vector` extension + `content_drafts.embedding vector(1024)` + hnsw index + `match_drafts()` RPC
  - `src/lib/embeddings.ts` — Voyage AI wrapper (voyage-3.5, 1024 dims) with graceful no-op fallback when `VOYAGE_API_KEY` missing; pure `cosineSimilarity` + `vectorToSql` helpers + 16 unit tests
  - hook in `generateCarouselsAction`: embed each new draft (title + pillar + hook) after insert
  - retrieval in `generateCarouselsAction`: embed transcript → `match_drafts()` RPC → top-10 similar by cosine, falls back to "last 10 titles" when no embeddings exist
  - inactive until `VOYAGE_API_KEY` lands; tsc clean, 16 embeddings tests green
- [x] Compliance checks — industry-aware Claude review (CVM/OAB/ANVISA/LGPD), severity + inline findings on draft editor (shipped in `d227764`; test → `warning` + 2 LGPD issues)
  - migration 007: `content_drafts.compliance_report jsonb` column
  - `src/lib/compliance.ts` — `buildCompliancePrompt(draft, client)` + `parseComplianceReport(raw)` pure helpers
  - `checkComplianceAction` — calls Claude (kind: extract → haiku for cost), parses + saves JSONB
  - UI block on draft editor: "Run compliance check" + report panel (severity pill + findings list)
  - industry-aware: Claude applies CVM rules when client.industry ~ "financ|invest", OAB for "jurid|adv", LGPD always
- [x] **Public approval link** — `/a/[token]` (sem auth) mostra carrossel pro cliente aprovar/comentar/rejeitar; `approvals` table atualizada via service role
  - `generateApprovalLinkAction` on draft edit — random 32-byte hex token → inserts `approvals` row (14-day TTL), shows latest 5 links inline with status pill + copy-ready URL
  - public route at `src/app/a/[token]/page.tsx` (outside the locale group + (app) guard) — renders carousel preview (client name + creatives grid + caption + hashtags); middleware matcher excludes `/a/*`
  - Aprovar / Pedir mudanças buttons → `approveViaTokenAction` / `rejectViaTokenAction` write `approved_at` or `rejected_at` + `client_comment` via service-role client (bypasses owner-only RLS); idempotent (no-op if already answered/expired)
  - notification sent to draft creator when client responds; E2E verified (approve → thanks page → approvals row updated → `approval.response` notification inserted with "Cliente aprovou …" title)
- [x] **Reels / vídeo** — `content_drafts` extension: `video_script` field, upload do vídeo final pelo usuário, fluxo de agendamento adaptado
  - migration 008: `content_drafts.video_script text` + `video_url text` (nullable)
  - `src/lib/reel-script.ts` — `buildReelSystem` / `buildReelUser` / `parseReelPayload` + `ReelParseError`; prompt enforces 30-60s voiceover, hook-line in first 3s, one shot per line, single CTA, clamped duration estimate
  - `generateReelScriptAction` (content-engine/actions.ts) — generates a Reel draft (no slides) with pillar suffix `· reel`; persists `video_script` in the new column and `hook` = script's hook_line
  - Draft editor exposes a "Generate Reel script" button in the Adapt panel + a new "Reel script" section that renders the script as a preformatted block when the draft has a `video_script`
  - 12 unit tests for the pure helpers; E2E verified — 797-char script generated with hook "Passei anos pedindo permissão pra fazer o que meu coração já sabia que era certo" + 10 hashtags
  - Video file upload + scheduling wiring deferred to a later slice once the renderer (Sprint 11-12) is production-ready
- [x] **Adaptações multi-plataforma** — action "adapt for LinkedIn/TikTok" cria drafts derivados com tone/length ajustado
  - `src/lib/carousel-adapt.ts` — `buildAdaptSystem` / `buildAdaptUser` / `parseAdaptPayload` + `AdaptParseError`; platform rules inline (LinkedIn: longer, pro, 3-5 industry tags; TikTok: punchy, voiceover-script, 6-word headlines)
  - `adaptDraftAction` (content-engine/actions.ts) — clones the source draft as a NEW `content_drafts` row with pillar suffix `· linkedin` / `· tiktok`, status = draft, `ai_edits` audit row tracks the derivation
  - Draft editor exposes 2 buttons (Adapt for LinkedIn / TikTok) on the "Adapt for another platform" panel; redirects to the new draft's edit page
  - 13 unit tests for the pure helpers; manually verified end-to-end — LinkedIn adaptation produces a new 7-slide draft with professional caption + 5 industry hashtags
- [x] **Stories auto-gen** — a partir de um carrossel aprovado, 3 stories com links/stickers
  - `src/lib/story-gen.ts` — `buildStorySystem` / `buildStoryUser` / `parseStoryPayload` + `StoryParseError`; prompt enforces narrative arc (tease → insight → CTA) and requires a `sticker_cta` on the last story
  - `generateStoriesAction` (content-engine/actions.ts) — persists stories as a new `content_drafts` row with pillar suffix `· stories`; each story becomes a slide and the sticker_cta is appended to the body so the renderer can promote it later
  - Draft editor exposes a "Generate Stories (3)" button in the Adapt panel
  - 10 unit tests for the pure helpers; E2E verified — Stories 1 teases ("Você busca fora o que já tem dentro"), Story 2 delivers the method + "Save this" sticker, Story 3 closes with "Veja o carrossel"

**Entrega:** fluxo completo (transcrição → IG+LinkedIn+TikTok + stories + aprovação do cliente) para Nayara.

---

### Sprint 9–10 · Calendar + Meetings

Goal: Andréa agenda reuniões no Nest e puxa transcrições automaticamente.

- [x] **Google OAuth** — `/api/google/*` com consent screen, store refresh token em `profiles.google_*` (migration nova)
  - migration 012: `profiles.google_refresh_token` + `google_access_token` + `google_token_expires_at` + `google_email` + `google_scopes`
  - `src/lib/google.ts` — pure URL builder (`buildAuthUrl`), `exchangeCode` + `refreshAccessToken` IO, `expiresAtIso` + `isAccessTokenStale` (60s lead window), `generateState` (32-byte hex CSRF), `GoogleApiError`; 17 unit tests
  - `/api/google/auth` — auth-gated redirect to Google consent (scopes: openid, email, profile, calendar) with httpOnly state cookie, `prompt=consent` for reliable refresh_token issuance
  - `/api/google/callback` — verifies state cookie, exchanges code, fetches userinfo, persists tokens via service-role (profiles google_* are server-managed); bounces back to `/settings?google=<status>`
  - `/settings` page — owner-accessible card showing connection state + connect/disconnect controls; sidebar entry added; pt-BR + en strings
  - env updates: `GOOGLE_OAUTH_REDIRECT_URI` registered in `src/lib/env.ts`; `.env.example` aligned to `GOOGLE_OAUTH_*` prefix
  - inactive until `GOOGLE_OAUTH_*` creds land; tsc clean, 318 tests green
- [x] **Calendar sync** — listar eventos próximos 30 dias, criar/editar evento no Nest → espelha no Calendar (+ Meet link gerado)
  - `src/lib/google-calendar.ts` — `getFreshAccessToken` (auto-refresh on stale + persist via service-role), `listEvents` (next-N-days helper), `createEvent` (with `conferenceData` → Meet link), `updateEvent` (PATCH), `deleteEvent`, pure `buildEventResource` + `parseEventResponse`; 12 unit tests
  - `src/lib/calendar-mirror.ts` — best-effort mirror layer: `mirrorMeetingCreate` / `mirrorMeetingUpdate` / `mirrorMeetingDelete` (each silently no-ops when user hasn't connected Google or env creds missing; logs failures but never blocks the user-facing action)
  - `meetings/actions.ts` — wired into `createMeetingAction` (mirrors + writes back `google_event_id` + `google_meet_url`), `updateMeetingAction` (patches existing event when `google_event_id` set), `deleteMeetingAction` (cleans up the calendar event)
  - inactive until Google creds + a connected user; tsc clean, 330 tests green (12 new)
- [x] **Meetings CRUD** — `/meetings` lista, `/meetings/new` agenda com cliente + participantes
  - `MeetingStatus` + `MEETING_STATUSES` + `meetings` table added to `src/types/database.ts`
  - `src/app/[locale]/(app)/meetings/actions.ts` — `createMeetingAction`, `updateMeetingAction`, `deleteMeetingAction` (server actions, validated, redirect-after-write)
  - `MeetingForm` shared component (title + datetime-local × 2 + client dropdown + status + Meet URL)
  - `/meetings` list splits upcoming/past, status pill per row
  - `/meetings/[id]` detail page with client link, Meet URL, linked transcripts section
  - `/meetings/[id]/edit` reuses the shared form with pre-filled values
  - i18n strings (status, fields, sections, actions, errors) for both locales
  - Google OAuth integration still deferred (credential blocker) — the Meet URL is a manual field for now; the cron-backed auto-creation lands when Google creds arrive
- [x] **Calendar view** — `/calendar` visual com drag-to-reschedule, clique pra abrir meeting
  - `src/lib/calendar.ts` — pure month-grid helpers (`parseMonthKey`, `addMonths`, `buildMonthGrid`, `monthRangeISO`); 14 unit tests, Monday-first 6×7 grid
  - `/calendar` page renders the grid with meetings bucketed by local day; status dot per meeting + click-through to `/meetings/[id]`; prev/next/today navigation via `?ym=YYYY-MM`
  - Drag-to-reschedule deferred (requires a client component + optimistic update); manual edit via `/meetings/[id]/edit` is the current fallback
- [x] **Transcript pull job** — cron checa reuniões concluídas, baixa transcrição via Meet API, cria `transcripts` row, extrai tarefas via Claude (haiku) e cria `tasks`
  - `src/lib/google-meet.ts` — pure `extractMeetingCode` (Meet URL → space code) + `entriesToPlainText` (concat to Speaker:text format), IO `listConferenceRecordsByCode` + `listTranscripts` + paginated `listTranscriptEntries`; 9 unit tests
  - `src/lib/transcript-tasks.ts` — pure `buildTaskExtractionSystem` / `buildTaskExtractionUser` / `parseExtractedTasks` (clamps title to 120ch, normalises priority, parses due_at to ISO, drops malformed); 15 unit tests
  - `/api/cron/transcript-pull` — bearer-gated, 503 on missing creds (Google + Anthropic). Per run: finds meetings ended in `[-7d, -5min]` with `google_meet_url` + no transcript yet (BATCH_SIZE=5), refreshes creator's Google token, picks closest conferenceRecord by space code, downloads first FILE_GENERATED transcript, persists, then calls Claude Haiku to extract tasks → bulk-inserts as `tasks` rows linked to the meeting's client. Skip reasons (creator_not_connected / no_meeting_code / no_conference_record / no_transcripts_yet / empty_transcript / scope_or_tier) are logged but don't count as failures
  - `meetings.status` flips to `completed` when transcript arrives (conclusive proof)
  - `vercel.json`: every 15 minutes
  - SCOPES updated to include `meetings.space.readonly` (transcripts gated on Workspace Business Standard+ tier — OAuth still works on lower tiers, transcripts list comes back empty)
  - inactive until Google + Anthropic creds + a connected user; tsc clean, 354 tests green (24 new)
- [x] **Meeting detail** — mostra transcrição + tarefas geradas + botão "Gerar carrossel a partir dessa reunião"
  - `/meetings/[id]` page already lists linked transcripts; now each row exposes a "Generate carousels" button that posts to the existing `generateCarouselsAction`
  - i18n strings added for both locales (`meetings.actions.generateCarousels`)
  - Auto-generated task extraction from transcripts is deferred until the transcript-pull job ships (depends on Google creds)
- [x] **Today page · parte 2** — reuniões de hoje + amanhã
  - Replaced the meetings skeleton card with a real list (meetings between now and end of tomorrow, non-cancelled, top 8 by start time)
  - Shows title + start time + client; clicks through to `/meetings/[id]`
  - Falls back to a friendly empty state when nothing is upcoming

**Entrega:** Andréa agenda tudo no Nest, transcrições viram tarefas e conteúdo.

---

### Sprint 11–12 · Reports + Portal + multi-platform

Goal: v1.0 em produção.

- [x] **Metrics collection** — cron diário pega métricas de todos `published_posts` via Graph API; insere time-series em `post_metrics`
  - `src/lib/instagram.ts` extension: `fetchPostMetrics(creds, mediaId)` calls `/{media}?fields=like_count,comments_count` + `/{media}/insights?metric=reach,saved,shares,total_interactions,views` and merges via pure `mergeMetrics(fields, insights)`. Best-effort insights — IG raises on unsupported metrics for the media type, so we catch and degrade to null fields rather than failing the whole post. 7 new mergeMetrics unit tests
  - `/api/cron/metrics-collect` — bearer-gated, 503 on missing Meta creds. Per run: top 50 IG `published_posts` from the last 90 days → `fetchPostMetrics` per post → insert one `post_metrics` row each (time-series; consumers dedupe). 404 / `non_existing` are skipped (deleted post); other API errors logged + counted but never fatal
  - `vercel.json`: daily at 05:00 UTC
  - LinkedIn / TikTok rows skipped silently (their wrappers come in 11-12)
  - Meta creds are already live, so this is testable end-to-end as soon as the cron runs; tsc clean, 361 tests green (7 new)
- [x] **KPI dashboard** — `/reports/kpi` com filtro por cliente + período, gráficos (reach, impressions, engagement rate, saves, shares, likes, comments)
  - `src/lib/kpi.ts` — pure helpers: `latestPerPost` (dedupe by published_post, pick newest snapshot), `aggregateKpis` (sum + engagement rate), `computeEngagementRate` ((likes+comments+saves+shares)/reach \* 100, null when reach=0), `dailyReachSeries` (per-day per-post latest, summed), `parsePeriod` (YYYY-MM-DD with safe defaults). 15 unit tests
  - `/reports/kpi/page.tsx` — server-rendered: filter form (client dropdown + from/to dates), 8 KPI tiles, inline SVG sparkline of daily reach. RLS scopes the metric query through `published_posts.content_drafts.client_id`; the optional clientId search param narrows further
  - `/reports` page now has a tab strip linking to either Monthly recaps or KPIs
  - i18n: full pt-BR + en strings for the kpi tab + tiles + filter + empty state
  - Note: `follows` is account-level (not per-post), so it isn't in the per-post aggregation; will land alongside an account-insights cron in a follow-up
  - tsc clean, 376 tests green (15 new)
- [x] **Monthly report generator** — Claude analisa métricas do mês + gera 5-10 bullets de insight + recomendações pro próximo ciclo; exporta PDF via Playwright
  - migration 010: `monthly_reports` table (client_id+year+month unique, RLS: read via has_client_access, owner-only writes)
  - `src/lib/monthly-report.ts` — `buildReportSystem` / `buildReportUser` / `parseReportPayload` + `MonthlyReportParseError` + `monthBounds` / `monthLabel`; 14 unit tests
  - `generateMonthlyReportAction` (in `/reports/actions.ts`) — aggregates drafts + tasks + meetings + approvals + published_posts for the client in the month, calls Claude Opus 4.7, upserts the structured report
  - `/reports/[id]` view page renders summary + highlights + lessons + nextPillars + counts grid
  - Owner-only "Monthly report" card on `/clients/[slug]` with a one-click "Generate this month's report" button
  - PDF export via Playwright deferred — HTML view doubles as a print-ready surface for now
- [x] **Client portal** — `/portal/[client_slug]` (token-based, sem conta) mostra: próximos posts agendados, posts publicados + métricas leves, aprovações pendentes
  - migration 009: `clients.portal_token text` + unique partial index (null allowed, non-null must be unique)
  - `generatePortalTokenAction` + `revokePortalTokenAction` (32-byte hex token) on `clients/actions.ts`
  - Owner-only "Client portal" card on `/clients/[slug]` with generate / rotate / revoke controls + copyable URL
  - Public route at `src/app/p/[token]/page.tsx` (outside `[locale]` + auth); middleware matcher updated to skip `/p/*`
  - Service-role client fetches client-scoped `scheduled_posts`, `approvals` (not yet answered + not expired), and `published_posts` (last 10 each)
  - Landed at `/p/[token]` instead of `/portal/[slug]` to match the `/a/[token]` pattern (shorter URL, no slug-in-URL coupling); metrics bars on published posts land once Meta metrics collection ships (Sprint 11-12)
- [x] **LinkedIn publishing** — `src/lib/linkedin.ts` + pipeline de agendamento análogo ao IG (requer Company Page)
  - `src/lib/linkedin.ts` — Versioned Posts API wrapper (LinkedIn-Version pinned to 202403): pure `readCredentials` / `buildPostBody` (single-media for 1 img, `multiImage` for 2-9, clamped) + IO `initializeImageUpload` → `uploadImageBytes` → `createPost` (URN read from `x-restli-id` response header) + orchestrating `publishCarousel` (fetch each source URL → init+upload to LinkedIn → multi-image post). `LinkedInApiError` mirrors the IG error shape; 11 unit tests
  - `src/lib/env.ts`: `linkedin` group registered (LINKEDIN_ACCESS_TOKEN + LINKEDIN_ORGANIZATION_URN; pinned API version override via LINKEDIN_API_VERSION)
  - `.env.example`: pasted-token + org URN slots added; CLIENT_ID / CLIENT_SECRET kept for the future 3-legged OAuth flow when Community Management API is approved
  - `/api/cron/publish` dispatches by `row.platform`: 503 only when **both** IG and LinkedIn creds are missing; otherwise rows whose platform creds aren't present are skipped (`platform_creds_missing:<p>`) without bumping `attempt_count`. LinkedIn rows accept 1+ image (vs IG's 2+); on success the published_post row stores `platform="linkedin"` + the LinkedIn post URN as `external_id`
  - inactive until LinkedIn creds + Community Management API approval; tsc clean, 387 tests green (11 new)
- [x] **TikTok publishing** — `src/lib/tiktok.ts` + upload de vídeo via init API (conta Business)
  - `src/lib/tiktok.ts` — Content Posting API wrapper. Pure: `readCredentials` (TIKTOK_ACCESS_TOKEN + TIKTOK_PUBLISH_MODE) + `buildInitBody` (PULL_FROM_URL source; drops `privacy_level` in inbox mode since manual finalisation handles it; forwards title + duet/comment/stitch toggles + cover timestamp) + `initEndpoint` (selects /inbox/ vs /publish/ by mode). IO: `initVideoUpload` → `fetchPublishStatus` → `waitForPublishReady` (terminal states differ by mode) + orchestrating `publishVideo`. `TikTokApiError` matches the IG/LinkedIn error shape; 14 unit tests
  - Inbox mode (default): works with un-audited apps; sends drafts to the creator's TikTok app for manual finalisation. Direct mode: requires app audit + `video.publish` scope. Toggle via `TIKTOK_PUBLISH_MODE=direct`
  - PULL_FROM_URL requires the source domain be on TikTok's verified domains list (configured in dev portal). Operators must verify their Supabase Storage / CDN domain before publishing works
  - `src/lib/env.ts`: `tiktok` group registered (TIKTOK_ACCESS_TOKEN required + optional TIKTOK_PUBLISH_MODE)
  - `.env.example`: pasted-token slot + TIKTOK_PUBLISH_MODE; CLIENT_KEY / CLIENT_SECRET kept for the future 3-legged OAuth flow once Content Posting API is approved
  - `/api/cron/publish` adds TikTok dispatch: 503 only when **all** platforms missing creds; tiktok rows fail fast when the draft has no `video_url`; on success the published_post stores `platform="tiktok"` + the TikTok publish_id as `external_id`. `content_drafts` select widened to `(title, video_url)` so the cron can populate the TikTok title + locate the source URL
  - inactive until TikTok creds + Content Posting API approval + verified source domain; tsc clean, 401 tests green (14 new)
- [ ] **Production deploy** — Vercel (app) + Supabase Cloud (DB), DNS, SSL, env secrets, first smoke test

**Entrega:** Nest v1.0 rodando em produção, Andréa + equipe + Nayara usando diariamente.

---

## 4. Cross-cutting workstreams

Não pertencem a nenhuma sprint específica — vão acontecendo em paralelo.

### 4.1 Types generation
- [x] Script `npm run types:gen` que roda `supabase gen types typescript --local > src/types/database.gen.ts`
  - Also added `npm run types:check` for CI drift detection
  - `database.gen.ts` seeded (1417 lines, all tables / enums / functions / triggers)
  - Swap from hand-rolled `database.ts` → generated file still pending (next bullet)
- [ ] Substituir `database.ts` manual pelo gerado, commitar
- [ ] CI check: se `.gen.ts` tiver drift comparado ao gerado no momento do CI, falhar

### 4.2 Testing
- [ ] **Vitest** pra unit/integration: `slugify`, actions validation, pure helpers
- [ ] **Playwright** E2E: login, clients CRUD, brand kit, content engine (quando existir)
- [ ] Coverage target: 70% nas actions; nem todo UI precisa de teste
- [ ] Roda em CI a cada PR

### 4.3 CI/CD
- [x] GitHub Actions: `typecheck`, `lint`, `vitest`, `playwright` em todo push
  - `.github/workflows/ci.yml` runs Node 20, `npm ci`, `typecheck`, then `vitest` on every push + PR targeting `main`
  - `lint` deferred (next lint is deprecated upstream; migration to `@eslint/cli` codemod tracked inline)
  - Playwright smoke deferred until a hosted Supabase preview DB + seed is available in CI
- [ ] Preview deploy automático via Vercel em PRs
- [ ] Branch `main` → production deploy após tests green

### 4.4 Supabase Cloud migration
- [ ] Criar projeto production no Supabase Cloud (plano Pro)
- [ ] Rodar migrations via `supabase db push`
- [ ] Configurar SMTP (auth emails) + storage buckets + RLS spot-check
- [ ] Rotate env secrets na Vercel

### 4.5 Observability
- [ ] **Sentry** pra erros client + server
- [ ] **Vercel Analytics** pra web vitals
- [ ] Logs estruturados nas server actions (pino ou console JSON)
- [ ] Dashboard interno "/admin/usage" pra monitorar consumo Claude API por cliente

### 4.6 Segurança
- [ ] CSRF: server actions já têm origin check, OK
- [ ] Rate limit em APIs públicas (approvals, webhooks) via Vercel Edge
- [ ] 2FA obrigatório pra role=owner (Supabase Auth MFA)
- [ ] Rotação de tokens Meta/Google (job diário de refresh)
- [ ] Backup semanal do Postgres (Supabase já faz; validar retention)

### 4.7 Performance
- [ ] Paginação: clients list (>50), tasks list (>100), published_posts
- [ ] Index review: adicionar índices conforme queries reais
- [ ] Edge caching: Today page, Reports (com revalidate tag)
- [ ] Image optimization: `next/image` em tudo que mostra Storage URL

### 4.8 Documentação
- [ ] Cada feature maior ganha `docs/<feature>.md` com: propósito, fluxo, pontos de extensão
- [x] Runbook operacional `docs/ops.md`: como restart Supabase, recuperar senha de dev, rotar tokens
- [x] API reference `docs/api.md` pros endpoints públicos (approvals, webhooks, cron)

---

## 5. Post-v1 (v1.5 e além)

Não entram antes da v1 em produção. Prioridade aproximada:

1. **WhatsApp Business API** — notificações (task atribuída, aprovação necessária, post falhou)
2. **A/B testing de criativos** — Claude gera 2-3 variantes, coleta métricas comparativas
3. **Análise vetorial de comentários** — embeddings dos comentários dos posts, clusters de temas pro cliente revisar
4. **Mobile PWA** — manifest + service worker, otimização de formulários pra mobile, offline-first pras aprovações do cliente
5. **Voice clone pros vídeos** — ElevenLabs / similar pra narrar reels
6. **Auto-scheduling por IA** — analisa horários de melhor engajamento e sugere slots
7. **Sugestão de pilares** — a partir do histórico de posts + métricas, propõe novos temas
8. **Editor colaborativo** — múltiplos usuários editando o mesmo draft (CRDT via Yjs ou Liveblocks)
9. **Integração Typeform / Tally** — coleta de briefing inicial do cliente

---

## 6. Riscos mapeados

| # | Risco | Impacto | Mitigação | Owner |
|---|---|---|---|---|
| 1 | Meta Graph API muda regras de publicação | Alto | Monitorar changelog + abstrair SDK + fallback manual (exportar PNG) | Dev |
| 2 | Token long-lived expira silenciosamente | Médio | Cron diário que refresca tokens + alerta email se falhar 2x | Dev |
| 3 | Rate limit Claude API em picos | Médio | Prompt caching + fila com retry exponencial + cap diário por cliente | Dev |
| 4 | Custo Claude API escala descontroladamente | Médio | Dashboard de consumo por cliente + alerta quando >$50/mês/cliente | Dev |
| 5 | Performance com muitos clientes | Médio | Paginação + índices + edge caching + lazy loading | Dev |
| 6 | LinkedIn API requer Company Page da Nayara | Baixo | Começar só com IG; LinkedIn fica pra v1 mais flexível | Andréa |
| 7 | Fotos da Nayara dependem de sessão presencial | Alto | Banco inicial + reshoot trimestral agendado | Andréa |
| 8 | Dev env depende de Docker local (pesado) | Baixo | Documentar alternative: Supabase Cloud dev project | Dev |

---

## 7. Decisões pendentes com Andréa

Do HANDOFF §11 — precisam ser resolvidas antes ou durante a sprint correspondente:

| # | Item | Sprint bloqueadora | Status |
|---|---|---|---|
| 1 | Domínio do app (`nest.andreafariamkt.com` ou `app.nest.studio`?) | 11–12 (deploy) | pending |
| 2 | Portal do cliente: subdomain ou sub-rota? | 11–12 | pending |
| 3 | Plano Supabase (free vs Pro desde day 1) | 11–12 | pending |
| 4 | Conta Meta: Factory existente ou dedicada Nest? | 5–6 | pending |
| 5 | Storage das fotos: Supabase Storage ou Google Drive? | 1–2 Phase B | pending — assumindo Supabase Storage |
| 6 | Nayara tem Company Page LinkedIn? | 11–12 | pending |
| 7 | Inglês na interface é v1 ou v2? | — | **resolvido** — EN suportado desde dia 1 via i18n |
| 8 | Logo final do Nest | qualquer sprint | pending — usando mark provisório |

---

## 8. Métricas de progresso

Atualizar a cada commit relevante. Baseline: Sprint 1–2 parcial.

| Métrica | Valor atual | Meta v1 |
|---|---|---|
| Sprints concluídas | 2 / 6 | 6 |
| Tabelas usadas (de 24) | 13 (profiles, clients, brand_kits, brand_assets, contracts, services, client_services, client_members, cycles, tasks, notifications + Storage bucket + vercel cron) | 24 |
| Endpoints da API externa integrados | 0 | 5+ (Meta IG, Claude, Google Calendar, LinkedIn, TikTok) |
| Cobertura i18n | 100% (duas locales pareadas) | 100% |
| Testes automatizados | 48 unit + 11 E2E | ≥ 30 unit + 10 E2E |
| Tempo pra publicar 1 post (onboarding → IG) | N/A | < 15 min |

---

## 9. Como continuar

Cada vez que uma slice for implementada:

1. Atualize o checkbox da seção §3 correspondente
2. Incremente a tabela §8 se aplicável
3. Se a slice introduz decisão técnica nova, registre em [HANDOFF.md](./HANDOFF.md) ou num `docs/adr-*.md`
4. Commit com mensagem `<area>: <what>` (ex: `tasks: kanban drag-and-drop`)

Este arquivo é o índice. A ordem não é sagrada — se uma urgência aparecer (ex: Andréa precisa publicar na próxima semana antes da sprint 5), repriorizamos aqui e seguimos.
