import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";

import { OPTION_LIST_CAP } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

type Draft = {
  id: string;
  title: string;
  pillar: string | null;
  status: string;
  client_id: string;
};

const BUCKETS: { key: string; statuses: string[] }[] = [
  { key: "drafting", statuses: ["draft", "text_review", "creative_review"] },
  { key: "review", statuses: ["client_review"] },
  { key: "approved", statuses: ["approved", "scheduled"] },
  { key: "published", statuses: ["published"] },
];

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

  const drafts = (draftData ?? []) as Draft[];
  const clientName = new Map((clientData ?? []).map((c) => [c.id, c.name]));

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      {drafts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card px-8 py-16 text-center text-sm text-muted-foreground">
          {t("empty")}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {BUCKETS.map((bucket) => {
            const items = drafts.filter((d) => bucket.statuses.includes(d.status));
            return (
              <div key={bucket.key} className="rounded-2xl border border-border bg-card p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t(`buckets.${bucket.key}`)}
                  </h2>
                  <span className="text-xs text-muted-foreground">{items.length}</span>
                </div>
                <ul className="space-y-2">
                  {items.map((d) => (
                    <li key={d.id}>
                      <Link
                        href={`/content-engine/drafts/${d.id}/edit`}
                        className="block rounded-xl border border-border bg-background/60 p-3 text-sm hover:border-brand/40"
                      >
                        <span className="block truncate font-medium text-foreground">
                          {d.title}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {clientName.get(d.client_id) ?? "—"}
                          {d.pillar ? ` · ${d.pillar}` : ""}
                        </span>
                      </Link>
                    </li>
                  ))}
                  {items.length === 0 && (
                    <li className="py-2 text-center text-xs text-muted-foreground">—</li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
