import { setRequestLocale, getTranslations } from "next-intl/server";

import { OPTION_LIST_CAP } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import { PageHeader } from "@/components/ui/PageHeader";
import { Board, type BoardDraft } from "./Board";

export const dynamic = "force-dynamic";



export default async function ContentCalendarPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("contentCalendar");

  const supabase = await createClient();
  const tenantId = await currentTenantId();

  const [{ data: draftData }, { data: clientData }] = await Promise.all([
    supabase
      .from("content_drafts")
      .select("id, title, pillar, status, client_id")
      .eq("tenant_id", tenantId)
      // Content-engine drafts only. `status` carries two state machines —
      // migration 026 added `engine` for exactly this — so without the filter
      // this screen listed social pieces too and sent them to the content
      // editor, around the eleven-stage pipeline and every guard in it.
      .eq("engine", "content")
      .neq("status", "archived")
      // Bucketed into columns below, so this cannot be paged either — a page
      // boundary would empty whichever columns fell after it.
      .order("updated_at", { ascending: false })
      .limit(OPTION_LIST_CAP),
    supabase.from("clients").select("id, name").eq("tenant_id", tenantId).limit(OPTION_LIST_CAP),
  ]);

  const drafts = (draftData ?? []) as BoardDraft[];
  const clientName = new Map((clientData ?? []).map((c) => [c.id, c.name]));

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      {drafts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card px-8 py-16 text-center text-sm text-muted-foreground">
          {t("empty")}
        </div>
      ) : (
        <Board
          drafts={drafts}
          clientNames={Object.fromEntries(clientName)}
          locale={locale}
        />
      )}
    </>
  );
}
