# Nest · Autonomous Working Protocol

This doc binds Claude (the agent) when running via `/loop` or any unattended mode on this repo. Violating these rules is a bug.

Accepted by the user on **2026-04-22**.

---

## The 5 policies

### 1. **No remote push**
- `git commit` locally — yes.
- `git push`, `git push --force`, `git push origin ...` — **no**.
- The user reviews and pushes manually on their own schedule.
- If the branch diverges and a merge/rebase is needed to continue, **stop** and ask.

### 2. **Strict ROADMAP order**
- Work slices in the exact order they appear in [`ROADMAP.md`](../ROADMAP.md) §3.
- Within a sprint, top-to-bottom.
- Do not skip ahead to a later sprint without the user saying "go to sprint N".
- If a slice reveals a missing prerequisite, solve the prerequisite first — but keep it within the same sprint when possible.

### 3. **Stop on external-credential blockers**
Stop the loop and surface a summary the moment the next slice requires any of:
- Meta / Instagram Graph API credentials (app ID, app secret, long-lived token)
- Google OAuth credentials + redirect URI
- LinkedIn app credentials or confirmation of a Company Page
- TikTok Content Posting API credentials
- Anthropic `ANTHROPIC_API_KEY`
- WhatsApp Business access token
- Domain/DNS decisions (Sprint 11–12)
- Supabase Cloud project creation

These are the items listed in ROADMAP.md §7. When blocked, leave a clear note in the loop's final message.

### 4. **Stop conditions**
Stop autonomously (without the user asking) when **any** of:
- Sprint 1–2 is fully checked in ROADMAP.md §3.
- A credential blocker from §3 above is hit.
- 3 consecutive slices fail (typecheck, test, or preview verification that can't be recovered).
- A data-loss risk is detected (migration that drops a table, `psql` running against non-local DB, etc.).
- The loop has created **10 or more commits in a single run** without the user stepping back in — hard cap to bound cost.

When stopping, summarize what shipped, what failed, and what's next.

### 5. **Tests are a hard dependency going forward**
- Set up Vitest + a minimum smoke Playwright suite **in the first slice** of the autonomous run (before touching feature slices).
- Every new server action / helper lib ships with at least one unit test.
- Every new user-facing flow ships with a Playwright smoke that covers the happy path.
- `npm run test` must pass before each commit.
- If a test fails and 2 repair attempts don't fix it, stop (counts toward the "3 consecutive failures" rule from §4).

---

## Per-slice loop

Execute this pipeline for every slice:

1. **Pick** the next unchecked `- [ ]` bullet under ROADMAP.md §3, scanning sprints in order.
2. **Plan** — if the slice is >30 lines of code or touches >4 files, write a 5-bullet plan in the commit body and update the ROADMAP slice with the plan before coding.
3. **Implement** — writes, edits, migrations, types.
4. **Verify**
   - `npx tsc --noEmit` → must exit 0
   - `npm run test` → must exit 0 (when §5 is live)
   - Preview flow if the slice is visual — use Claude Preview MCP, verify happy path
   - Verify data with a `psql` query if the slice persists anything
5. **Mark** — flip the checkbox in ROADMAP.md §3 to `[x]`, and bump §8 metrics if applicable.
6. **Commit**
   - Stage with `git add` (explicit paths, never `-A`)
   - Message format: `<area>: <what>` (e.g. `tasks: kanban drag-and-drop`) + Co-Authored-By trailer
   - **No push.**
7. **Schedule next tick** — call `ScheduleWakeup` with `delaySeconds: 120` and re-enter the loop prompt, unless a stop condition from §4 fires.

---

## Safety rails

- **Database URL check** — every `psql` call must target `127.0.0.1:54322`. Any other host = stop immediately.
- **Secrets** — never commit `.env`, `.env.local`, or any file with credential material. If a slice requires a new secret, add it to `.env.example` with an empty value and stop for the user to fill `.env.local`.
- **Destructive SQL** — `DROP TABLE`, `TRUNCATE`, `DELETE FROM` without a narrow `WHERE` on local DB only, and only when a migration requires it. Never in prod.
- **File deletions** — allowed for obsolete source files (as in the `NewClientForm.tsx` removal), never for config, data dumps, or user-authored content (`ROADMAP.md`, `HANDOFF.md`, `supabase/seed.sql`, `messages/*.json`).
- **Migrations** — new migrations always `supabase/migrations/NNN_<slug>.sql` incrementing NNN. Never edit an applied migration in place.
- **Cookie/session state** — if the preview shows a 401 or the middleware redirects to `/login`, re-authenticate with `dev@nest.local` / `devpassword` before continuing.

---

## Reboot procedure

If the environment is cold on wake (Supabase down, dev server down, Docker off):

```bash
docker ps >/dev/null 2>&1 || open -a Docker        # starts Docker if needed
until docker ps >/dev/null 2>&1; do sleep 2; done  # wait up to ~2 min
npx supabase start                                   # boots Postgres/Auth/etc.
until pg_isready -h 127.0.0.1 -p 54322 -U postgres >/dev/null 2>&1; do sleep 2; done
# dev server is started on-demand via Claude Preview MCP (preview_start)
```

If Supabase was `supabase stop`'d and comes up empty, `npx supabase db reset` re-applies migrations + seed.

---

## When to break protocol

Only if:
- The user manually messages and overrides. In that case, follow the user.
- You detect a security issue (leaked secret, SQL injection in existing code, RLS hole). Stop the loop, document the finding as a `docs/security-<date>.md` note, do not silently fix if the fix is invasive — surface it.
