# Credentials & rollout status

> **Staleness notice.** Audited 2026-08-25 against the code. Corrections marked
> **[corrected]** are applied; the rest of the text has aged and was not
> rewritten. Where this file and the code disagree, the code wins. To *operate*
> the system rather than develop it, see [docs/usage/](usage/README.md).



Last updated: 2026-05-04 · Source of truth for which integrations are live, which are pending external review, and what's left to wire up before production.

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

## 🟠 In progress — Production deploy (Passo 5)

Progress as of 2026-05-04:

| Step | Status | Notes |
|---|---|---|
| GitHub repo | ✅ done | `Edrick42/nest` (private) — Andrea decided to keep on Edrick's account; HEAD synced at `80db923` |
| Supabase Cloud project | ✅ done | Created on Pro plan; CLI linked; all 12 migrations applied (verified via `supabase migration list --linked`) |
| Vercel project | ✅ imported | Repo connected; project created; env vars filled (12 obrigatórias) |
| Env vars in Vercel | ✅ filled | Andrea pasted all 12 required vars on 2026-05-04. Pending: `NEXT_PUBLIC_APP_URL` + `GOOGLE_OAUTH_REDIRECT_URI` (need Vercel URL post-1st-deploy) |
| Domain registration | ⏸️ deferred | Andrea avaliando preços — usar `*.vercel.app` no deploy inicial |
| First deploy | ⏸️ pending | Andrea pausou antes de clicar Deploy. Próxima sessão: Vercel → Deploy → capturar URL |
| Post-deploy: redirect URI | ⏸️ pending | Após deploy, adicionar URL no Google Cloud Console + preencher 2 env vars finais |
| Smoke test | ⏸️ pending | |

### ⚠️ Security incident — 2026-05-04
Durante a sessão, Andrea colou no chat (em vez de na UI da Vercel):
1. **Supabase service_role key** (`sb_secret_*`) — orientado a rotacionar via Dashboard → Settings → API Keys → Roll
2. **Anthropic API key** (`sk-ant-*`) — orientado a Disable + criar nova `nest-prod`

**Verificar na próxima sessão:** se as chaves foram efetivamente rotacionadas (caso contrário, ainda há risco de uso indevido).

---

## .env.local cheat sheet

`.env.local` (dev local) status — **inalterado** na sessão de 2026-05-04 (continua apontando pro Supabase Docker local). Os valores de prod ficam **só na Vercel**, não no `.env.local`.

| Group | Local (.env.local) | Vercel (prod) |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_*` | local Docker `127.0.0.1:54321` | ✅ Cloud URL/anon (preenchido 2026-05-04) |
| `SUPABASE_SERVICE_ROLE_KEY` | local Docker | ✅ Cloud key (rotacionada 2026-05-04 — confirmar) |
| `ANTHROPIC_API_KEY` | vazio | ✅ chave `nest-prod` (rotacionada 2026-05-04 — confirmar) |
| `VOYAGE_API_KEY` | ✅ set | ✅ copiado |
| `GOOGLE_OAUTH_*` (3 vars) | ✅ set | ✅ 2 copiados; `REDIRECT_URI` pendente até ter Vercel URL |
| `META_*` (4 vars) | ✅ set | ✅ copiados |
| `CRON_SECRET` | ✅ set | ✅ copiado |
| `NEXT_PUBLIC_APP_URL` | local | ⏸️ pendente — preencher pós-deploy |
| `LINKEDIN_*` | not set | skipped (MDP review) |
| `TIKTOK_*` | not set | skipped |
| `WHATSAPP_*` | not set | skipped (não ativado) |
| `SENTRY_DSN` | optional | skipped |

---

## Next session plan

1. ⚠️ **Confirmar rotação** das 2 chaves vazadas no chat (Anthropic + Supabase service_role)
2. **Disparar 1º deploy na Vercel** → Deployments → Deploy
3. Capturar URL final (`nest-xxxxx.vercel.app`)
4. Voltar à Vercel → preencher `NEXT_PUBLIC_APP_URL` + `GOOGLE_OAUTH_REDIRECT_URI` → **Redeploy**
5. Google Cloud Console → adicionar `https://<URL>/api/google/callback` em Authorized redirect URIs
6. Smoke test: home, login Google, dashboard, cron health
7. (Background) Check LinkedIn MDP form status (~2026-05-18)
8. (Quando Andrea decidir) Registrar domínio + CNAME → Vercel

Estimated time: 30-45 min hands-on (sem o passo do domínio).
