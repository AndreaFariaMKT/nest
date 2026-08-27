import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";

import { OPTION_LIST_CAP } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pill } from "@/components/ui/Pill";
import type { TaskPriority, TaskStatus } from "@/types/database";

export const dynamic = "force-dynamic";

type Task = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_at: string | null;
  client_id: string | null;
  assignee_id: string | null;
};

const priorityTone = {
  low: "muted",
  medium: "default",
  high: "warning",
  urgent: "danger",
} as const;

export default async function OverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("overview");
  const tt = await getTranslations("tasks");

  const supabase = await createClient();
  const tenantId = await currentTenantId();

  const [{ data: taskData }, { data: clientData }, { data: peopleData }] =
    await Promise.all([
      supabase
        .from("tasks")
        .select("id, title, status, priority, due_at, client_id, assignee_id")
        .eq("tenant_id", tenantId)
        .eq("is_template", false)
        .neq("status", "done")
        .order("due_at", { ascending: true, nullsFirst: false })
        .limit(OPTION_LIST_CAP),
      supabase.from("clients").select("id, name, status").eq("tenant_id", tenantId).limit(OPTION_LIST_CAP),
      supabase.from("profiles").select("id, full_name").limit(OPTION_LIST_CAP),
    ]);

  const tasks = (taskData ?? []) as Task[];
  const clientName = new Map((clientData ?? []).map((c) => [c.id, c.name]));
  const person = new Map((peopleData ?? []).map((p) => [p.id, p.full_name]));
  const activeClients = (clientData ?? []).filter(
    (c) => c.status === "active",
  ).length;
  const inReview = tasks.filter((t) => t.status === "review").length;

  const dateFmt = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
  });

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <section className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Stat label={t("activeClients")} value={String(activeClients)} />
        <Stat label={t("activeTasks")} value={String(tasks.length)} />
        <Stat label={t("inReview")} value={String(inReview)} />
      </section>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <ul className="divide-y divide-border">
          {tasks.map((task) => (
            <li key={task.id}>
              <Link
                href={`/projects/${task.id}/edit`}
                className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted/40"
              >
                <span className="min-w-0 flex-1 truncate text-foreground">
                  {task.title}
                </span>
                <span className="hidden w-40 truncate text-muted-foreground sm:block">
                  {task.client_id
                    ? clientName.get(task.client_id) ?? "—"
                    : tt("fields.internal")}
                </span>
                <span className="hidden w-32 truncate text-muted-foreground md:block">
                  {task.assignee_id
                    ? person.get(task.assignee_id) ?? "—"
                    : tt("fields.unassigned")}
                </span>
                <span className="w-20 text-right text-muted-foreground">
                  {task.due_at ? dateFmt.format(new Date(task.due_at)) : "—"}
                </span>
                {/* Colour and text described different fields: the tone came
                    from priority while the label read the status, so an urgent
                    task in review showed red and said "Review". Two pills, each
                    saying what its own colour means. */}
                <Pill tone={priorityTone[task.priority]} className="text-[10px]">
                  {tt(`priority.${task.priority}`)}
                </Pill>
                <Pill tone="muted" className="text-[10px]">
                  {tt(`status.${task.status}`)}
                </Pill>
              </Link>
            </li>
          ))}
          {tasks.length === 0 && (
            <li className="px-4 py-10 text-center text-sm text-muted-foreground">
              {t("noWork")}
            </li>
          )}
        </ul>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-3 font-display text-3xl leading-none text-foreground">
        {value}
      </div>
    </div>
  );
}
