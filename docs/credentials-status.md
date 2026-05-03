# Credentials & rollout status

Last updated: 2026-05-03 · Source of truth for which integrations are live, which are pending external review, and what's left to wire up before production.

The code for every integration listed here has already shipped — see ROADMAP §3. This document tracks **operator actions** (account creation, API key generation, review wait) that gate activation.

---

## ✅ Active

### Voyage AI · semantic memory
- Key obtained at https://dash.voyageai.com (free tier, 200M tokens)
- Set in `.env.local` as `VOYAGE_API_KEY`
- Smoke tested: returns 1024-dim embeddings via `voyage-3.5`
- **Effect**: next `generateCarouselsAction` run starts populating `content_drafts.embedding`; retrieval uses `match_drafts()` RPC instead of "last 10 titles" fallback

### Google OAuth · Calendar + Meet
- GCP project: **Nest Studio** (Internal user type — restricted to `andreafariamkt.com` Workspace)
- APIs enabled: Google Calendar API, Google Meet API
- OAuth client ID: `295846669794-t0flbssaku8uaocouaass5lo8ao05ri2.apps.googleusercontent.com`
- Authorized redirect URI: `http://localhost:3000/api/google/callback`
- Scopes granted: openid, email, profile, calendar, meetings.space.readonly
- End-to-end verified: Andrea logged in, tokens persisted in `profiles.google_refresh_token` + `google_access_token` + `google_token_expires_at` + `google_email` + `google_scopes`
- **Effect active**:
  - Calendar sync: creating/editing meetings in Nest mirrors to Google Calendar with Meet link auto-generated
  - Transcript pull cron (every 15 min): downloads Meet transcripts for finished meetings + extracts tasks via Claude Haiku

**For production**: add a second authorized redirect URI matching the production URL (e.g. `https://nest.studioandreafaria.com/api/google/callback`).

---

## 🟡 Partial / pending external review

### LinkedIn · publishing
- Company Page identified: `urn:li:organization:89520708`
- Developer App **Nest** created + verified at https://www.linkedin.com/developers/apps
- 2 Products approved (instant):
  - Sign In with LinkedIn using OpenID Connect
  - Share on LinkedIn (gives `w_member_social` — personal timeline only)
- **Blocker**: Community Management API / Marketing Developer Platform — required for `w_organization_social` (posting to Company Page) — currently shows a "Deprecation Notice" in the LinkedIn portal
- **Action needed**: revisit the MDP application form in ~15 days when LinkedIn portal stabilises. Form locations to try:
  - https://www.linkedin.com/developers/products/community-management-api
  - https://www.linkedin.com/help/linkedin/ask/api-dvr
  - https://learn.microsoft.com/en-us/linkedin/marketing/getting-access
- **Code state**: ready. `src/lib/linkedin.ts` uses `/rest/posts` with `LinkedIn-Version: 202403` (current, non-deprecated). Cron skips LinkedIn rows with `platform_creds_missing:linkedin` until `LINKEDIN_ACCESS_TOKEN` + `LINKEDIN_ORGANIZATION_URN` are set

---

## ⏸️ Skipped (revisit later)

### TikTok · publishing
- Skipped during 2026-05-03 session — requires similar 7-day human review and same effort as LinkedIn
- **Code state**: ready. `src/lib/tiktok.ts` defaults to inbox mode (no audit needed); flip `TIKTOK_PUBLISH_MODE=direct` once Content Posting API is approved

### Meta · Instagram publishing
- Long-lived token + IG business account ID **already in env** (per recent commits — `META_LONG_LIVED_TOKEN` + `INSTAGRAM_BUSINESS_ACCOUNT_ID` were set during earlier sprints)
- **Pending action when going to production**: copy these values into Vercel env vars

---

## ❌ Not started — Production deploy (Passo 5)

In-progress when the session ended. Pending decisions:

| Step | Status | Decision pending |
|---|---|---|
| GitHub repo (private) | not created | Andrea's GitHub username |
| Vercel project | not created | needs GitHub repo first |
| Supabase Cloud project | not created | Pro plan ($25/mo) approval |
| Domain registration | not started | Andrea chose option (c) — register a new dedicated domain (registrar TBD: Registro.br or Namecheap) |
| Env vars in Vercel | n/a | mirror everything in `.env.local` |
| First deploy + smoke test | n/a | |

Tomorrow's first ask: GitHub username so the repo can be created via `gh repo create --private` and the 9 local commits pushed.

---

## .env.local cheat sheet

What's set as of session end (2026-05-03):

| Group | Status |
|---|---|
| `NEXT_PUBLIC_SUPABASE_*` | local Docker (`http://127.0.0.1:54321`) — needs swap for Supabase Cloud URL/keys at deploy time |
| `SUPABASE_SERVICE_ROLE_KEY` | local Docker — same swap needed |
| `ANTHROPIC_API_KEY` | **not set** — Andrea will need to add hers (or use the team key) |
| `VOYAGE_API_KEY` | ✅ set |
| `GOOGLE_OAUTH_*` | ✅ set (3 vars) |
| `LINKEDIN_*` | not set — pending MDP approval |
| `TIKTOK_*` | not set — skipped |
| `META_*` | should already be set (from earlier sprints) |
| `CRON_SECRET` | ✅ set (random 32-char hex generated this session) |

---

## Tomorrow's plan

1. Get GitHub username → `gh repo create andreafariamkt/nest --private --source . --push`
2. Sign up for Vercel (Google login OK)
3. Sign up for Supabase Cloud + create production project (Pro plan)
4. Run `supabase db push` against production project to apply 12 migrations
5. Decide on domain registrar + register the chosen domain
6. Connect repo to Vercel, paste env vars, first deploy
7. Configure DNS (CNAME → Vercel)
8. Smoke test the production URL
9. (Background) Check LinkedIn MDP form status

Estimated time: 1.5h hands-on + DNS propagation wait.
