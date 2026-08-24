import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import type { Route } from "next";

import { createClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import { PageHeader } from "@/components/ui/PageHeader";
import { CLIENT_DECIDED_STAGES, type SocialStage } from "@/lib/social";

export const dynamic = "force-dynamic";

type ApprovalRow = {
  id: string;
  approved_at: string | null;
  rejected_at: string | null;
  client_comment: string | null;
  created_at: string;
  draft: { id: string; title: string } | { id: string; title: string }[] | null;
};

type PieceRow = {
  id: string;
  title: string;
  status: SocialStage;
  client_comment: string | null;
  client_approved_at: string | null;
  sent_to_client_at: string | null;
  updated_at: string;
};

/** One shape for both mechanisms, so the screen renders a single list. */
type Entry = {
  key: string;
  title: string;
  at: string;
  status: "approved" | "rejected" | "changes" | "pending";
  comment: string | null;
  href: string;
  origin: "social" | "content";
};

const TONE: Record<Entry["status"], string> = {
  approved: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  rejected: "bg-destructive/15 text-destructive",
  changes: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  pending: "bg-muted text-muted-foreground",
};

/**
 * What clients have said back.
 *
 * The app grew two approval mechanisms: the content engine writes rows to
 * `approvals` behind a public /a/[token] link, and the social module records
 * the answer on the piece itself (`client_approved_at`, `client_comment`, and
 * the stage it moved to). This screen read only the first — so the module the
 * studio actually runs on contributed nothing to it, and `designer_social`,
 * whose only feedback screen this is, never saw a client comment at all.
 *
 * Both are read here. They are not merged in the database: they are genuinely
 * different flows with different auth, and collapsing them would be a
 * migration, not a screen.
 */
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

  const [{ data: approvalData }, { data: pieceData }] = await Promise.all([
    supabase
      .from("approvals")
      .select(
        "id, approved_at, rejected_at, client_comment, created_at, draft:content_drafts(id, title)",
      )
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("content_drafts")
      .select(
        "id, title, status, client_comment, client_approved_at, sent_to_client_at, updated_at",
      )
      .eq("tenant_id", tenantId)
      .eq("engine", "social")
      .in("status", CLIENT_DECIDED_STAGES)
      .order("updated_at", { ascending: false })
      .limit(100),
  ]);

  const approvals = (approvalData ?? []) as unknown as ApprovalRow[];
  const pieces = (pieceData ?? []) as unknown as PieceRow[];

  const draftOf = (d: ApprovalRow["draft"]) =>
    Array.isArray(d) ? d[0] : d;

  const entries: Entry[] = [
    ...approvals.map((r): Entry => {
      const draft = draftOf(r.draft);
      return {
        key: `a-${r.id}`,
        title: draft?.title ?? "—",
        at: r.approved_at ?? r.rejected_at ?? r.created_at,
        status: r.approved_at
          ? "approved"
          : r.rejected_at
            ? "rejected"
            : "pending",
        comment: r.client_comment,
        href: draft
          ? `/content-engine/drafts/${draft.id}/edit`
          : "/content-engine",
        origin: "content",
      };
    }),
    ...pieces.map((p): Entry => ({
      key: `p-${p.id}`,
      title: p.title,
      // When they answered, not when the row last changed for any reason.
      at: p.client_approved_at ?? p.sent_to_client_at ?? p.updated_at,
      status:
        p.status === "approved"
          ? "approved"
          : p.status === "rejected"
            ? "rejected"
            : p.status === "changes_requested"
              ? "changes"
              : "pending",
      comment: p.client_comment,
      href: `/social/pieces/${p.id}?back=waiting`,
      origin: "social",
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  const fmt = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
  });

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <ul className="divide-y divide-border">
          {entries.map((e) => (
            <li key={e.key}>
              <Link
                href={e.href as Route}
                className="block px-4 py-3 transition-colors hover:bg-muted/50"
              >
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                    {e.title}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {fmt.format(new Date(e.at))}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${TONE[e.status]}`}
                  >
                    {t(`status.${e.status}`)}
                  </span>
                </div>
                {e.comment ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    “{e.comment}”
                  </p>
                ) : null}
              </Link>
            </li>
          ))}
          {entries.length === 0 && (
            <li className="px-4 py-10 text-center text-sm text-muted-foreground">
              {t("empty")}
            </li>
          )}
        </ul>
      </div>
    </>
  );
}
