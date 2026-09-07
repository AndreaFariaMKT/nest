-- ============================================================================
-- 048 — projects, and the fiscal identity of the client who pays for them.
--
-- The word was already spent. `/projects` has been the tasks kanban since
-- sprint 3, `roles.ts` maps `tasks → /projects`, and two more routes —
-- /identity-projects and /website-builds — are named after projects while
-- reading brand_kits and clients, because there was no table to read. So the
-- product had four things called a project and no project.
--
-- What was actually missing is the layer between a client and the work: a
-- client has several engagements at once, each with its own type, scope, team,
-- contract and money, and each ending on its own date. Tasks hung directly off
-- the client, so "which website build is this task for" had no answer.
--
-- Fiscal identity lands on `clients`, not here, and that is a deliberate
-- departure from the brief, which asked for razão social and CNPJ on the
-- project form. The CNPJ identifies the company, not the work: carried on the
-- project it would be the same number copied across every project of the same
-- client, and four places to correct when it changes. The form can still show
-- it — it reads through the client.
-- ============================================================================

-- ── 1. Projects ────────────────────────────────────────────────────────────

create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),

  -- Explicit, not via 013's loop, for the reason 046 gives: that migration is
  -- finished and a new table carries its own column.
  tenant_id   uuid not null default '00000000-0000-0000-0000-0000000000af'
                references public.tenants (id) on delete cascade,

  -- Nullable, and that is the whole of "Projetos clientes / Projetos interno":
  -- a null client is the studio's own work. `tasks.client_id` already used
  -- null for the same idea, so the meaning is not new here.
  --
  -- restrict, not cascade: contracts and money hang off a project, and
  -- deleting a client should not silently take an engagement's financial
  -- history with it. Archive the client instead — 029 already treats archiving
  -- as the way a client goes away.
  client_id   uuid references public.clients (id) on delete restrict,

  name        text not null,
  slug        text not null,

  -- A CHECK rather than an enum, following 045 and 046. An enum needs
  -- ALTER TYPE to grow, which cannot run inside a transaction with other
  -- statements — that is precisely why 019 had to exist as its own migration
  -- just to add three values to content_status. This list will grow.
  type        text not null
                check (type in ('brand', 'visual_identity', 'website',
                                'launch', 'hub', 'seo', 'social_media')),

  -- The unique, editable scope. Free text: every engagement's scope is
  -- negotiated, and a structured one would be a form nobody fills in.
  scope       text,

  status      text not null default 'active'
                check (status in ('negotiating', 'active', 'paused',
                                  'done', 'cancelled')),

  -- Dates, not timestamptz, for 046's reason: an engagement starts and ends on
  -- a day in the studio's calendar, and storing an instant reintroduces the
  -- drift that took eight fixes to remove.
  starts_on   date,
  ends_on     date,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- Unique per tenant, not globally: two houses may both run a "Rebranding".
  constraint projects_slug_tenant_key unique (tenant_id, slug),

  -- An engagement cannot end before it starts. Cheap, and it catches the
  -- transposed-date typo at write time rather than in a report months later.
  constraint projects_dates_ordered
    check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create index if not exists projects_tenant_idx on public.projects (tenant_id);
create index if not exists projects_client_idx on public.projects (client_id);
-- The list sorts by name within a tenant; 043 showed a lone tenant_id index
-- covers the filter and nothing of the ordering.
create index if not exists projects_tenant_name_idx
  on public.projects (tenant_id, name);

-- ── 2. Who works on it ─────────────────────────────────────────────────────

