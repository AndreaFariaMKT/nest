# Nest · Ops Runbook

Operational procedures for running and recovering the Nest stack. Keep this doc boring, specific, and up to date.

Last reviewed: 2026-04-23 (local dev; production runbook finalizes at Sprint 11-12 deploy).

---

## 1. Environments

| Env | Supabase | App | Who |
|---|---|---|---|
| `local` | `npx supabase start` (Docker) | `npm run dev` (Next.js) | Dev machines |
| `preview` | TBD — per-PR Vercel + branch Supabase | Vercel preview | CI on PR |
| `production` | Supabase Cloud (Pro) — project TBD | Vercel main | Andréa + staff |

Required env vars (see `.env.example`):

- `NEXT_PUBLIC_SUPABASE_URL` · `NEXT_PUBLIC_SUPABASE_ANON_KEY` · `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL` — used in generated links (approval, portal)
- `ANTHROPIC_API_KEY` — Claude
- `CRON_SECRET` — bearer on `/api/cron/*`
- `META_LONG_LIVED_TOKEN` + `INSTAGRAM_BUSINESS_ACCOUNT_ID` (+ `META_APP_ID` + `META_APP_SECRET` later)
- `VOYAGE_API_KEY` (optional — semantic memory is inert without it)

---

## 2. Local dev — daily startup

```bash
docker ps >/dev/null 2>&1 || open -a Docker
until docker ps >/dev/null 2>&1; do sleep 2; done
npx supabase start
until pg_isready -h 127.0.0.1 -p 54322 -U postgres >/dev/null 2>&1; do sleep 2; done
npm run dev  # or use Claude Preview MCP
```

Dev login: `dev@nest.local` / `devpassword` (seeded by `supabase/seed.sql`).

---

## 3. Database

### Apply a new migration locally
```bash
# Migrations live at supabase/migrations/NNN_<slug>.sql
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -f supabase/migrations/NNN_<slug>.sql
```

### Reset the local DB from scratch
```bash
npx supabase db reset   # re-applies every migration + runs seed.sql
```

### Regenerate TypeScript types after a schema change
```bash
npm run types:gen    # writes src/types/database.gen.ts
npm run types:check  # CI drift detector
```

### Common read queries

```sql
-- Active clients + MRR (BRL cents) this month
select c.name, sum(k.monthly_value_cents)/100.0 as mrr_brl
from clients c
join contracts k on k.client_id = c.id
where k.starts_on <= current_date and (k.ends_on is null or k.ends_on >= current_date)
group by c.name order by mrr_brl desc;

-- Drafts by status for a client
select status, count(*) from content_drafts
where client_id = '<uuid>' group by status order by 2 desc;

-- Due scheduled posts
select id, draft_id, platform, scheduled_for, attempt_count
from scheduled_posts where status='pending' and scheduled_for <= now();
```

---

## 4. Cron endpoints

All cron endpoints use bearer auth: `Authorization: Bearer <CRON_SECRET>`.

| Endpoint | Schedule (Vercel) | What it does |
|---|---|---|
| `POST /api/cron/cycles` | `0 3 1 * *` | Creates a `cycles` row for every active client for the current month + clones matching templates into `tasks` |
| `GET /api/cron/publish` | `*/5 * * * *` | Processes due `scheduled_posts` (up to 10) → `publishCarousel()` → writes `published_posts` + flips statuses |
| `GET /api/cron/meta-refresh` | `0 4 * * *` | Refreshes the Meta long-lived token (60-day expiry). Currently 503 until Meta creds land; 501 afterwards until the refresh body is wired. |

### Manual test locally

```bash
# 401 unauth
curl -i http://localhost:3000/api/cron/publish

# 200 / 503 with bearer
curl -i -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/publish
```

---

## 5. Public tokens (no-auth URLs)

| Surface | Token column | URL | Rotation |
|---|---|---|---|
| Approval link | `approvals.token` | `/a/[token]` | Per-draft; 14-day TTL |
| Client portal | `clients.portal_token` | `/p/[token]` | Per-client; owner rotates |

Tokens are 64-char hex (32 random bytes via `crypto.getRandomValues`). Never log tokens. If a token leaks, rotate from the client detail page (portal) or generate a new approval link (approvals are append-only — old ones stay but get `expires_at` checked).

