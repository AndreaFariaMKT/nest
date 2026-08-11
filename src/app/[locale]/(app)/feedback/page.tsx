import { setRequestLocale, getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  approved_at: string | null;
  rejected_at: string | null;
  client_comment: string | null;
  created_at: string;
  draft: { title: string } | { title: string }[] | null;
};

export default async function FeedbackPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("feedback");

  const supabase = await createClient();
  const tenantId = await currentTenantId();

  const { data } = await supabase
    .from("approvals")
    .select(
      "id, approved_at, rejected_at, client_comment, created_at, draft:content_drafts(title)",
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as unknown as Row[];
  const draftTitle = (d: Row["draft"]) =>
    Array.isArray(d) ? d[0]?.title : d?.title;

  const statusOf = (r: Row) =>
    r.approved_at ? "approved" : r.rejected_at ? "rejected" : "pending";
  const tone: Record<string, string> = {
    approved: "bg-brand-soft text-brand-soft-foreground",
    rejected: "bg-destructive/15 text-destructive",
    pending: "bg-muted text-muted-foreground",
  };

  const fmt = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short" });

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <ul className="divide-y divide-border">
          {rows.map((r) => {
            const status = statusOf(r);
            return (
              <li key={r.id} className="px-4 py-3">
                <div className="flex items-center gap-3 text-sm">
                  <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                    {draftTitle(r.draft) ?? "—"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {fmt.format(new Date(r.created_at))}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${tone[status]}`}
                  >
                    {t(`status.${status}`)}
                  </span>
                </div>
                {r.client_comment ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    “{r.client_comment}”
                  </p>
                ) : null}
              </li>
            );
          })}
          {rows.length === 0 && (
            <li className="px-4 py-10 text-center text-sm text-muted-foreground">
              {t("empty")}
            </li>
          )}
        </ul>
      </div>
    </>
  );
}
