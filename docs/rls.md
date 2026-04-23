# Nest · RLS architecture

Row-Level Security is Nest's primary authorization layer. Server actions and route handlers rely on it — the anon / authenticated Supabase client is trusted only as far as the policies let it go. Bypass it only via the service-role client, and only when you've documented why.

Last reviewed: 2026-04-24.

---

## 1. Actors

Three logical roles, backed by `profiles.role text`:

| Role | What they do |
|---|---|
| `owner` | Full access to all clients + every administrative surface (contracts, team management, pricing). |
| `staff` | Access to clients they're explicitly assigned to via `client_members`. |
| `client` | Reserved for a future client-login slice (Sprint 12+). Currently unused. |

Supabase Auth's `auth.users` is the source of identity. A `public.profiles` row is created by the `handle_new_user` trigger on signup; `profiles.id = auth.users.id`.

---

## 2. Helper functions

Every policy goes through one of these — they encapsulate the role logic so individual policies stay one-liners.

### `public.is_owner() → boolean`

```sql
select exists (
  select 1 from public.profiles
  where id = auth.uid() and role = 'owner'
)
```

Used for owner-gated writes: contracts, services catalog, published_posts insert, monthly_reports insert, published_posts.

### `public.has_client_access(client_id uuid) → boolean`

```sql
select
  public.is_owner()
  or exists (
    select 1 from public.client_members
    where user_id = auth.uid() and client_id = $1
  )
```

Used everywhere a row is scoped to a client: drafts, slides, creatives, approvals, ai_edits, tasks, meetings, transcripts, monthly_reports, published_posts, scheduled_posts.

---

## 3. Policy patterns

Three shapes cover ~90% of the policies:

### Pattern A — client-scoped read/write

```sql
create policy "xyz: read" on xyz for select
  using (has_client_access(client_id));

create policy "xyz: write" on xyz
  using (has_client_access(client_id))
  with check (has_client_access(client_id));
```

Applied to: `clients`, `brand_kits`, `brand_assets`, `content_drafts`, `meetings`, `tasks`, `client_services`, `client_members`, `client_contacts`, `notes`, `cycles`, `monthly_reports`, `templates`.

### Pattern B — client-scoped through a join

When the row doesn't carry `client_id` directly (e.g., `slides.draft_id`), the policy joins to the parent:

```sql
create policy "slides: read" on slides for select using (
  exists (
    select 1 from content_drafts d
    where d.id = slides.draft_id
      and has_client_access(d.client_id)
  )
);
```

Applied to: `slides`, `creatives`, `ai_edits`, `scheduled_posts`, `published_posts`, `post_metrics`.

### Pattern C — owner-only writes

Some tables accept reads for any authorized viewer but only owner writes:

```sql
create policy "contracts: owner writes" on contracts
  for all using (is_owner()) with check (is_owner());
```

Applied to: `contracts`, `services`, `published_posts` (insert gate), `monthly_reports` (writes).

### Pattern D — public via service role

Some rows are read publicly (no session) via the service-role client:

- `approvals` — accessed anonymously at `/a/[token]`. RLS is on but only `owner` can read directly; the server action uses `createServiceClient()`.
- `clients.portal_token` — accessed anonymously at `/p/[token]`, same pattern.

Service-role bypasses RLS by design. Every call site that uses `createServiceClient` is a trust boundary — document the reason inline.

---

## 4. Storage bucket policies

Three buckets, all public-read + client-scoped write via the `split_part(storage.objects.name, '/', 1)` pattern:

| Bucket | Path convention | Read | Write |
|---|---|---|---|
| `brand-assets` | `<kit_id>/<asset_id>.<ext>` | public | via `brand_kits` → `has_client_access` |
| `creatives` | `<draft_id>/<slide_id>-v<v>.png` | public | via `content_drafts` → `has_client_access` |
| `reel-videos` | `<draft_id>/<draft_id>-v<ts>.<ext>` | public | via `content_drafts` → `has_client_access` |

Public read is deliberate — Instagram Graph API needs public URLs for container creation. Don't store anything here that isn't meant for social posting.

Migration `003_fix_brand_assets_rls.sql` fixes a real bug where `split_part(name, '/', 1)` resolved to `brand_kits.name` (column shadowing) instead of `storage.objects.name`; the fix qualifies the column explicitly.

