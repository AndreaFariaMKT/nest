import { setRequestLocale, getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/ui/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import { loadScope } from "../_data";
import { ModuleShell } from "../_components/ModuleShell";
import { MediaForm } from "../_components/MediaForm";
import { MediaList, type MediaRow } from "../_components/MediaList";
import { ModuleNote } from "../_components/Shared";

export const dynamic = "force-dynamic";

export default async function MediaPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("social");
  const scope = await loadScope(searchParams, "media");

  const supabase = await createClient();
  const tenantId = await currentTenantId();
  let query = supabase
    .from("media_assets")
    .select("id, client_id, title, url, access_note, description, captured_on")
    .eq("tenant_id", tenantId)
    .order("captured_on", { ascending: false });
  if (scope.client) query = query.eq("client_id", scope.client.id);

  const { data } = await query;
  const items = (data ?? []) as MediaRow[];
  const canEdit =
    scope.caps.includes("coordinate") || scope.caps.includes("design");

  return (
    <>
      <PageHeader title={t("media.title")} subtitle={t("media.subtitle")} />
      <ModuleShell scope={scope} />

      {canEdit ? (
        <MediaForm
          locale={locale}
          clients={scope.clients.map((c) => ({ id: c.id, name: c.name }))}
          defaultClient={scope.client?.id}
          today={scope.today}
        />
      ) : null}

      <MediaList
        items={items}
        clientName={scope.clientName}
        locale={locale}
        canEdit={scope.caps.includes("coordinate")}
        clients={scope.clients.map((c) => ({ id: c.id, name: c.name }))}
      />

      <ModuleNote>
        {t("media.note")}
      </ModuleNote>
    </>
  );
}
