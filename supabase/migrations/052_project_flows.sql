-- ============================================================================
-- 052 — the flow a project type runs when it starts.
--
-- "E automaticamente o sistema pode rodar o flow desse projeto, e até atribuir
-- as tarefas a cada pessoa da equipe."
--
-- The design decision that makes this survive contact with a real team: a step
-- names a ROLE, not a person. "designer_identity", not "João". A template that
-- names people is wrong the first time someone is on holiday, changes job or
-- leaves, and it silently assigns work to an ex-employee. Naming the role and
-- resolving it against project_members at the moment the flow runs is the
-- difference between a template that ages and one that does not.
--
-- `tasks.is_template` (004) is a different thing and stays: that is an ad-hoc
-- task someone saved to reuse. This is the standard shape of a kind of work.
-- ============================================================================

create table if not exists public.project_flow_steps (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null default '00000000-0000-0000-0000-0000000000af'
                 references public.tenants (id) on delete cascade,

  -- Same seven values as projects.type. Not a FK because there is no types
  -- table — both are CHECKs against the same list, for the reason 048 gives.
  project_type text not null
                 check (project_type in ('brand', 'visual_identity', 'website',
                                         'launch', 'hub', 'seo', 'social_media')),

  title        text not null,
  description  text,

  -- The role that should own this step, resolved against project_members when
  -- the flow runs. Nullable: some steps belong to whoever is running the
  -- project rather than to a discipline.
  role         text check (role in ('founder', 'manager', 'social',
                                    'designer_social', 'designer_identity',
                                    'developer', 'accountant')),

  -- Business days from the project's start date. Relative, because a template
  -- with absolute dates is a template for one project.
  offset_days  integer not null default 0 check (offset_days >= 0),

  priority     text not null default 'medium'
                 check (priority in ('low', 'medium', 'high', 'urgent')),

  sort         integer not null default 100,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists project_flow_steps_type_idx
  on public.project_flow_steps (tenant_id, project_type, sort);

alter table public.project_flow_steps enable row level security;

drop policy if exists project_flow_steps_staff_all on public.project_flow_steps;
create policy project_flow_steps_staff_all on public.project_flow_steps
  for all to authenticated
  using (not (select public.is_portal_user()))
  with check (not (select public.is_portal_user()));

drop policy if exists tenant_isolation on public.project_flow_steps;
create policy tenant_isolation on public.project_flow_steps
  as restrictive for all to authenticated
  using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

drop policy if exists portal_no_flow_steps on public.project_flow_steps;
create policy portal_no_flow_steps on public.project_flow_steps
  as restrictive for all to authenticated
  using (not (select public.is_portal_user()))
  with check (not (select public.is_portal_user()));

drop trigger if exists project_flow_steps_updated_at on public.project_flow_steps;
create trigger project_flow_steps_updated_at
  before update on public.project_flow_steps
  for each row execute function public.set_updated_at();

-- Records that a project has already had its flow applied, so running it twice
-- does not double the board. A column rather than a table: it is one fact.
alter table public.projects
  add column if not exists flow_applied_at timestamptz;

comment on table public.project_flow_steps is
  'The standard shape of a kind of work. A step names a role, never a person — '
  'a template that names people silently assigns work to whoever has left.';

-- ── Seed: social media, the one flow the studio already runs every fortnight ─

insert into public.project_flow_steps
  (tenant_id, project_type, title, role, offset_days, priority, sort)
values
  ('00000000-0000-0000-0000-0000000000af', 'social_media', 'Levantar pautas do ciclo',        'social',          0,  'high',   10),
  ('00000000-0000-0000-0000-0000000000af', 'social_media', 'Escrever roteiros e legendas',    'social',          2,  'high',   20),
  ('00000000-0000-0000-0000-0000000000af', 'social_media', 'Revisão de texto',                'manager',         4,  'medium', 30),
  ('00000000-0000-0000-0000-0000000000af', 'social_media', 'Produzir as peças',               'designer_social', 5,  'high',   40),
  ('00000000-0000-0000-0000-0000000000af', 'social_media', 'Revisão criativa',                'manager',         8,  'medium', 50),
  ('00000000-0000-0000-0000-0000000000af', 'social_media', 'Enviar para aprovação do cliente','manager',         9,  'high',   60),
  ('00000000-0000-0000-0000-0000000000af', 'social_media', 'Agendar publicações',             'social',          11, 'medium', 70),
  ('00000000-0000-0000-0000-0000000000af', 'visual_identity', 'Briefing e referências',       'designer_identity', 0, 'high',   10),
  ('00000000-0000-0000-0000-0000000000af', 'visual_identity', 'Território visual',            'designer_identity', 5, 'high',   20),
  ('00000000-0000-0000-0000-0000000000af', 'visual_identity', 'Apresentação ao cliente',      'manager',           10,'high',   30),
  ('00000000-0000-0000-0000-0000000000af', 'visual_identity', 'Ajustes e fechamento',         'designer_identity', 15,'medium', 40),
  ('00000000-0000-0000-0000-0000000000af', 'visual_identity', 'Entrega do brand kit',         'designer_identity', 20,'high',   50),
  ('00000000-0000-0000-0000-0000000000af', 'website', 'Arquitetura e wireframe',              'developer',        0,  'high',   10),
  ('00000000-0000-0000-0000-0000000000af', 'website', 'Design das telas',                     'designer_identity',5,  'high',   20),
  ('00000000-0000-0000-0000-0000000000af', 'website', 'Implementação',                        'developer',        12, 'high',   30),
  ('00000000-0000-0000-0000-0000000000af', 'website', 'Revisão de conteúdo e SEO',            'manager',          20, 'medium', 40),
  ('00000000-0000-0000-0000-0000000000af', 'website', 'Publicação',                           'developer',        24, 'high',   50)
on conflict do nothing;
