import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Pill } from "@/components/ui/Pill";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type Task = Database["public"]["Tables"]["tasks"]["Row"];

const statusTone = {
  todo: "muted",
  in_progress: "default",
  blocked: "danger",
  review: "warning",
  done: "success",
} as const;

const priorityTone = {
  low: "muted",
  medium: "default",
  high: "warning",
  urgent: "danger",
} as const;

type Row = Task & {
  client: { slug: string; name: string } | Array<{ slug: string; name: string }> | null;
  assignee:
    | { full_name: string | null; email: string }
    | Array<{ full_name: string | null; email: string }>
    | null;
};

function pickOne<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("tasks");

  const supabase = await createClient();
  const { data } = await supabase
    .from("tasks")
    .select(
      "*, client:clients(slug, name), assignee:profiles!tasks_assignee_id_fkey(full_name, email)",
    )
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  const rows = ((data ?? []) as unknown as Row[]).map((r) => ({
    ...r,
    client: pickOne(r.client),
    assignee: pickOne(r.assignee),
  }));

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-foreground">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Link
          href="/projects/new"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {t("new")}
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card px-8 py-16 text-center text-sm text-muted-foreground">
          {t("empty")}
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((task) => (
            <Link
              key={task.id}
              href={`/projects/${task.id}/edit`}
              className="block rounded-lg border border-border bg-card p-4 transition-colors hover:border-foreground/20 hover:bg-accent/30"
              data-testid="task-row"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-medium text-foreground truncate">
                    {task.title}
                  </h2>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    {task.client ? <span>{task.client.name}</span> : (
                      <span>{t("fields.internal")}</span>
                    )}
                    {task.assignee ? (
                      <>
                        <span>·</span>
                        <span>
                          {task.assignee.full_name ?? task.assignee.email}
                        </span>
                      </>
                    ) : null}
                    {task.due_at ? (
                      <>
                        <span>·</span>
                        <span>
                          {new Intl.DateTimeFormat(locale, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          }).format(new Date(task.due_at))}
                        </span>
                      </>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Pill tone={statusTone[task.status]}>
                    {t(`status.${task.status}`)}
                  </Pill>
                  <Pill
                    tone={priorityTone[task.priority]}
                    className="text-[10px]"
                  >
                    {t(`priority.${task.priority}`)}
                  </Pill>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export const dynamic = "force-dynamic";
