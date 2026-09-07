import { setRequestLocale, getTranslations } from "next-intl/server";

import { OPTION_LIST_CAP } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import { listAssignablePeople } from "@/lib/people";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProjectForm } from "../_components/ProjectForm";
import { createProjectAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewProjectPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("projects");

  const supabase = await createClient();
  const tenantId = await currentTenantId();

  const [{ data: clientData }, people] = await Promise.all([
    supabase
      .from("clients")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .neq("status", "archived")
      .order("name", { ascending: true })
      .limit(OPTION_LIST_CAP),
    listAssignablePeople(),
  ]);

  return (
    <div>
      <PageHeader title={t("newTitle")} subtitle={t("newSubtitle")} />
      <ProjectForm
        locale={locale}
        clients={clientData ?? []}
        people={people}
        memberIds={[]}
        action={createProjectAction}
        submitLabel={t("form.create")}
      />
    </div>
  );
}
