import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";

import { OPTION_LIST_CAP } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import { listAssignablePeople } from "@/lib/people";
import { Pill } from "@/components/ui/Pill";
import { Link } from "@/i18n/routing";
import { todayIso } from "@/lib/social";
import { isLate, projectProgress } from "@/lib/projects";
import { pending, type ProjectRow } from "@/lib/projects-db";
import {
  KanbanBoard,
  type KanbanTask,
} from "../../tasks/_components/KanbanBoard";

export const dynamic = "force-dynamic";

type Joined = {
  id: string;
  title: string;
  status: KanbanTask["status"];
  priority: KanbanTask["priority"];
  due_at: string | null;
  assignee:
    | { full_name: string | null; email: string }
    | Array<{ full_name: string | null; email: string }>
    | null;
};

function pickOne<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("projects");

  const supabase = await createClient();
  const tenantId = await currentTenantId();

  const [{ data: projectData }, { data: taskData }, people] = await Promise.all([
    pending(supabase)
      .from("projects")
      .select("*")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    supabase
      .from("tasks")
      .select(
        "id, title, status, priority, due_at, assignee:profiles!tasks_assignee_id_fkey(full_name, email)",
      )
      .eq("tenant_id", tenantId)
      // `project_id` arrives with 048; until it is applied the generated types
      // do not know the column. Remove the cast with @/lib/projects-db.
      .eq("project_id" as "client_id", id)
      .eq("is_template", false)
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(OPTION_LIST_CAP),
    listAssignablePeople(),
  ]);

  if (!projectData) notFound();
  const project = projectData as ProjectRow;

  let clientName: string | null = null;
  if (project.client_id) {
    const { data } = await supabase
      .from("clients")
      .select("name")
      .eq("id", project.client_id)
      .maybeSingle();
    clientName = data?.name ?? null;
  }

  const tasks: KanbanTask[] = ((taskData ?? []) as unknown as Joined[]).map(
    (r) => {
      const assignee = pickOne(r.assignee);
      return {
        id: r.id,
        title: r.title,
        status: r.status,
        priority: r.priority,
        due_at: r.due_at,
        // The board is already inside one project, so repeating the client on
        // every card would say the same thing thirty times.
        client_name: null,
        assignee_label: assignee ? assignee.full_name ?? assignee.email : null,
      };
    },
  );

  const progress = projectProgress(tasks.map((task) => task.status));
  const late = isLate(project, todayIso());

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">
              {clientName ?? t("internalLabel")} · {t(`form.types.${project.type}`)}
            </p>
            <h1
              className="mt-1 text-balance font-display text-3xl leading-[1.1] tracking-[-0.015em] text-foreground md:text-4xl"
              style={{ fontVariationSettings: '"SOFT" 20, "WONK" 1' }}
            >
              {project.name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Pill tone={project.status === "active" ? "default" : "muted"}>
                {t(`form.statuses.${project.status}`)}
              </Pill>
              {project.starts_on || project.ends_on ? (
                <span>
                  {project.starts_on ?? "—"} → {project.ends_on ?? "—"}
                </span>
              ) : null}
              {late ? (
                <span className="text-destructive">{t("late")}</span>
              ) : null}
            </div>
          </div>
          <Link
            href={`/projects/${project.id}/edit`}
            className="inline-flex h-10 items-center justify-center rounded-md border border-border px-4 text-sm font-medium transition-colors hover:bg-muted"
          >
            {t("form.edit")}
          </Link>
        </div>

        <div className="mt-5 max-w-md">
          <div className="h-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-brand"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("progress", {
              percent: progress.percent,
              open: progress.open,
            })}
          </p>
        </div>

        {project.scope ? (
          <section className="mt-6 max-w-2xl rounded-2xl border border-border bg-card p-4">
            <h2 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("form.scope")}
            </h2>
            <p className="whitespace-pre-wrap text-sm text-foreground">
              {project.scope}
            </p>
          </section>
        ) : null}
      </header>

      <KanbanBoard
        locale={locale}
        tasks={tasks}
        clients={[]}
        assignees={people}
        currentClient=""
        currentAssignee=""
        showFilters={false}
        newTaskHref={`/tasks/new?project=${project.id}`}
      />
    </div>
  );
}
