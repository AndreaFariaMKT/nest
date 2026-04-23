# Nest · Roadmap

Living document. Source of truth for **what is built**, **what is next**, and **in what order**. Updated as sprints land. Reference doc: [HANDOFF.md](./HANDOFF.md).

**Today** · 2026-04-22 · Branch `main` · 4 commits local

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
- [ ] **Semantic memory** — embeddings dos últimos 30-60 drafts por cliente (pgvector), busca antes de gerar pra evitar repetição temática; extensão `vector` já habilitável no Supabase local
  - migration 006: `vector` extension + `content_drafts.embedding vector(1024)` + hnsw index + `match_drafts()` RPC
  - `src/lib/embeddings.ts` — Voyage AI wrapper (voyage-3.5, 1024 dims) with graceful no-op fallback when `VOYAGE_API_KEY` missing; pure `cosineSimilarity` + `vectorToSql` helpers + unit tests
  - hook in `generateCarouselsAction`: embed each new draft (title + pillar + hook) after insert
  - retrieval in `generateCarouselsAction`: embed transcript → `match_drafts()` RPC → top-10 similar by cosine, falls back to "last 10 titles" when no embeddings exist
  - shipped but inactive until `VOYAGE_API_KEY` lands
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

- [ ] **Google OAuth** — `/api/google/*` com consent screen, store refresh token em `profiles.google_*` (migration nova)
- [ ] **Calendar sync** — listar eventos próximos 30 dias, criar/editar evento no Nest → espelha no Calendar (+ Meet link gerado)
- [x] **Meetings CRUD** — `/meetings` lista, `/meetings/new` agenda com cliente + participantes
  - `MeetingStatus` + `MEETING_STATUSES` + `meetings` table added to `src/types/database.ts`
  - `src/app/[locale]/(app)/meetings/actions.ts` — `createMeetingAction`, `updateMeetingAction`, `deleteMeetingAction` (server actions, validated, redirect-after-write)
  - `MeetingForm` shared component (title + datetime-local × 2 + client dropdown + status + Meet URL)
  - `/meetings` list splits upcoming/past, status pill per row
  - `/meetings/[id]` detail page with client link, Meet URL, linked transcripts section
  - `/meetings/[id]/edit` reuses the shared form with pre-filled values
  - i18n strings (status, fields, sections, actions, errors) for both locales
  - Google OAuth integration still deferred (credential blocker) — the Meet URL is a manual field for now; the cron-backed auto-creation lands when Google creds arrive
- [ ] **Calendar view** — `/calendar` visual com drag-to-reschedule, clique pra abrir meeting
- [ ] **Transcript pull job** — cron checa reuniões concluídas, baixa transcrição via Meet API, cria `transcripts` row, extrai tarefas via Claude (haiku) e cria `tasks`
- [ ] **Meeting detail** — mostra transcrição + tarefas geradas + botão "Gerar carrossel a partir dessa reunião"
- [ ] **Today page · parte 2** — reuniões de hoje + amanhã

**Entrega:** Andréa agenda tudo no Nest, transcrições viram tarefas e conteúdo.

---

### Sprint 11–12 · Reports + Portal + multi-platform

Goal: v1.0 em produção.

- [ ] **Metrics collection** — cron diário pega métricas de todos `published_posts` via Graph API; insere time-series em `post_metrics`
- [ ] **KPI dashboard** — `/reports` com filtro por cliente + período, gráficos (reach, impressions, engagement rate, saves, follows)
- [ ] **Monthly report generator** — Claude analisa métricas do mês + gera 5-10 bullets de insight + recomendações pro próximo ciclo; exporta PDF via Playwright
- [ ] **Client portal** — `/portal/[client_slug]` (token-based, sem conta) mostra: próximos posts agendados, posts publicados + métricas leves, aprovações pendentes
- [ ] **LinkedIn publishing** — `src/lib/linkedin.ts` + pipeline de agendamento análogo ao IG (requer Company Page)
- [ ] **TikTok publishing** — `src/lib/tiktok.ts` + upload de vídeo via init API (conta Business)
- [ ] **Production deploy** — Vercel (app) + Supabase Cloud (DB), DNS, SSL, env secrets, first smoke test

**Entrega:** Nest v1.0 rodando em produção, Andréa + equipe + Nayara usando diariamente.

---

## 4. Cross-cutting workstreams

Não pertencem a nenhuma sprint específica — vão acontecendo em paralelo.

### 4.1 Types generation
- [ ] Script `npm run types:gen` que roda `supabase gen types typescript --local > src/types/database.gen.ts`
- [ ] Substituir `database.ts` manual pelo gerado, commitar
- [ ] CI check: se `.gen.ts` tiver drift comparado ao gerado no momento do CI, falhar

### 4.2 Testing
- [ ] **Vitest** pra unit/integration: `slugify`, actions validation, pure helpers
- [ ] **Playwright** E2E: login, clients CRUD, brand kit, content engine (quando existir)
- [ ] Coverage target: 70% nas actions; nem todo UI precisa de teste
- [ ] Roda em CI a cada PR

### 4.3 CI/CD
- [ ] GitHub Actions: `typecheck`, `lint`, `vitest`, `playwright` em todo push
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
- [ ] Runbook operacional `docs/ops.md`: como restart Supabase, recuperar senha de dev, rotar tokens
- [ ] API reference `docs/api.md` pros endpoints públicos (approvals, webhooks, cron)

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
