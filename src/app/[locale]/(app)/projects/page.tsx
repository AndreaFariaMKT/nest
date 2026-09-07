import { setRequestLocale, getTranslations } from "next-intl/server";

import { OPTION_LIST_CAP } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pill } from "@/components/ui/Pill";
import { Link } from "@/i18n/routing";
import { todayIso } from "@/lib/social";
import { isLate, projectProgress } from "@/lib/projects";
import { pending, type ProjectRow } from "@/lib/projects-db";

export const dynamic = "force-dynamic";

const statusTone = {
  negotiating: "warning",
  active: "default",
  paused: "muted",
  done: "muted",
  cancelled: "muted",
} as const;

/**
 * `status` is a CHECK on a text column, so the generated type is `string`
 * rather than the union. Narrowed here so a value the database allows but this
 * screen has no styling for renders plainly instead of crashing the list.
 */
function toneFor(status: string): (typeof statusTone)[keyof typeof statusTone] {
  return status in statusTone
    ? statusTone[status as keyof typeof statusTone]
    : "muted";
}

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("projects");

  const supabase = await createClient();
  const tenantId = await currentTenantId();
  const today = todayIso();

  const [{ data: projectData }, { data: clientData }, { data: taskData }] =
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
      // Statuses only. The bar needs a count of done against total, and
      // pulling whole task rows to compute two integers would be the most
      // expensive way to draw a progress bar on a list.
      supabase
        .from("tasks")
        .select("project_id, status")
        .eq("tenant_id", tenantId)
        .eq("is_template", false)
        .limit(OPTION_LIST_CAP),
    ]);

  const projects = (projectData ?? []) as ProjectRow[];
  const clientName = new Map(
    (clientData ?? []).map((c) => [c.id, c.name] as const),
  );

  const statusesByProject = new Map<string, string[]>();
  for (const row of taskData ?? []) {
    if (!row.project_id) continue;
    const list = statusesByProject.get(row.project_id) ?? [];
    list.push(row.status);
    statusesByProject.set(row.project_id, list);
  }

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
              const progress = projectProgress(
                statusesByProject.get(project.id) ?? [],
              );
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
                      <Pill tone={toneFor(project.status)}>
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
        title={t("title")}
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
