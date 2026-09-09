import { setRequestLocale, getTranslations } from "next-intl/server";

import { OPTION_LIST_CAP } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pill, toneOf, type Tone } from "@/components/ui/Pill";
import { Link } from "@/i18n/routing";
import { todayIso } from "@/lib/social";
import { isLate, isProjectType, progressOf } from "@/lib/projects";
import type { ProjectRow } from "@/lib/projects-db";

export const dynamic = "force-dynamic";

const statusTone = {
  negotiating: "warning",
  active: "default",
  paused: "muted",
  done: "muted",
  cancelled: "muted",
} as const satisfies Record<string, Tone>;


export default async function ProjectsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  // `?type=` is how /identity-projects and /website-builds now reach this
  // screen. Those two routes read brand_kits and clients and were named after
  // projects before there was a projects table; a filter over the real one is
  // the same list, actually derived from the engagement.
  const rawType = Array.isArray(sp.type) ? sp.type[0] : sp.type;
  const typeFilter = isProjectType(rawType) ? rawType : null;
  const t = await getTranslations("projects");

  const supabase = await createClient();
  const tenantId = await currentTenantId();
  const today = todayIso();

  const [{ data: projectData }, { data: clientData }, { data: progressData }] =
    await Promise.all([
      supabase
        .from("projects")
        .select(
          "id, client_id, name, slug, type, status, starts_on, ends_on, scope, tenant_id, created_at, updated_at",
        )
        .eq("tenant_id", tenantId)
        .order("name", { ascending: true })
        .limit(OPTION_LIST_CAP),
      supabase
        .from("clients")
        .select("id, name")
        .eq("tenant_id", tenantId)
        .limit(OPTION_LIST_CAP),
      // Grouped in SQL over the whole board — see 055. Grouping a 500-row page
      // in TypeScript made a project whose tasks fell outside that page show
      // 0% here and its real figure on its own screen.
      supabase.rpc("project_task_progress", { p_tenant: tenantId }),
    ]);

  const all = (projectData ?? []) as ProjectRow[];
  const projects = typeFilter
    ? all.filter((p) => p.type === typeFilter)
    : all;
  const clientName = new Map(
    (clientData ?? []).map((c) => [c.id, c.name] as const),
  );

  const progressByProject = new Map(
    (progressData ?? []).map((r) => [r.project_id, r] as const),
  );

  // "Projetos clientes / Projetos interno" — the brief's two tabs, as two
  // sections. A null client is the studio's own work, which is the same
  // meaning tasks.client_id already carried.
  const forClients = projects.filter((p) => p.client_id !== null);
  const internal = projects.filter((p) => p.client_id === null);

  function Section({
    title,
    rows,
    empty,
  }: {
    title: string;
    rows: ProjectRow[];
    empty: string;
  }) {
    return (
      <section className="mb-8">
        <h2 className="mb-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {title} · {rows.length}
        </h2>
        {rows.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            {empty}
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((project) => {
              const progress = progressOf(progressByProject.get(project.id));
              const late = isLate(project, today);
              return (
                <li key={project.id}>
                  <Link
                    href={`/projects/${project.id}`}
                    className="block rounded-2xl border border-border bg-card p-4 transition-colors hover:border-brand"
                    data-testid="project-card"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-medium">
                          {project.name}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {project.client_id
                            ? clientName.get(project.client_id) ?? "—"
                            : t("internalLabel")}
                          {" · "}
                          {t(`form.types.${project.type}`)}
                        </div>
                      </div>
                      <Pill tone={toneOf(statusTone, project.status)}>
                        {t(`form.statuses.${project.status}`)}
                      </Pill>
                    </div>

                    <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-brand"
                        style={{ width: `${progress.percent}%` }}
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {t("progress", {
                          percent: progress.percent,
                          open: progress.open,
                        })}
                      </span>
                      {late ? (
                        <span className="text-destructive">{t("late")}</span>
                      ) : null}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    );
  }

  return (
    <div>
      <PageHeader
        title={typeFilter ? t(`form.types.${typeFilter}`) : t("title")}
        subtitle={t("subtitle")}
        action={
          <Link
            href="/projects/new"
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {t("new")}
          </Link>
        }
      />
      <Section
        title={t("clientProjects")}
        rows={forClients}
        empty={t("emptyClients")}
      />
      <Section
        title={t("internalProjects")}
        rows={internal}
        empty={t("emptyInternal")}
      />
    </div>
  );
}
