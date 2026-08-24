import { useTranslations } from "next-intl";
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
import type { SocialPieceRow } from "../_data";
import { StageBadge } from "./StageBadge";
import { useDateLabel } from "./Shared";

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
  showFull = false,
  children,
}: {
  piece: SocialPieceRow;
  clientName: string;
  today: string;
  href: string;
  showWhy?: boolean;
  /**
   * Show the caption and the artwork link. On for the portal, where someone is
   * being asked to approve them; off for the studio's boards, which are dense
   * and where the piece record is one click away.
   */
  showFull?: boolean;
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
      // The portal links every card to `/portal/content#<piece id>` and this
      // component had no id anywhere, so a client clicking a piece title got
      // nothing at all — the one gesture the whole screen invites.
      id={piece.id}
      className={cn(
        "scroll-mt-6 rounded-2xl border bg-card p-5",
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
          piece.channels.map((c: string) => t(`channel.${c}`)).join(" + "),
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

      {/* The caption and the artwork, for the screen where someone is being
          asked to approve them.
          
          The portal used to show only the title and "why this, now" — so the
          client pressed Aprovar without seeing the text that would publish or
          the art it would publish with. The module already REFUSES to send a
          piece with no folder link, on the grounds that "o cliente receberia
          um pedido de aprovação sem criativo", and then the card withheld the
          link it had just insisted on.
          
          No query changed for this: PORTAL_PIECE_COLUMNS already carried both
          fields. They were being fetched and not painted. */}
      {showFull && piece.caption ? (
        <div className="mt-3 border-t border-border pt-3">
          <p className="text-[10px] font-medium uppercase tracking-widest text-brand">
            {t("portal.finalText")}
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {piece.caption}
          </p>
        </div>
      ) : null}

      {showFull ? (
        piece.material_url ? (
          <a
            href={piece.material_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("portal.openArtwork")}
            <span aria-hidden="true">↗</span>
          </a>
        ) : (
          /* The send-time guard can be satisfied and the link cleared
             afterwards, so this state is reachable and must not read as
             "there is no art". */
          <p className="mt-3 text-sm text-destructive">
            {t("portal.noArtworkYet")}
          </p>
        )
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
