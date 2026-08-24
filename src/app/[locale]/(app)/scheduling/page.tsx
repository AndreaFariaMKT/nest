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
  last_error: string | null;
  draft: { title: string } | { title: string }[] | null;
};

/** The four values the publish cron writes. Anything else is a data surprise. */
const STATUSES = ["pending", "publishing", "published", "failed"] as const;

const TONE: Record<string, string> = {
  pending: "bg-brand-soft text-brand-soft-foreground",
  publishing: "bg-brand-soft text-brand-soft-foreground",
  published: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  failed: "bg-destructive/12 text-destructive",
  unknown: "bg-muted text-muted-foreground",
};

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
    // last_error was written by the cron on every failure and read by nothing.
    .select(
      "id, scheduled_for, platform, post_type, status, last_error, draft:content_drafts(title)",
    )
    .eq("tenant_id", tenantId)
    .order("scheduled_for", { ascending: true });

  const rows = (data ?? []) as unknown as Row[];
  const draftTitle = (d: Row["draft"]) =>
    Array.isArray(d) ? d[0]?.title : d?.title;

  const statusKey = (s: string) =>
    (STATUSES as readonly string[]).includes(s) ? s : "unknown";

  // Platform values are stored lowercase and are proper nouns; anything the
  // dictionary has not been taught is shown as stored rather than invented.
  const platformLabel = (p: string) =>
    t.has(`platform.${p}`) ? t(`platform.${p}`) : p;

  const failed = rows.filter((r) => r.status === "failed").length;

  const fmt = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      {failed > 0 ? (
        <p
          role="status"
          className="mb-4 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {t("failedHint")}
        </p>
      ) : null}

      {/* The table has six columns and a free-text error; on a phone it has to
          be allowed to scroll rather than crush the page. */}
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[720px]">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <Th>{t("th.when")}</Th>
              <Th>{t("th.content")}</Th>
              <Th>{t("th.platform")}</Th>
              <Th>{t("th.type")}</Th>
              <Th>{t("th.status")}</Th>
              <Th>{t("th.error")}</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => {
              const key = statusKey(r.status);
              return (
                <tr key={r.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-foreground">
                    {fmt.format(new Date(r.scheduled_for))}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {draftTitle(r.draft) ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {platformLabel(r.platform)}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {t.has(`postType.${r.post_type}`)
                      ? t(`postType.${r.post_type}`)
                      : r.post_type}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {/* Every status used to render in the same positive pill,
                        so a post that never went out looked like one that did. */}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] ${TONE[key]}`}
                    >
                      {t(`status.${key}`)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {r.status === "failed" ? (r.last_error ?? "—") : ""}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-sm text-muted-foreground"
                >
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
    <th className="whitespace-nowrap px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </th>
  );
}
