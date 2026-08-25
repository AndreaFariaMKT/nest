# Nest · API reference

> **Staleness notice.** Audited 2026-08-25 against the code. Corrections marked
> **[corrected]** are applied; the rest of the text has aged and was not
> rewritten. Where this file and the code disagree, the code wins. To *operate*
> the system rather than develop it, see [docs/usage/](usage/README.md).



HTTP endpoints exposed by the app. Internal server actions (everything behind `/[locale]/(app)`) aren't listed — they're typed in code and consumed via React form actions, not as a stable API.

Route handlers live under `src/app/api/**/route.ts`.

Last reviewed: 2026-04-23.

---

## 1. Public (no auth)

### `GET /api/health`
Liveness + readiness probe. Returns 200 when the process is up and the DB is reachable.

**Response 200**
```json
{
  "status": "ok",
  "version": "abc1234",
  "uptimeSec": 7175,
  "checks": { "db": { "ok": true, "latencyMs": 44 } },
  "elapsedMs": 45
}
```

**Response 503** — DB unreachable, env unconfigured, or query failed.

Safe to call from uptime monitors. Never returns row data.

---

## 2. Token-gated public (no login, token in URL)

### `GET /a/[token]` — approval link page
Server-rendered page for a client to approve or request changes on a carousel draft.

- Token is minted by `generateApprovalLinkAction` (owner-only, from the draft edit page).
- 14-day TTL (`approvals.expires_at`). Past that, the page shows an expired state instead of 404.
- Already-answered approvals show a read-only "thanks" block.

### `POST /a/[token]` (form actions) — `approveViaTokenAction`, `rejectViaTokenAction`
Server actions on the page — not raw REST endpoints, but observable from the `<form action=…>` submissions. Write `approved_at` or `rejected_at` + `client_comment` via the service-role client, then redirect to the thanks state.

### `GET /p/[token]` — client portal
Read-only dashboard scoped to a single client via `clients.portal_token`. Renders:
- Up to 10 upcoming `scheduled_posts`
- Up to 10 pending approvals (non-expired, non-answered)
- Up to 10 `published_posts`

Rotate or revoke the token from the Client portal card on `/clients/[slug]` (owner-only).

Both `/a/*` and `/p/*` are excluded from the `src/middleware.ts` matcher so they bypass the locale prefix and the auth guard entirely.

---

## 3. Cron (bearer-auth)

All cron endpoints require `Authorization: Bearer $CRON_SECRET`. Vercel Cron adds this header automatically when `CRON_SECRET` is set in the Vercel project.

### `GET|POST /api/cron/cycles`
**Schedule**: `0 3 1 * *` (03:00 UTC on day 1 of each month)

Creates a `cycles` row for every active client for the current (year, month) via idempotent upsert. Then clones matching `tasks` templates into real tasks (scoped by `tasks.is_template = true` with either `client_id = null` for global or matching the new cycle's client_id).

**Response**
```json
{ "createdOrKept": 4, "total": 4, "clonedTasks": 1, "year": 2026, "month": 4 }
```

### `GET|POST /api/cron/meta-refresh`
**Schedule**: `0 4 * * *` (daily at 04:00 UTC)

Refreshes Meta's Long-Lived Token before the 60-day expiry. Additional env required: `META_APP_ID`, `META_APP_SECRET`.

**Response 503** — Meta creds missing. Body: `{ error: "meta_creds_missing", missing: [...] }`.

**Response 501** — Meta creds present but refresh wiring not yet shipped. Body includes a pointer to `src/app/api/cron/meta-refresh/route.ts`.

### `GET|POST /api/cron/publish`
**Schedule**: `*/5 * * * *` (every 5 min)

Picks up to 10 `scheduled_posts` where `status = 'pending'` and `scheduled_for <= now()`, publishes each as an Instagram carousel via `publishCarousel()`, writes `published_posts`, and flips statuses. LinkedIn + TikTok rows are skipped with a `platform_unsupported` reason until those wrappers ship.

Failure handling: increments `attempt_count` + writes `last_error`; flips `status = 'failed'` after 3 attempts.

**Response 200**
```json
{ "processed": 3, "published": 2, "failed": 1, "skipped": 0, "errors": [{ "scheduledId": "…", "reason": "ig_api:…" }] }
```

**Response 503** — Meta credentials missing. Body includes `missing: ["META_LONG_LIVED_TOKEN", …]`.

---

## 4. App-only endpoints (session required)

### `POST /api/instagram/publish`
Publishes a single draft as an IG carousel. Bearer-gated with `CRON_SECRET` even when invoked from the browser so cron + manual curl share a single code path.

**Body**: `{ "draftId": "<uuid>" }`

**Response 200**: `{ "publishedId": "…", "containerId": "…" }`

**Response 400** — missing or invalid draft id, or fewer than 2 rendered creatives.

**Response 502** — Graph API returned an error (message + code in body).

**Response 503** — Meta creds missing.

Used mainly for manual retries when the cron publisher stops on a row (set `scheduled_posts.status = 'pending'` + `attempt_count = 0` and either wait 5 min or curl this endpoint).

---

## 5. Adding a new endpoint

Checklist:

1. Place the route at `src/app/api/<area>/<action>/route.ts`.
2. Export `dynamic = "force-dynamic"` unless the response is safe to cache.
3. Always validate auth first — prefer `CRON_SECRET` bearer for cron, `supabase.auth.getUser()` for app-session.
4. Use the service-role client (`createClient` from `@supabase/supabase-js`) only when you have an explicit reason to bypass RLS. Document it in a comment.
5. Return JSON with a stable shape — clients don't like undocumented fields appearing.
6. Add the entry here in `docs/api.md` in the same commit.

---

## 6. Deprecated / removed

None yet. When we deprecate something, move it here with a note explaining what replaces it and when the field/endpoint will be removed.
