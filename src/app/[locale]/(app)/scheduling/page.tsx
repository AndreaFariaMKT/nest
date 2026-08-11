import { setRequestLocale, getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  scheduled_for: string;
  platform: string;
  post_type: string;
  status: string;
  draft: { title: string } | { title: string }[] | null;
};

function titleCase(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function SchedulingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("scheduling");

  const supabase = await createClient();
  const tenantId = await currentTenantId();

  const { data } = await supabase
    .from("scheduled_posts")
    .select("id, scheduled_for, platform, post_type, status, draft:content_drafts(title)")
    .eq("tenant_id", tenantId)
    .order("scheduled_for", { ascending: true });

  const rows = (data ?? []) as unknown as Row[];
  const draftTitle = (d: Row["draft"]) =>
    Array.isArray(d) ? d[0]?.title : d?.title;

  const fmt = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <Th>{t("th.when")}</Th>
              <Th>{t("th.content")}</Th>
              <Th>{t("th.platform")}</Th>
              <Th>{t("th.type")}</Th>
              <Th>{t("th.status")}</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3 text-sm text-foreground">
                  {fmt.format(new Date(r.scheduled_for))}
                </td>
                <td className="px-4 py-3 text-sm text-foreground">
                  {draftTitle(r.draft) ?? "—"}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {titleCase(r.platform)}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {titleCase(r.post_type)}
                </td>
                <td className="px-4 py-3 text-sm">
                  <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] text-brand-soft-foreground">
                    {titleCase(r.status)}
                  </span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  {t("empty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </th>
  );
}