---

## 6. Storage buckets

| Bucket | Public read? | Contents | Size cap |
|---|---|---|---|
| `brand-assets` | Yes | Client brand kit logos / swatches / fonts | 10 MB |
| `creatives` | Yes | PNG renders of carousel slides (Playwright HTML→PNG) | 10 MB |
| `reel-videos` | Yes | Final recorded Reel videos (MP4 / MOV / WebM) | 500 MB |

All three are public-read because Instagram Graph API needs public URLs for container creation. Writes are gated via RLS using the `split_part(storage.objects.name, '/', 1)` → `content_drafts.id` pattern.

---

## 7. Credentials lifecycle

### Meta (Instagram Graph)
- Long-lived page token expires every 60 days.
- TODO: add a daily `/api/cron/meta-refresh` endpoint that refreshes the token via `oauth/access_token?grant_type=fb_exchange_token` and emails the owner if refresh fails twice in a row.
- Manual refresh in the meantime: regenerate the token in Meta Business Suite → update `.env.local` or Vercel env → redeploy.

### Google (Calendar + Meet)
- Blocked until credentials land. Refresh tokens issued on consent; store in `profiles.google_refresh_token` (migration TBD).

### Claude (Anthropic)
- No rotation required for daily ops. Watch the `/admin/usage` dashboard (once built) to spot runaway spend.

---

## 8. Incident playbook

### App is down / 500s
1. Open `/api/health` — if 503, DB is the culprit.
2. Check Vercel deploy logs for the last commit.
3. `git log --oneline -5` — revert the last commit with `git revert <sha>` if the regression is obvious.

### Cron publisher isn't firing
1. Check the scheduled_posts queue: `select id, attempt_count, last_error from scheduled_posts where status in ('pending','failed') order by scheduled_for desc limit 20;`
2. Curl `/api/cron/publish` manually with the bearer — response tells you if Meta creds are missing or the queue is empty.
3. If a row is stuck on `attempt_count = 3` → `failed`, inspect the `last_error` and either fix the draft (re-render creatives, re-generate caption) and re-queue, or delete the row.

### Approval / portal link returns 404
1. Token is invalid or was rotated. Check `select * from approvals where token = '<x>';` or `select * from clients where portal_token = '<x>';`.
2. For approval links, check `expires_at` vs `now()` — expired links render a friendly message, not a 404; a true 404 means the token doesn't exist.

### Claude API quota exceeded
1. `ANTHROPIC_API_KEY` quota is per-account — check the Anthropic console.
2. The app will fail actions gracefully (console.error + no-op) but UX will be confusing. Temporarily raise the org limit or pause automation that hits Claude (content generation, compliance checks, adapt, reel script, monthly report).

### Supabase down
1. `supabase status` (local) or the Supabase dashboard (cloud).
2. App shows "degraded" on `/api/health` and every server action that writes will fail.
3. Read-heavy pages may still work via cached RLS reads depending on the outage.

---

## 9. Data export / backup

- Supabase Cloud: automatic daily backups on Pro (validate retention = 7 days before relying on it).
- Manual dump of a local DB:
  ```bash
  pg_dump -h 127.0.0.1 -p 54322 -U postgres -d postgres --no-owner --no-acl \
    > ~/nest-dump-$(date +%Y%m%d).sql
  ```
- CSV export of a table:
  ```bash
  psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
    -c "\copy clients to '/tmp/clients.csv' csv header"
  ```

---

## 10. Seeding test data

Dev seed: `supabase/seed.sql` (owner user + one sample client). For richer test data, paste recorded Playwright traces or run:

```sql
-- Insert a dummy active contract so MRR shows up on /today
insert into contracts (client_id, title, monthly_value_cents, starts_on)
values ((select id from clients where slug='nayara-aquino'), 'Mensalidade test', 450000, current_date);
```

---

## 11. Contacts

- **Owner**: Andréa Faria (studio) — final decisions on feature scope + credentials
- **Dev**: Edrick — implementation + deploys
- **Agent**: Claude (autonomous /loop runs) — commits locally, never pushes

When escalating: include the commit SHA, the URL that failed, and the `elapsedMs` + `checks.db` fields from `/api/health`.