---

## 5. Inventory (by table)

Every `public` table is RLS-enabled. Current policy counts:

| Table | Policies | Pattern |
|---|---|---|
| ai_edits | 2 | B (via draft) |
| approvals | 1 | D (service role only) |
| brand_assets | 2 | B (via kit) |
| brand_kits | 2 | A |
| client_contacts | 2 | A |
| client_members | 2 | A |
| client_services | 2 | A |
| clients | 2 | A |
| content_drafts | 2 | A |
| contracts | 1 | C (owner writes) |
| creatives | 2 | B (via draft → slide) |
| cycles | 2 | A |
| meetings | 2 | A |
| monthly_reports | 2 | A + owner write |
| notes | 2 | A |
| notifications | 1 | own-only (user_id = auth.uid()) |
| post_metrics | 2 | B (via published_post) |
| profiles | 2 | own-row + owner-all |
| published_posts | 2 | B + owner write |
| scheduled_posts | 2 | B (via draft) |
| services | 2 | read-any + owner write |
| slides | 2 | B (via draft) |
| tasks | 2 | A |
| templates | 2 | A |
| transcripts | 2 | B (via meeting → client) |

---

## 6. Service-role usage audit

As of this writing, the service-role client is used from:

| Call site | Why | Risk if misused |
|---|---|---|
| `/api/cron/cycles` | Cross-client write as the cron runner | Bypasses has_client_access — bearer auth is the only gate |
| `/api/cron/publish` | Same as above, plus cross-client read of drafts/creatives | Same |
| `/api/cron/meta-refresh` | Token refresh — will eventually write back to env | Same |
| `/api/instagram/publish` | Cross-client write triggered by cron | Same |
| `/api/health` | Lightweight DB ping | None — `select id` only |
| `/api/reports/[id]/pdf` | Reads `monthly_reports` — uses normal server client; NOT service-role |
| `src/app/a/[token]/actions.ts` (approveViaTokenAction etc) | Bypass owner-only RLS on `approvals` to write the client's response | Bounded to that token's row via `.eq("token", ...)` |
| `src/app/a/[token]/page.tsx` | Read the approval row publicly | Same bounding |
| `src/app/p/[token]/page.tsx` | Read the client's scoped scheduled/published posts + approvals | Bounded to `portal_token` match |

Adding a new service-role call site requires:
1. A comment on the `createServiceClient` import or call explaining the boundary.
2. Explicit `.eq()` / `.match()` filtering so the query can't accidentally touch other clients.
3. Update this table.

---

## 7. Audit procedure

Monthly (owner):

```sql
-- 1. Every public table has RLS on
select tablename from pg_tables
where schemaname = 'public'
  and not rowsecurity;
-- expect 0 rows
```

```sql
-- 2. Every RLS-enabled table has at least one policy
select t.tablename, coalesce(count(p.policyname), 0) as policy_count
from pg_tables t
left join pg_policies p on p.schemaname = 'public' and p.tablename = t.tablename
where t.schemaname = 'public'
group by t.tablename
having count(p.policyname) = 0;
-- expect 0 rows
```

```sql
-- 3. Policies reference the canonical helpers
select policyname, tablename
from pg_policies
where schemaname = 'public'
  and qual not like '%has_client_access%'
  and qual not like '%is_owner%'
  and qual not like '%auth.uid()%';
-- anything here is worth a second look
```

If a new policy comes up, first try to express it via `has_client_access` or `is_owner`. Raw role checks or ad-hoc joins accumulate and become unmaintainable.

---

## 8. Known gaps

- [ ] Client-role login flow doesn't exist yet — the `client` role is reserved but nothing uses it. When it ships (Sprint 12+), add a helper like `is_client_of(client_id)` and a new pattern for client-only reads.
- [ ] Rate-limiting is in-memory (`src/lib/rate-limit.ts`); RLS alone doesn't prevent abuse by a logged-in staff member. Redis-backed limiter is tracked in deploy gaps.
- [ ] No RLS regression tests — schema changes could silently widen access. Playwright smoke of a cross-client read attempt would cover this; deferred until we have a second staff user in the seed.