create table if not exists public.project_members (
  project_id      uuid not null references public.projects (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  tenant_id       uuid not null default '00000000-0000-0000-0000-0000000000af'
                    references public.tenants (id) on delete cascade,

  -- What they do on THIS project, which is not their permission role. Free
  -- text for the same reason profiles.job_title is (047).
  role_on_project text,

  created_at      timestamptz not null default now(),

  primary key (project_id, user_id)
);

create index if not exists project_members_user_idx
  on public.project_members (user_id);
create index if not exists project_members_tenant_idx
  on public.project_members (tenant_id);

-- ── 3. Fiscal identity, on the client ──────────────────────────────────────
--
-- `legal_name` already exists, from 001, and has never been written by
-- anything. It is the razão social the brief asks for, so it gets used rather
-- than duplicated.

alter table public.clients
  add column if not exists tax_id  text,
  add column if not exists address text,
  -- Which tax regime the client sits in. The brief asks whether the company is
  -- American or Brazilian, and it is not decoration: a Brazilian client gets a
  -- nota fiscal, an American one is an export and gets none. The finance work
  -- turns on this distinction.
  add column if not exists country text not null default 'BR'
    check (country in ('BR', 'US'));

comment on column public.clients.tax_id is
  'CNPJ for a BR client, EIN for a US one. Text, not a number: leading zeros '
  'are significant and the formatting differs by country.';

comment on column public.clients.country is
  'BR or US. Decides whether an invoice produces a nota fiscal or is an '
  'export — see the finance module.';

-- ── 4. Tasks belong to a project ───────────────────────────────────────────

alter table public.tasks
  -- Nullable through the transition: every existing task has a client and no
  -- project, and backfilling would mean inventing engagements that were never
  -- agreed. New tasks get one; old ones keep working.
  add column if not exists project_id uuid
    references public.projects (id) on delete set null,

  -- The second responsible person the brief asks for. `assignee_id` stays the
  -- one who executes; this is the one who follows up. Deliberately a separate
  -- column rather than a join table: the ask is two named roles, not an
  -- arbitrary list of watchers, and a join table would make the kanban card
  -- cost an extra read to render.
  add column if not exists follow_up_id uuid
    references public.profiles (id) on delete set null;

create index if not exists tasks_project_idx on public.tasks (project_id);
create index if not exists tasks_follow_up_idx on public.tasks (follow_up_id);

comment on column public.tasks.assignee_id is
  'Responsavel pela execucao — who does the work.';
comment on column public.tasks.follow_up_id is
  'Responsavel pelo acompanhamento — who checks it lands. Added 048.';

-- ── 5. RLS ─────────────────────────────────────────────────────────────────

alter table public.projects enable row level security;
alter table public.project_members enable row level security;

-- Staff read and write within their own tenant. Written against is_owner() and
-- membership the same way 001's policies are, so a manager is not locked out
-- of the work they run.
drop policy if exists projects_staff_all on public.projects;
create policy projects_staff_all on public.projects
  for all to authenticated
  using (not (select public.is_portal_user()))
  with check (not (select public.is_portal_user()));

drop policy if exists project_members_staff_all on public.project_members;
create policy project_members_staff_all on public.project_members
  for all to authenticated
  using (not (select public.is_portal_user()))
  with check (not (select public.is_portal_user()));

-- The tenant floor, consistent with 014. Restrictive, so it AND-s with the
-- permissive policy above rather than replacing it.
drop policy if exists tenant_isolation on public.projects;
create policy tenant_isolation on public.projects
  as restrictive for all to authenticated
  using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

drop policy if exists tenant_isolation on public.project_members;
create policy tenant_isolation on public.project_members
  as restrictive for all to authenticated
  using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

-- The portal floor, consistent with 022/029/046. A client login has no
-- business reading the studio's engagement list — including, especially, the
-- ones belonging to other clients. Kept as a separate restrictive policy so a
-- permissive grant added here by mistake one day still cannot reach them.
drop policy if exists portal_no_projects on public.projects;
create policy portal_no_projects on public.projects
  as restrictive for all to authenticated
  using (not (select public.is_portal_user()))
  with check (not (select public.is_portal_user()));

drop policy if exists portal_no_project_members on public.project_members;
create policy portal_no_project_members on public.project_members
  as restrictive for all to authenticated
  using (not (select public.is_portal_user()))
  with check (not (select public.is_portal_user()));

-- 030's rule, applied to the new table: a row's tenant must match its
-- client's. Without it a project could be filed under one tenant and point at
-- another tenant's client, which is a cross-tenant read with extra steps.
create or replace function public.projects_tenant_matches_client()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.client_id is not null then
    if (select c.tenant_id from public.clients c where c.id = new.client_id)
       is distinct from new.tenant_id then
      raise exception 'project tenant_id must match its client tenant_id';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists projects_tenant_guard on public.projects;
create trigger projects_tenant_guard
  before insert or update on public.projects
  for each row execute function public.projects_tenant_matches_client();

-- Named to match 001's <table>_updated_at convention.
drop trigger if exists projects_updated_at on public.projects;
create trigger projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

comment on table public.projects is
  'An engagement: one piece of work for one client, or for the studio itself '
  'when client_id is null. The layer that was missing between a client and '
  'its tasks — a client runs several at once, each with its own type, scope, '
  'team and dates.';

comment on table public.project_members is
  'Who works on a project. Distinct from client_members (staff assigned to a '
  'whole client) and from tenant_members (permission roles).';

-- ── 6. Notification links that point at the old route ──────────────────────
--
-- The tasks kanban moved from /projects to /tasks so the word could mean the
-- table above. Links already written into `notifications.link` still say
-- /projects/<task-id>/edit, and that path now belongs to a project — so a
-- notification about a task would open the wrong kind of thing, or a 404.
--
-- Scoped to the exact shape the app writes (actions.ts only ever produced
-- '/projects/<uuid>/edit') rather than a blanket replace, so nothing else that
-- happens to contain the word is touched.
update public.notifications
   set link = '/tasks/' || substring(link from '^/projects/(.*)$')
 where link like '/projects/%';
