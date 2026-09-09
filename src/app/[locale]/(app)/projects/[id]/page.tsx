import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";

import { OPTION_LIST_CAP } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import { listAssignablePeople } from "@/lib/people";
import { getCurrentRole } from "@/lib/roles-server";
import { Pill } from "@/components/ui/Pill";
import { formatCents } from "@/lib/money";
import { Link } from "@/i18n/routing";
import { todayIso } from "@/lib/social";
import { isLate, projectProgress, summariseCosts } from "@/lib/projects";
import {
  type ProjectRow,
} from "@/lib/projects-db";
import { planFlow, type FlowStep } from "@/lib/project-flow";
import {
  applyProjectFlowAction,
  addProjectCostAction,
  deleteProjectCostAction,
} from "../actions";
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
  // Together, not one after the other: neither consumes the other's result.
  const [tenantId, role] = await Promise.all([
    currentTenantId(),
    getCurrentRole(),
  ]);

  // Who may see what an engagement is worth and what it costs to deliver.
  // Everyone internal reads the project; the money on it is narrower.
  const seesMoney =
    role === "founder" || role === "manager" || role === "accountant";

  const [
    { data: projectData },
    { data: taskData },
    people,
    { data: costData },
    { data: supplierData },
  ] = await Promise.all([
    supabase
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
      .eq("project_id", id)
      .eq("is_template", false)
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(OPTION_LIST_CAP),
    listAssignablePeople(),
    // These depend on the route param and the tenant, not on the project row,
    // so they belong in this wave rather than in one of their own.
    seesMoney
      ? supabase
          .from("project_costs")
          .select("id, description, amount_cents, percent_passed, supplier_id")
          .eq("project_id", id)
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: true })
      : { data: [] },
    seesMoney
      ? supabase
          .from("fin_suppliers")
          .select("id, name")
          .eq("tenant_id", tenantId)
          .order("name", { ascending: true })
      : { data: [] },
  ]);

  if (!projectData) notFound();
  const project = projectData as unknown as ProjectRow;

  // Both of these need the project row, so they cannot join the wave above —
  // but they do not need each other.
  const [clientRes, stepRes] = await Promise.all([
    project.client_id
      ? supabase
          .from("clients")
          .select("name")
          .eq("id", project.client_id)
          .eq("tenant_id", tenantId)
          .maybeSingle()
      : null,
    supabase
      .from("project_flow_steps")
      .select("id, title, description, role, offset_days, priority, sort")
      .eq("tenant_id", tenantId)
      .eq("project_type", project.type),
  ]);
  const clientName = clientRes?.data?.name ?? null;

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

  // What the flow would create, computed but not written. Showing the plan
  // before the button rather than after it is the difference between a feature
  // people try and one they avoid.
  const costs = costData ?? [];
  const suppliers = supplierData ?? [];
  const supplierName = new Map(suppliers.map((x) => [x.id, x.name] as const));
  const costSummary = summariseCosts(costs, project.service_value_cents);

  const steps = (stepRes.data ?? []) as FlowStep[];
  const flowPreview =
    steps.length > 0 && !project.flow_applied_at
      ? planFlow(steps, project.starts_on ?? todayIso(), [], [])
      : [];

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

      {/* What it costs to deliver. project_costs is founder-and-accountant at
          the RLS layer (050), so a designer's query would return nothing
          anyway — this keeps the section itself off their screen rather than
          showing them an empty panel that reads like a bug. */}
      {seesMoney ? (
      <section className="mb-5 rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-4 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {t("costs.title")}
        </h2>

        {project.service_value_cents !== null ? (
          <dl className="mb-4 grid gap-3 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">{t("costs.value")}</dt>
              <dd className="mt-1 font-display text-xl">
                {formatCents(project.service_value_cents, project.currency)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t("costs.total")}</dt>
              <dd className="mt-1 font-display text-xl">
                {formatCents(costSummary.total_cents, project.currency)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t("costs.margin")}</dt>
              <dd
                className={`mt-1 font-display text-xl ${
                  (costSummary.margin_cents ?? 0) < 0 ? "text-destructive" : ""
                }`}
              >
                {costSummary.margin_cents === null
                  ? "—"
                  : `${formatCents(costSummary.margin_cents, project.currency)} · ${costSummary.margin_percent}%`}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="mb-4 text-sm text-muted-foreground">
            {t("costs.noValue")}
          </p>
        )}

        {costSummary.unresolved > 0 ? (
          <p className="mb-4 text-xs text-amber-700 dark:text-amber-400">
            {t("costs.unresolved", { count: costSummary.unresolved })}
          </p>
        ) : null}

        {costs.length > 0 ? (
          <ul className="mb-4 divide-y divide-border">
            {costs.map((cost) => (
              <li
                key={cost.id}
                className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm"
                data-testid="project-cost"
              >
                <span className="min-w-0">
                  <span className="block truncate">{cost.description}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {cost.supplier_id
                      ? supplierName.get(cost.supplier_id) ?? t("costs.noSupplier")
                      : t("costs.noSupplier")}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="tabular-nums">
                    {cost.amount_cents !== null
                      ? formatCents(cost.amount_cents, project.currency)
                      : `${cost.percent_passed}%`}
                  </span>
                  <form action={deleteProjectCostAction}>
                    <input type="hidden" name="id" value={cost.id} />
                    <input type="hidden" name="project_id" value={project.id} />
                    <input type="hidden" name="locale" value={locale} />
                    <button
                      type="submit"
                      className="text-xs text-muted-foreground underline underline-offset-4 hover:text-destructive"
                    >
                      {t("costs.remove")}
                    </button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        {/* One basis or the other, never both — 050's CHECK says the same
            thing, and a row with both makes the total unanswerable. */}
        <form
          action={addProjectCostAction}
          className="flex flex-wrap items-end gap-2"
        >
          <input type="hidden" name="project_id" value={project.id} />
          <input type="hidden" name="locale" value={locale} />
          <label className="text-xs text-muted-foreground">
            {t("costs.description")}
            <input
              name="description"
              required
              maxLength={140}
              className="mt-1 block h-9 rounded-md border border-input bg-background px-2 text-sm"
            />
          </label>
          <label className="text-xs text-muted-foreground">
            {t("costs.supplier")}
            <select
              name="supplier_id"
              className="mt-1 block h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">—</option>
              {suppliers.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted-foreground">
            {t("costs.amount")}
            <input
              name="amount"
              inputMode="decimal"
              placeholder="0,00"
              className="mt-1 block h-9 w-28 rounded-md border border-input bg-background px-2 text-sm"
            />
          </label>
          <label className="text-xs text-muted-foreground">
            {t("costs.percent")}
            <input
              name="percent_passed"
              type="number"
              min={1}
              max={100}
              className="mt-1 block h-9 w-24 rounded-md border border-input bg-background px-2 text-sm"
            />
          </label>
          <button
            type="submit"
            className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {t("costs.add")}
          </button>
        </form>
        <p className="mt-2 text-xs text-muted-foreground">{t("costs.hint")}</p>
      </section>
      ) : null}

      {flowPreview.length > 0 ? (
        <section className="mb-5 rounded-2xl border border-brand/25 bg-brand-soft/30 p-5">
          <h2 className="mb-1 text-[11px] font-medium uppercase tracking-wide text-brand-soft-foreground">
            {t("flow.title")}
          </h2>
          <p className="mb-3 text-sm text-muted-foreground">
            {t("flow.hint", { count: flowPreview.length })}
          </p>
          <ol className="mb-4 space-y-1 text-sm">
            {flowPreview.map((step, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span className="min-w-0 truncate">{step.title}</span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {step.due_on}
                </span>
              </li>
            ))}
          </ol>
          <form action={applyProjectFlowAction}>
            <input type="hidden" name="id" value={project.id} />
            <input type="hidden" name="locale" value={locale} />
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {t("flow.apply")}
            </button>
          </form>
        </section>
      ) : null}

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
