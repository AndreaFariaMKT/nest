import { setRequestLocale, getTranslations } from "next-intl/server";

import { OPTION_LIST_CAP } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import { getCurrentProfile } from "@/lib/auth";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pill } from "@/components/ui/Pill";
import { Link } from "@/i18n/routing";
import { todayIso, studioDayOf } from "@/lib/social";
import { isLate, progressOf } from "@/lib/projects";
import type { ProjectRow } from "@/lib/projects-db";
import type { TaskPriority, TaskStatus } from "@/types/database";

export const dynamic = "force-dynamic";

const priorityTone = {
  low: "muted",
  medium: "default",
  high: "warning",
  urgent: "danger",
} as const;

type MyTask = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_at: string | null;
};

/**
 * "Tarefas e projetos" — the screen the brief describes, and it is three
 * panels rather than three tabs: the reference she sent shows tasks and
 * notifications side by side with projects underneath, all visible at once.
 * Tabs would hide two thirds of it behind a click.
 *
 * Everything here is scoped to the person looking: my tasks, my
 * notifications, the projects I am on. The whole-studio views are one link
 * away — the board at /tasks/board, every engagement at /projects.
 */
export default async function TasksAndProjectsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("tasks");
  const tp = await getTranslations("projects");
  const tn = await getTranslations("notifications");

  const supabase = await createClient();
  const tenantId = await currentTenantId();
  const profile = await getCurrentProfile();
  const today = todayIso();

  // One wave. None of these reads consumes another's result, and the pattern
  // is the one today/page.tsx already uses for the same reason.
  const [taskRows, notificationRows, membershipRows, progressRes] =
    await Promise.all([
      profile
        ? supabase
            .from("tasks")
            .select("id, title, status, priority, due_at")
            .eq("tenant_id", tenantId)
            .eq("assignee_id", profile.id)
            .eq("is_template", false)
            .neq("status", "done")
            .order("due_at", { ascending: true, nullsFirst: false })
            .limit(12)
        : null,
      profile
        ? supabase
            .from("notifications")
            .select("id, title, body, link, read_at, created_at")
            .eq("user_id", profile.id)
            .order("created_at", { ascending: false })
            .limit(8)
        : null,
      profile
        ? supabase
            .from("project_members")
            .select("project_id")
            .eq("user_id", profile.id)
            .eq("tenant_id", tenantId)
            .limit(OPTION_LIST_CAP)
        : null,
      supabase.rpc("project_task_progress", { p_tenant: tenantId }),
    ]);

  const myTasks = (taskRows?.data ?? []) as MyTask[];
  const notifications = (notificationRows?.data ?? []) as Array<{
    id: string;
    title: string;
    body: string | null;
    link: string | null;
    read_at: string | null;
  }>;

  const myProjectIds = ((membershipRows?.data ?? []) as Array<{
    project_id: string;
  }>).map((m) => m.project_id);

  // Only the engagements this person is on. A founder who is on none sees the
  // empty state and the link to all of them, which is honest — the alternative
  // is a "my projects" panel listing projects that are not theirs.
  const { data: projectData } = myProjectIds.length
    ? await supabase
        .from("projects")
        .select("*")
        .eq("tenant_id", tenantId)
        .in("id", myProjectIds)
        .order("name", { ascending: true })
    : { data: [] };

  const myProjects = (projectData ?? []) as ProjectRow[];

  // Grouped in SQL over the whole board — see 055.
  const progressByProject = new Map(
    (progressRes?.data ?? []).map((r) => [r.project_id, r] as const),
  );

  return (
    <div>
      <PageHeader
        title={t("overviewTitle")}
        subtitle={t("overviewSubtitle")}
        action={
          <Link
            href="/tasks/board"
            className="inline-flex h-10 items-center justify-center rounded-md border border-border px-4 text-sm font-medium transition-colors hover:bg-muted"
          >
            {t("openBoard")}
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Tarefas — mine, as the brief says: "tudo atrelado a mim". */}
        <section className="rounded-2xl border border-border bg-card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("myTasks")}
            </h2>
            <Link
              href="/tasks/new"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {t("new")}
            </Link>
          </div>
          {myTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noneMine")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {myTasks.map((task) => (
                <li key={task.id}>
                  <Link
                    href={`/tasks/${task.id}/edit`}
                    className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-brand"
                    data-testid="my-task"
                  >
                    <span className="min-w-0 truncate">{task.title}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      {task.due_at ? (
                        <span className="text-xs text-muted-foreground">
                          {studioDayOf(task.due_at)}
                        </span>
                      ) : null}
                      <Pill tone={priorityTone[task.priority]}>
                        {t(`priority.${task.priority}`)}
                      </Pill>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Notificações — also mine. */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-4 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {tn("title")}
          </h2>
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">{tn("empty")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {notifications.map((n) => (
                <li key={n.id} className="py-2.5">
                  <Link
                    href={(n.link ?? "/tasks") as "/tasks"}
                    className="block text-sm hover:text-brand"
                  >
                    <span className="flex items-center gap-2">
                      {!n.read_at ? (
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand"
                          aria-hidden
                        />
                      ) : null}
                      <span className="min-w-0 truncate">{n.title}</span>
                    </span>
                    {n.body ? (
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {n.body}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Projetos — the ones this person is on. Clicking opens that project's
          own board, which is what "abrir o kanban daquele projeto especifico"
          asks for. */}
      <section className="mt-4 rounded-2xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("myProjects")}
          </h2>
          <Link
            href="/projects"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            {tp("title")}
          </Link>
        </div>
        {myProjects.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noProjects")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {myProjects.map((project) => {
              const progress = progressOf(progressByProject.get(project.id));
              return (
                <li key={project.id}>
                  <Link
                    href={`/projects/${project.id}`}
                    className="flex flex-wrap items-center gap-3 py-3 text-sm hover:text-brand"
                    data-testid="my-project"
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {project.name}
                    </span>
                    <span className="h-1 w-24 overflow-hidden rounded-full bg-muted">
                      <span
                        className="block h-full bg-brand"
                        style={{ width: `${progress.percent}%` }}
                      />
                    </span>
                    <span className="w-28 text-xs text-muted-foreground">
                      {tp("progress", {
                        percent: progress.percent,
                        open: progress.open,
                      })}
                    </span>
                    {isLate(project, today) ? (
                      <Pill tone="danger">{tp("late")}</Pill>
                    ) : (
                      <Pill tone="muted">
                        {tp(`form.statuses.${project.status}`)}
                      </Pill>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
