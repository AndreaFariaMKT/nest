import { setRequestLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import type { Database } from "@/types/database";
import {
  KanbanBoard,
  type FilterOption,
  type KanbanTask,
} from "./_components/KanbanBoard";

type Task = Database["public"]["Tables"]["tasks"]["Row"];

type Joined = Task & {
  client:
    | { name: string }
    | Array<{ name: string }>
    | null;
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
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("tasks");

  const currentClient = (
    Array.isArray(sp.client) ? sp.client[0] : sp.client
  ) ?? "";
  const currentAssignee = (
    Array.isArray(sp.assignee) ? sp.assignee[0] : sp.assignee
  ) ?? "";
  const templatesParam = Array.isArray(sp.templates)
    ? sp.templates[0]
    : sp.templates;
  const showingTemplates = templatesParam === "1";

  const supabase = await createClient();
  const tenantId = await currentTenantId();

  let query = supabase
    .from("tasks")
    .select(
      "*, client:clients(name), assignee:profiles!tasks_assignee_id_fkey(full_name, email)",
    )
    .eq("tenant_id", tenantId)
    .eq("is_template", showingTemplates)
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (currentClient) query = query.eq("client_id", currentClient);
  if (currentAssignee) query = query.eq("assignee_id", currentAssignee);

  const { data } = await query;
  const tasks: KanbanTask[] = ((data ?? []) as unknown as Joined[]).map((r) => {
    const client = pickOne(r.client);
    const assignee = pickOne(r.assignee);
    return {
      id: r.id,
      title: r.title,
      status: r.status,
      priority: r.priority,
      due_at: r.due_at,
      client_name: client?.name ?? null,
      assignee_label: assignee
        ? assignee.full_name ?? assignee.email
        : null,
    };
  });

  const { data: clientsData } = await supabase
    .from("clients")
    .select("id, name, status")
    .eq("tenant_id", tenantId)
    .neq("status", "archived")
    .order("name", { ascending: true });
  const clients: FilterOption[] = (clientsData ?? []).map((c) => ({
    id: c.id,
    label: c.name,
  }));

  const { data: profilesData } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .order("full_name", { ascending: true });
  const assignees: FilterOption[] = (profilesData ?? []).map((p) => ({
    id: p.id,
    label: p.full_name ?? p.email,
  }));

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-foreground">
            {showingTemplates ? t("templatesTitle") : t("title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {showingTemplates ? t("templatesSubtitle") : t("subtitle")}
          </p>
        </div>
        <a
          href={showingTemplates ? "/en/projects" : "/en/projects?templates=1"}
          className="inline-flex h-10 items-center rounded-md border border-input bg-background px-3 text-sm text-muted-foreground hover:bg-muted"
        >
          {showingTemplates ? t("backToKanban") : t("manageTemplates")}
        </a>
      </div>
      <KanbanBoard
        locale={locale}
        tasks={tasks}
        clients={clients}
        assignees={assignees}
        currentClient={currentClient}
        currentAssignee={currentAssignee}
      />
    </div>
  );
}

export const dynamic = "force-dynamic";
