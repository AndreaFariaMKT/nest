import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";

import { OPTION_LIST_CAP } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import { listAssignablePeople } from "@/lib/people";
import { PageHeader } from "@/components/ui/PageHeader";
import { pending, type ProjectRow } from "@/lib/projects-db";
import { ProjectForm } from "../../_components/ProjectForm";
import { updateProjectAction, deleteProjectAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("projects");

  const supabase = await createClient();
  const tenantId = await currentTenantId();

  const [{ data: project }, { data: clientData }, { data: memberData }, people] =
    await Promise.all([
      supabase
        .from("projects")
        .select("*")
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .maybeSingle(),
      supabase
        .from("clients")
        .select("id, name")
        .eq("tenant_id", tenantId)
        .neq("status", "archived")
        .order("name", { ascending: true })
        .limit(OPTION_LIST_CAP),
      supabase
        .from("project_members")
        .select("user_id")
        .eq("project_id", id),
      listAssignablePeople(),
    ]);

  if (!project) notFound();

  const memberIds = ((memberData ?? []) as Array<{ user_id: string }>).map(
    (m) => m.user_id,
  );

  return (
    <div>
      <PageHeader
        title={t("editTitle")}
        subtitle={(project as ProjectRow).name}
      />
      <ProjectForm
        locale={locale}
        initial={project as ProjectRow}
        clients={clientData ?? []}
        people={people}
        memberIds={memberIds}
        action={updateProjectAction}
        submitLabel={t("form.save")}
      />

      {/* Deleting leaves the tasks behind — `on delete set null` on
          tasks.project_id — so this removes the engagement, not the work
          anyone did inside it. */}
      <form action={deleteProjectAction} className="mt-10">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="locale" value={locale} />
        <button
          type="submit"
          className="text-sm text-destructive underline underline-offset-4"
        >
          {t("form.delete")}
        </button>
      </form>
    </div>
  );
}
