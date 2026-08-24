import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import type { Route } from "next";

import { Pill } from "@/components/ui/Pill";
import {
  DESIGN_STATES,
  PULL_LEAD_WORKING_DAYS,
  SOCIAL_SCREENS,
  addWorkingDays,
  dayOf,
  formatIsoDate,
  formatLabel,
  isReplyOverdue,
  replyDueBy,
  type DesignState,
} from "@/lib/social";
import { createClient } from "@/lib/supabase/server";
import { getPiece, listSocialClients } from "../../_data";
import { getCurrentRole } from "@/lib/roles-server";
import { socialCaps, todayIso } from "@/lib/social";
import { StageBadge, DesignBadge } from "../../_components/StageBadge";
import { DesignStateForm } from "../../_components/PieceActions";
import { Moves } from "../../_components/Moves";
import { SaveFields } from "../../_components/SaveFields";
import { ArtworkPanel } from "../../_components/ArtworkPanel";
import { CopyText } from "../../_components/CopyText";

export const dynamic = "force-dynamic";

const field =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";
const labelCls =
  "mb-1.5 block text-[10px] font-medium uppercase tracking-widest text-muted-foreground";

export default async function PiecePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, id } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("social");

  const supabase = await createClient();
  const [piece, clients, role, artworkRes] = await Promise.all([
    getPiece(id),
    listSocialClients(),
    getCurrentRole(),
    // The final images, in publishing order. Ordered here rather than sorted
    // in the component, so the order the designer chose is the order the
    // publish path reads too — they walk the same `position`.
    supabase
      .from("slides")
      .select("id, position, creatives(image_url, version)")
      .eq("draft_id", id)
      .order("position", { ascending: true }),
  ]);
  if (!piece) notFound();

  type ArtRow = {
    id: string;
    position: number;
    creatives:
      | { image_url: string; version: number }
      | Array<{ image_url: string; version: number }>
      | null;
  };
  const artwork = ((artworkRes.data ?? []) as unknown as ArtRow[])
    .map((row) => {
      const list = Array.isArray(row.creatives)
        ? row.creatives
        : row.creatives
          ? [row.creatives]
          : [];
      // Highest version wins, matching what the publish cron picks.
      const latest = [...list].sort((a, b) => b.version - a.version)[0];
      return latest
        ? { id: row.id, position: row.position, url: latest.image_url }
        : null;
    })
    .filter((x): x is { id: string; position: number; url: string } => x !== null);

  const caps = socialCaps(role);
  const today = todayIso();
  const client = clients.find((c) => c.id === piece.client_id);
  const coordinate = caps.includes("coordinate");
  const direction = caps.includes("direction");
  const design = caps.includes("design");
  const publish = caps.includes("publish");
  // Dates on this screen used to render as raw ISO — the same piece read
  // "sáb., 12 de set. de 2026" on the fortnight board and "2026-09-12" one
  // click later, on the record you open precisely to check the deadline.
  const date = (iso: string | null | undefined) =>
    formatIsoDate(iso, locale) ?? "—";

  const due = replyDueBy(piece.publish_on);
  const overdue = isReplyOverdue(piece.publish_on, today);
  const designState = (piece.design_state ?? "todo") as DesignState;

  // `back` names a screen, never a URL: a caller-supplied path would be a
  // redirect target this page has no business trusting.
  const backRaw = (Array.isArray(sp.back) ? sp.back[0] : sp.back) ?? "";
  const backKey = SOCIAL_SCREENS.some(
    (screen) => screen.key === backRaw && screen.href.startsWith("/social"),
  )
    ? backRaw
    // The fortnight was the old hardcoded target, and it is not a screen every
    // role may open — a designer bounced straight back out of the record they
    // had just closed. `waiting` is the one screen all five capabilities hold.
    : "waiting";
  const backClient = (Array.isArray(sp.client) ? sp.client[0] : sp.client) ?? "";
  const backHref =
    (backKey === "overview" ? "/social" : `/social/${backKey}`) +
    (backClient ? `?client=${encodeURIComponent(backClient)}` : "");

  return (
    <div className="mx-auto max-w-3xl">
      {/* Where you came from, not one hardcoded board.
          This link was always "/social/fortnight", so opening a piece from the
          backlog, production, publishing, the calendar or the waiting list and
          pressing back dropped you on a different screen — and, for a
          designer, on one that is not even in their nav. It also lost the
          client filter every time, which is the module's most repeated
          papercut in a studio running six clients. */}
      <Link
        href={backHref as Route}
        className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground"
      >
        ← {t(`piece.backTo.${backKey}`)}
      </Link>

      <header className="mb-6">
        <p className="mb-1.5 text-[10px] font-medium uppercase tracking-widest text-brand">
          {[client?.name, piece.pillar, piece.origin && t(`themeForm.originValue.${piece.origin}`)]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <h1 className="font-display text-3xl leading-tight text-foreground">
          {piece.title}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {formatLabel(piece.post_type, piece.slide_count, (k) => t(`format.${k}`))}
          {piece.publish_on
            ? ` · ${date(piece.publish_on)} · ${piece.publish_time.slice(0, 5)}`
            : ""}
        </p>
      </header>

      {/* ── The record ─────────────────────────────────────────── */}
      <section className="mb-4 rounded-2xl border border-border bg-card px-5 py-2">
        <Row label={t("piece.client")} value={client?.name ?? "—"} />
        <Row
          label={t("piece.format")}
          value={`${formatLabel(piece.post_type, piece.slide_count, (k) => t(`format.${k}`))} · ${piece.channels
            .map((c) => t(`channel.${c}`))
            .join(" + ")}`}
        />
        <Row label={t("piece.axis")} value={piece.pillar ?? "—"} />
        <Row label={t("piece.addedOn")} value={date(piece.backlog_added_on)} />
        {piece.window_note ? (
          <Row label={t("piece.window")} value={piece.window_note} />
        ) : null}
        {piece.source_ref ? (
          <Row label={t("piece.source")} value={piece.source_ref} />
        ) : null}
        {piece.publish_on ? (
          <Row
            label={t("piece.publishes")}
            value={`${date(piece.publish_on)} · ${piece.publish_time.slice(0, 5)}`}
          />
        ) : null}
        {due && (piece.status === "client_review" || piece.status === "changes_requested") ? (
          <Row
            label={t("piece.replyByLabel")}
            value={
              <span className="flex items-center gap-2">
                {date(due)}
                {overdue ? (
                  <Pill tone="danger" className="text-[10px]">
                    {t("piece.replyPassed")}
                  </Pill>
                ) : null}
              </span>
            }
          />
        ) : null}
        {piece.sent_up_at ? (
          <Row label={t("piece.sentUp")} value={date(dayOf(piece.sent_up_at))} />
        ) : null}
        {piece.approved_internal_at ? (
          <Row
            label={t("piece.approvedInternal")}
            value={date(dayOf(piece.approved_internal_at))}
          />
        ) : null}
        {piece.sent_to_client_at ? (
          <Row
            label={t("piece.sentToClient")}
            value={dayOf(piece.sent_to_client_at) ?? "—"}
          />
        ) : null}
        {piece.client_approved_at ? (
          <Row
            label={t("piece.clientApproved")}
            value={dayOf(piece.client_approved_at) ?? "—"}
          />
        ) : null}
        <Row
          label={t("piece.status")}
          value={
            <span className="flex flex-wrap items-center gap-2">
              <StageBadge stage={piece.status} />
              {piece.status === "creative_review" ? (
                <DesignBadge state={designState} />
              ) : null}
            </span>
          }
        />
      </section>

      {piece.return_reason ? (
        <Note tone="danger" title={t("piece.cameBackBecause")}>
          {piece.return_reason}
        </Note>
      ) : null}
      {piece.client_comment ? (
        <Note tone="danger" title={t("piece.clientNote")}>
          {piece.client_comment}
        </Note>
      ) : null}
      {piece.design_feedback ? (
        <Note tone="muted" title={t("piece.designNote")}>
          {piece.design_feedback}
        </Note>
      ) : null}
      {piece.why_now ? (
        <Note tone="brand" title={t("piece.whyNow")}>
          {piece.why_now}
        </Note>
      ) : null}

      {/* ── Internal notes — never leave the studio ────────────── */}
      {(coordinate || direction || design || publish) && piece.note_design ? (
        <Note tone="warning" title={t("piece.internalForDesign")}>
          {piece.note_design}
        </Note>
      ) : null}
      {(coordinate || publish) && piece.note_publish ? (
        <Note tone="warning" title={t("piece.internalForPublishing")}>
          {piece.note_publish}
        </Note>
      ) : null}

      {/* ── The text ───────────────────────────────────────────── */}
      <section className="mb-4">
        <h2 className={labelCls} id="final-text">
          {t("piece.finalText")}
        </h2>
        {coordinate ? (
          <SaveFields
            id={piece.id}
            locale={locale}
            submitLabel={t("piece.saveText")}
            savedLabel={t("piece.saved")}
          >
            <textarea
              name="caption"
              aria-labelledby="final-text"
              defaultValue={piece.caption ?? ""}
              placeholder={t("piece.textPlaceholder")}
              className={`${field} min-h-[220px] font-sans leading-relaxed`}
            />
          </SaveFields>
        ) : piece.caption ? (
          <div className="space-y-3">
            <pre className="whitespace-pre-wrap rounded-xl bg-muted/60 px-4 py-3 font-sans text-sm leading-relaxed text-muted-foreground">
              {piece.caption}
            </pre>
            {publish ? (
              <CopyText
                text={piece.caption}
                label={t("publishing.copyText")}
                copiedLabel={t("publishing.copied")}
              />
            ) : null}
          </div>
        ) : (
          <p className="rounded-xl border border-border px-4 py-3 text-sm text-muted-foreground">
            {t("piece.noText")}
          </p>
        )}
      </section>

      {/* ── The final images, and which path this piece will take ─ */}
      <div className="mb-4">
        <ArtworkPanel
          pieceId={piece.id}
          locale={locale}
          images={artwork}
          canEdit={design || coordinate}
        />
      </div>

      {/* ── Design's own panel ─────────────────────────────────── */}
      {design && piece.status === "creative_review" ? (
        <section className="mb-4 rounded-2xl border border-border bg-card p-5">
          <h2 className={labelCls}>{t("piece.designPanel")}</h2>
          <SaveFields
            id={piece.id}
            locale={locale}
            submitLabel={t("piece.save")}
            savedLabel={t("piece.saved")}
          >
            <div>
              <label className={labelCls} htmlFor="material">
                {t("piece.folderLink")}
              </label>
              <input
                id="material"
                name="material_url"
                defaultValue={piece.material_url ?? ""}
                placeholder="https://…"
                className={field}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="feedback">
                {t("piece.notesBack")}
              </label>
              <textarea
                id="feedback"
                name="design_feedback"
                defaultValue={piece.design_feedback ?? ""}
                placeholder={t("piece.notesBackPlaceholder")}
                className={`${field} min-h-[72px]`}
              />
            </div>
          </SaveFields>

          <div className="mt-4 border-t border-border pt-4">
            <DesignStateForm
              id={piece.id}
              locale={locale}
              current={designState}
              options={(DESIGN_STATES as readonly DesignState[])
                // Signing off is coordination's call, so design is not offered it.
                .filter((s) => s !== "signed_off")
                .map((s) => ({ value: s, label: t(`designState.${s}`) }))}
            />
          </div>
        </section>
      ) : null}

      {/* ── Coordination's panel ───────────────────────────────── */}
      {coordinate ? (
        <section className="mb-4 rounded-2xl border border-border bg-card p-5">
          <h2 className={labelCls}>{t("piece.coordinationPanel")}</h2>
          <SaveFields
            id={piece.id}
            locale={locale}
            submitLabel={t("piece.save")}
            savedLabel={t("piece.saved")}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls} htmlFor="publish_on">
                  {t("piece.publishOn")}
                </label>
                <input
                  id="publish_on"
                  name="publish_on"
                  type="date"
                  defaultValue={piece.publish_on ?? ""}
                  className={field}
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="publish_time">
                  {t("piece.publishTime")}
                </label>
                <input
                  id="publish_time"
                  name="publish_time"
                  type="time"
                  defaultValue={piece.publish_time.slice(0, 5)}
                  className={field}
                />
              </div>
            </div>
            <div>
              <label className={labelCls} htmlFor="material_url_c">
                {t("piece.folderLink")}
              </label>
              <input
                id="material_url_c"
                name="material_url"
                defaultValue={piece.material_url ?? ""}
                className={field}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls} htmlFor="note_design">
                  {t("piece.internalForDesign")}
                </label>
                <textarea
                  id="note_design"
                  name="note_design"
                  defaultValue={piece.note_design ?? ""}
                  className={`${field} min-h-[72px]`}
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="note_publish">
                  {t("piece.internalForPublishing")}
                </label>
                <textarea
                  id="note_publish"
                  name="note_publish"
                  defaultValue={piece.note_publish ?? ""}
                  className={`${field} min-h-[72px]`}
                />
              </div>
            </div>
            <div>
              <label className={labelCls} htmlFor="why_now">
                {t("piece.whyNowEditable")}
              </label>
              <textarea
                id="why_now"
                name="why_now"
                defaultValue={piece.why_now ?? ""}
                className={`${field} min-h-[72px]`}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls} htmlFor="window_note">
                  {t("piece.window")}
                </label>
                <input
                  id="window_note"
                  name="window_note"
                  defaultValue={piece.window_note ?? ""}
                  className={field}
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="source_ref">
                  {t("piece.source")}
                </label>
                <input
                  id="source_ref"
                  name="source_ref"
                  defaultValue={piece.source_ref ?? ""}
                  className={field}
                />
              </div>
            </div>
          </SaveFields>

          {piece.status === "creative_review" ? (
            <div className="mt-4 border-t border-border pt-4">
              <p className={labelCls}>{t("piece.signOff")}</p>
              <DesignStateForm
                id={piece.id}
                locale={locale}
                current={designState}
                options={(DESIGN_STATES as readonly DesignState[]).map((s) => ({
                  value: s,
                  label: t(`designState.${s}`),
                }))}
              />
            </div>
          ) : null}
        </section>
      ) : null}

      {/* ── What can move from here ────────────────────────────── */}
      <section className="rounded-2xl border border-brand bg-card p-5">
        <h2 className={labelCls}>{t("piece.nextMove")}</h2>
        {piece.status === "text_review" && direction ? (
          <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
            {t("piece.directionNote")}
          </p>
        ) : null}
        {piece.status === "client_review" &&
        coordinate &&
        isReplyOverdue(piece.publish_on, today) ? (
          <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
            {t("piece.silenceNote")}
          </p>
        ) : null}
        <Moves
          piece={piece}
          caps={caps}
          today={today}
          locale={locale}
          clientName={(client?.name ?? "").split(" ")[0]}
          extra={
            piece.status === "backlog" ? (
              <div className="mb-3">
                <label className={labelCls} htmlFor="pull-date">
                  {t("piece.publishOn")}
                </label>
                <input
                  id="pull-date"
                  name="publish_on"
                  type="date"
                  defaultValue={addWorkingDays(today, PULL_LEAD_WORKING_DAYS)}
                  className={field}
                />
              </div>
            ) : null
          }
        />
      </section>
    </div>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-2.5 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right text-foreground">{value}</span>
    </div>
  );
}

const NOTE_TONE: Record<string, string> = {
  brand: "bg-brand-soft/40",
  danger: "bg-destructive/10",
  warning: "bg-amber-500/10",
  muted: "bg-muted/60",
};

function Note({
  tone,
  title,
  children,
}: {
  tone: keyof typeof NOTE_TONE;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`mb-3 rounded-xl px-4 py-3 ${NOTE_TONE[tone]}`}>
      <p className="mb-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
        {title}
      </p>
      <p className="text-sm leading-relaxed text-foreground">{children}</p>
    </div>
  );
}
