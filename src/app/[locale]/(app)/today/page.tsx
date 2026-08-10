import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Pill } from "@/components/ui/Pill";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { effectiveRole } from "@/lib/view-as";
import { getViewAs } from "@/lib/view-as-server";
import { formatCentsAsBrl, sumCents } from "@/lib/money";
import type { MeetingStatus, TaskPriority, TaskStatus } from "@/types/database";

type TodayTask = {
  id: string;
  title: string;
  priority: TaskPriority;
  status: TaskStatus;
  due_at: string | null;
};

type TodayMeeting = {
  id: string;
  title: string;
  starts_at: string;
  status: MeetingStatus;
  google_meet_url: string | null;
  client: { name: string } | Array<{ name: string }> | null;
};

const priorityTone = {
  low: "muted",
  medium: "default",
  high: "warning",
  urgent: "danger",
} as const;

function tomorrowUtcMidnight(): string {
  const now = new Date();
  const t = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0),
  );
  return t.toISOString();
}

function dayAfterTomorrowUtcMidnight(): string {
  const now = new Date();
  const t = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 2, 0, 0, 0),
  );
  return t.toISOString();
}

function pickOne<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

export default async function TodayPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("today");

  const profile = await getCurrentProfile();
  const firstName = (profile?.full_name ?? "").split(" ")[0] || "";

  const dateLabel = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  const supabase = await createClient();

  const viewAs = await getViewAs();
  const ownerView = effectiveRole(profile?.role ?? "staff", viewAs) === "owner";
  let activeClients = 0;
  let activeServices = 0;
  let mrrCents = 0;
  if (ownerView) {
    const { count } = await supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("status", "active");
    activeClients = count ?? 0;

    const { count: serviceCount } = await supabase
      .from("client_services")
      .select("client_id", { count: "exact", head: true })
      .is("ended_on", null);
    activeServices = serviceCount ?? 0;

    const today = new Date().toISOString().slice(0, 10);
    const { data: contracts } = await supabase
      .from("contracts")
      .select("monthly_value_cents, starts_on, ends_on")
      .lte("starts_on", today)
      .or(`ends_on.is.null,ends_on.gte.${today}`);
    mrrCents = sumCents((contracts ?? []).map((c) => c.monthly_value_cents));
  }

  // My tasks due today or earlier, still open.
  let tasks: TodayTask[] = [];
  if (profile) {
    const { data } = await supabase
      .from("tasks")
      .select("id, title, priority, status, due_at")
      .eq("assignee_id", profile.id)
      .eq("is_template", false)
      .neq("status", "done")
      .or(`due_at.is.null,due_at.lte.${tomorrowUtcMidnight()}`)
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(10);
    tasks = (data ?? []) as TodayTask[];
  }

  // Meetings starting between now and the end of tomorrow (local-ish window
  // via UTC midnight cutoff — good enough for the Today panel).
  const nowIso = new Date().toISOString();
  const { data: meetingsData } = await supabase
    .from("meetings")
    .select(
      "id, title, starts_at, status, google_meet_url, client:clients(name)",
    )
    .gte("starts_at", nowIso)
    .lt("starts_at", dayAfterTomorrowUtcMidnight())
    .neq("status", "cancelled")
    .order("starts_at", { ascending: true })
    .limit(8);
  const meetings = (meetingsData ?? []) as unknown as TodayMeeting[];

  return (
    <div className="">
      <header className="mb-8">
        <p className="text-sm capitalize text-muted-foreground">{dateLabel}</p>
        <h1 className="mt-1 font-display text-4xl text-foreground">
          {firstName ? t("greeting", { name: firstName }) : t("title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      {ownerView ? (
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
          <Stat label={t("stats.activeClients")} value={String(activeClients)} />
          <Stat
            label={t("stats.activeServices")}
            value={String(activeServices)}
          />
          <Stat
            label={t("stats.monthlyRevenue")}
            value={formatCentsAsBrl(mrrCents)}
          />
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SectionCard title={t("blocks.tasks.title")}>
          {tasks.length === 0 ? (
            <Empty>{t("blocks.tasks.empty")}</Empty>
          ) : (
            <ul className="divide-y divide-border">
              {tasks.map((task) => (
                <li key={task.id} data-testid="today-task">
                  <Link
                    href={`/projects/${task.id}/edit`}
                    className="group flex items-center justify-between gap-2 py-3 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-foreground group-hover:text-brand">
                        {task.title}
                      </span>
                      {task.due_at ? (
                        <span className="text-xs text-muted-foreground">
                          {new Intl.DateTimeFormat(locale, {
                            dateStyle: "short",
                            timeStyle: "short",
                          }).format(new Date(task.due_at))}
                        </span>
                      ) : null}
                    </div>
                    <Pill
                      tone={priorityTone[task.priority]}
                      className="shrink-0 text-[10px]"
                    >
                      {t(`blocks.tasks.priority.${task.priority}`)}
                    </Pill>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title={t("blocks.meetings.title")}>
          {meetings.length === 0 ? (
            <Empty>{t("blocks.meetings.empty")}</Empty>
          ) : (
            <ul className="divide-y divide-border">
              {meetings.map((m) => {
                const client = pickOne(m.client);
                return (
                  <li key={m.id} data-testid="today-meeting">
                    <Link
                      href={`/meetings/${m.id}`}
                      className="group flex items-center gap-3 py-3 text-sm"
                    >
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-soft text-[10px] font-semibold text-brand-soft-foreground">
                        {new Intl.DateTimeFormat(locale, {
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(new Date(m.starts_at))}
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-foreground group-hover:text-brand">
                          {m.title}
                        </span>
                        {client ? (
                          <span className="text-xs text-muted-foreground">
                            {client.name}
                          </span>
                        ) : null}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>

        <SectionCard title={t("blocks.approvals.title")}>
          <Empty>{t("blocks.approvals.hint")}</Empty>
        </SectionCard>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-2xl border border-border bg-card p-5"
      data-testid="today-stat"
    >
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-3 font-display text-3xl leading-none text-foreground">
        {value}
      </div>
    </div>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-2xl border border-border bg-card p-5"
      data-testid="today-block"
    >
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-3 text-sm text-muted-foreground">{children}</p>;
}

export const dynamic = "force-dynamic";
