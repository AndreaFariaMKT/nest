import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
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
    .order("name", { ascending: true });
  const clients: ClientChoice[] = (clientsData ?? []).map((c) => ({
    id: c.id,
    name: c.name,
  }));

  const { data: profilesData } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .order("full_name", { ascending: true });
  const assignees: AssigneeChoice[] = (profilesData ?? []).map((p) => ({
    id: p.id,
    label: p.full_name ?? p.email,
  }));

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
