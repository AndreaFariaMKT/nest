# Nest · Deploy Runbook

Zero-to-production checklist. Every step is either idempotent or explicitly marked otherwise. Partner doc: [`ops.md`](./ops.md) for day-2 operations.

Last reviewed: 2026-04-24.

---

## 0. Pre-flight decisions

Must be resolved before this runbook starts ([HANDOFF §11](../HANDOFF.md)):

- [ ] Production domain (`app.nest.studio` vs. `nest.andreafariamkt.com`)
- [ ] Supabase plan (Free vs. Pro — Pro gets daily backups + 8 GB DB)
- [ ] Meta account: Factory's existing IG business OR a dedicated Nest account
- [ ] Google OAuth: personal workspace vs. Andréa Faria workspace credentials

Without #1 and #2 this runbook can't finish.

---

## 1. Supabase Cloud project

1. Create the project at [supabase.com/dashboard/new](https://supabase.com/dashboard/new)
   - Region: `sa-east-1` (São Paulo) — smallest client-to-DB latency for the studio
   - Pro plan from day 1 (backups + perf + generous storage)
2. Save the generated credentials to a password manager under `Nest · prod`:
   - Project URL
   - anon key
   - service_role key
   - DB password (for direct psql access)
3. Apply migrations from the local checkout:
   ```bash
   npx supabase link --project-ref <ref>
   npx supabase db push   # applies every file in supabase/migrations/
   ```
4. Run the seed in prod (idempotent; creates the dev owner + a sample client):
   ```bash
   psql "$SUPABASE_PROD_URL" -f supabase/seed.sql
   ```
   ⚠ Change the dev email/password before first login. Or skip the seed
   entirely and create the first owner manually via Supabase Auth.
5. Create storage buckets by rerunning these migrations (they're idempotent):
   - `003_fix_brand_assets_rls.sql`
   - `005_creatives_storage.sql`
   - `011_reel_videos_storage.sql`
6. Validate RLS with a spot check:
   ```bash
   psql "$SUPABASE_PROD_URL" -c "\dt public.*" | wc -l   # expect ≥ 20 tables
   psql "$SUPABASE_PROD_URL" -c "select policyname from pg_policies where schemaname='public';"
   ```

---

## 2. Vercel project

1. Push the repo to GitHub (done in dev).
2. Import the repo at [vercel.com/new](https://vercel.com/new) — pick "Next.js".
3. Set environment variables under **Settings → Environment Variables** for the `Production` environment (and optionally `Preview`):

   **Required**
   | Var | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | from §1 step 2 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from §1 step 2 |
   | `SUPABASE_SERVICE_ROLE_KEY` | from §1 step 2 |
   | `NEXT_PUBLIC_APP_URL` | the prod domain with scheme (e.g. `https://app.nest.studio`) |
   | `CRON_SECRET` | `openssl rand -hex 32` — anything 64 chars |
   | `ANTHROPIC_API_KEY` | from Anthropic console |

   **Optional (activate features as they unblock)**
   | Var | Notes |
   |---|---|
   | `META_LONG_LIVED_TOKEN` | 60-day token; `/api/cron/meta-refresh` rotates it once wired |
   | `INSTAGRAM_BUSINESS_ACCOUNT_ID` | IG Business account id (not the page id) |
   | `META_APP_ID` + `META_APP_SECRET` | needed for token refresh |
   | `VOYAGE_API_KEY` | activates semantic memory retrieval |
   | `GOOGLE_OAUTH_CLIENT_ID` + `GOOGLE_OAUTH_CLIENT_SECRET` | enables Calendar sync (Sprint 9-10) |
   | `SENTRY_DSN` | opt-in error tracking; envelope format |

4. Sanity check with the Vercel CLI:
   ```bash
   npx vercel env ls production
   ```

---

## 3. First deploy

1. Push to `main` — Vercel auto-builds and deploys.
2. Watch the build log for `vite` / `tsc` errors.
3. When the deploy goes green, curl `/api/health`:
   ```bash
   curl -s https://<your-domain>/api/health | jq
   ```
   Expected:
   ```json
   {
     "status": "ok",
     "version": "<short-sha>",
     "checks": {
       "db": { "ok": true, "latencyMs": 40 },
       "env": { "ok": true, "inactiveOptional": ["meta", "voyage", "google", "sentry"], ... }
     }
   }
   ```
   If `env.ok` is `false`, go back to §2.3 and set the missing var.
4. Log in with the seeded owner account (or the manually-created one from §1.4).

---

## 4. DNS

1. Add an `A` / `CNAME` record pointing the apex or subdomain at Vercel's edge per the domain wizard on **Settings → Domains**.
2. Vercel issues a free Let's Encrypt cert on propagation (5 min – 24 h).
3. Validate the cert:
   ```bash
   curl -I https://<your-domain>/
   # expect HTTP/2 200 and a valid certificate
   ```
4. Set `NEXT_PUBLIC_APP_URL` to match the final production URL and redeploy.

---

## 5. Vercel Cron

Vercel reads `vercel.json` → `crons[]` on deploy. Confirm:

```bash
npx vercel inspect --prod <domain>
# or visit the "Cron Jobs" tab in the project settings
```

Expected entries:
- `/api/cron/cycles` — `0 3 1 * *` (monthly)
- `/api/cron/publish` — `*/5 * * * *` (every 5 min)
- `/api/cron/meta-refresh` — `0 4 * * *` (daily)

Each job runs as an authenticated fetch with `Authorization: Bearer $CRON_SECRET` — Vercel adds this automatically when `CRON_SECRET` is defined in env.

---

## 6. Post-deploy smoke

Run once from your laptop against the prod URL:

```bash
# Health
curl -s https://<domain>/api/health | jq .status   # "ok"

# Auth gate on the app
curl -s -o /dev/null -w "%{http_code}\n" https://<domain>/en/today   # 307 (redirect to login)

# Cron auth gate
curl -s -o /dev/null -w "%{http_code}\n" https://<domain>/api/cron/publish   # 401 without bearer

# Cron works with bearer
curl -s -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/cron/publish | jq
# empty queue → { processed: 0, ... }
# missing Meta creds → 503 with missing[] list
```

---

## 7. Rollback

If a deploy breaks prod:

1. **Vercel UI**: Deployments → pick the last green deploy → **Promote to Production**. Zero-downtime rollback in ~15s.
2. Or CLI: `npx vercel rollback <deployment-url> --yes`.
3. Database migrations don't roll back automatically. If a migration is at fault:
   - Write a new migration that reverts the change (never `git revert` an applied migration file in place — other environments may have already run it).
   - Ship that migration before the next forward-fix.

---

## 8. Monitoring + alerts

- `/api/health` — point uptime monitor (e.g., Checkly, BetterStack) at it; alert on non-200 or `checks.db.ok = false`.
- **Sentry** — `SENTRY_DSN` set → `log.error()` events flow through (see `src/lib/sentry.ts`). Configure the issue alert in Sentry's UI.
- **Vercel Analytics** — free web-vitals dashboard; no config beyond flipping it on in the project settings. Deferred, not in this runbook.
- **`/admin/usage`** — owner-only dashboard for Claude spend per client. Manual check weekly during the first month of prod usage.

---

## 9. Known prod gaps (as of 2026-04-24)

- [x] Playwright creatives / Reel renderer — migrated to `@sparticuz/chromium` + `puppeteer-core` via the shared launcher `src/lib/browser.ts` (local dev reuses Playwright's Chromium). PDF route pinned to `runtime = "nodejs"` + `maxDuration = 60`.
- [ ] `src/lib/rate-limit.ts` uses in-memory state — resets per instance. Swap to Upstash Redis before horizontal scale.
- [ ] `/api/cron/meta-refresh` scaffolded but the actual Graph exchange isn't wired. See the route file for the ~20-line follow-up.
- [ ] Types file `src/types/database.ts` is still hand-rolled; `database.gen.ts` is auto-generated but the swap is pending (ROADMAP §4.1).
