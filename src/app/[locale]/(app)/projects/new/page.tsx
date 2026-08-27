import { listAssignablePeople } from "@/lib/people";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { OPTION_LIST_CAP } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import { TaskForm, type AssigneeChoice, type ClientChoice } from "../_components/TaskForm";
import { createTaskAction } from "../actions";

export default async function NewTaskPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("tasks");

  const supabase = await createClient();
  const tenantId = await currentTenantId();
  const { data: clientsData } = await supabase
    .from("clients")
    .select("id, name, status")
    .eq("tenant_id", tenantId)
    .neq("status", "archived")
    .order("name", { ascending: true })
    .limit(OPTION_LIST_CAP);
  const clients: ClientChoice[] = (clientsData ?? []).map((c) => ({
    id: c.id,
    name: c.name,
  }));

  // Not `profiles`: that table's `role` column is the legacy enum the
  // app never writes, so filtering on it matched everyone and not
  // filtering matched every tenant. See listAssignablePeople.
  const assignees: AssigneeChoice[] = await listAssignablePeople();

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8">
        <Link
          href="/projects"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← {t("title")}
        </Link>
        <h1 className="mt-2 font-display text-4xl text-foreground">
          {t("newTitle")}
        </h1>
      </div>
      <TaskForm
        locale={locale}
        clients={clients}
        assignees={assignees}
        action={createTaskAction}
        submitLabel={t("createSubmit")}
      />
    </div>
  );
}
