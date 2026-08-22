import { useTranslations, useFormatter } from "next-intl";
import { Link } from "@/i18n/routing";
import type { Route } from "next";

import { Pill } from "@/components/ui/Pill";
import { cn } from "@/lib/utils";
import {
  formatLabel,
  isReplyOverdue,
  replyDueBy,
  type SocialStage,
} from "@/lib/social";
import type { PieceRecord } from "../_data";
import { StageBadge } from "./StageBadge";

/** "Sat 12 Sep 2026" — one date format for the whole module. */
export function useDateLabel() {
  const format = useFormatter();
  return (iso: string | null | undefined) => {
    if (!iso) return null;
    const [y, m, d] = iso.split("-").map((n) => Number.parseInt(n, 10));
    return format.dateTime(new Date(Date.UTC(y, m - 1, d)), {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  };
}

const RETURNED: SocialStage[] = ["changes_requested", "rejected"];

/**
 * A piece as the fortnight shows it: what it is, when it runs, why it earns a
 * slot, and — when it is with the client — how long they have.
 */
export function PieceCard({
  piece,
  clientName,
  today,
  href,
  showWhy = true,
  children,
}: {
  piece: PieceRecord;
  clientName: string;
  today: string;
  href: string;
  showWhy?: boolean;
  /** Actions rendered under the card, when the reader can move the piece. */
  children?: React.ReactNode;
}) {
  const t = useTranslations("social");
  const dateLabel = useDateLabel();
  const overdue =
    (piece.status === "client_review" || piece.status === "changes_requested") &&
    isReplyOverdue(piece.publish_on, today);
  const due = replyDueBy(piece.publish_on);
  const withClient =
    piece.status === "client_review" || piece.status === "changes_requested";

  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-5",
        RETURNED.includes(piece.status)
          ? "border-l-4 border-l-destructive border-border"
          : "border-border",
      )}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Pill tone="muted" className="text-[10px]">
          {clientName}
        </Pill>
        <span className="text-xs text-muted-foreground">
          {piece.publish_on
            ? `${dateLabel(piece.publish_on)} · ${piece.publish_time.slice(0, 5)}`
            : t("piece.noDate")}
        </span>
        <StageBadge stage={piece.status} />
        {withClient && due ? (
          <Pill tone={overdue ? "danger" : "muted"} className="text-[10px]">
            {overdue
              ? t("piece.replyPassed")
              : t("piece.replyBy", { date: dateLabel(due) ?? due })}
          </Pill>
        ) : null}
      </div>

      <Link
        href={href as Route}
        className="font-display text-lg leading-snug text-foreground hover:underline"
      >
        {piece.title}
      </Link>

      <p className="mt-1 text-xs text-muted-foreground">
        {[
          formatLabel(piece.post_type, piece.slide_count, (k) =>
            t(`format.${k}`),
          ),
          piece.channels.map((c) => t(`channel.${c}`)).join(" + "),
          piece.pillar,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>

      {showWhy && piece.why_now ? (
        <div className="mt-3 border-t border-border pt-3">
          <p className="text-[10px] font-medium uppercase tracking-widest text-brand">
            {t("piece.whyNow")}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {piece.why_now}
          </p>
        </div>
      ) : null}

      {piece.client_comment ? (
        <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm leading-relaxed text-destructive">
          {piece.client_comment}
        </p>
      ) : null}

      {children ? (
        <div className="mt-4 border-t border-border pt-3">{children}</div>
      ) : null}
    </div>
  );
}
