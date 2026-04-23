import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/routing";
import { Pill } from "@/components/ui/Pill";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { DraftEditForm, type InitialSlide } from "./DraftEditForm";

function complianceTone(
  severity: "ok" | "warning" | "block",
): "success" | "warning" | "danger" {
  if (severity === "block") return "danger";
  if (severity === "warning") return "warning";
  return "success";
}
import {
  adaptDraftAction,
  aiRewriteDraftAction,
  approveDraftAction,
  checkComplianceAction,
  generateApprovalLinkAction,
  generateReelScriptAction,
  generateStoriesAction,
  renderCreativesAction,
  scheduleDraftAction,
  uploadReelVideoAction,
} from "../../../actions";

type Draft = Database["public"]["Tables"]["content_drafts"]["Row"];
type Slide = Database["public"]["Tables"]["slides"]["Row"];
type Creative = Database["public"]["Tables"]["creatives"]["Row"];
type Scheduled = Pick<
  Database["public"]["Tables"]["scheduled_posts"]["Row"],
  "id" | "platform" | "scheduled_for" | "status"
>;
type AiEdit = Pick<
  Database["public"]["Tables"]["ai_edits"]["Row"],
  "id" | "prompt" | "response" | "created_at"
>;
type Approval = Pick<
  Database["public"]["Tables"]["approvals"]["Row"],
  | "id"
  | "token"
  | "expires_at"
  | "approved_at"
  | "rejected_at"
  | "client_comment"
  | "created_at"
>;

function suggestedScheduledFor(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function DraftEditPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("contentEngine");

  const supabase = await createClient();

  const { data } = await supabase
    .from("content_drafts")
    .select("*, slides(id, position, headline, body)")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const draft = data as Draft & { slides: Slide[] };

  const initialSlides: InitialSlide[] = [...(draft.slides ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((s) => ({ headline: s.headline, body: s.body }));

  // Latest creative per slide (for thumbnail strip)
  const { data: creativesData } = await supabase
    .from("creatives")
    .select("id, slide_id, version, image_url")
    .eq("draft_id", id)
    .order("version", { ascending: false });
  const latestBySlide = new Map<string, Creative>();
  for (const c of (creativesData ?? []) as Creative[]) {
    if (c.slide_id && !latestBySlide.has(c.slide_id)) {
      latestBySlide.set(c.slide_id, c);
    }
  }
  const slideThumbnails = [...(draft.slides ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((s) => ({
      position: s.position,
      headline: s.headline ?? "",
      imageUrl: latestBySlide.get(s.id)?.image_url ?? null,
    }));

  const canApprove = [
    "draft",
    "text_review",
    "creative_review",
    "client_review",
  ].includes(draft.status);

  const canSchedule = ["approved", "scheduled"].includes(draft.status);

  // Compliance report (JSONB column populated by checkComplianceAction)
  type ComplianceIssueView = {
    rule: string;
    location: string;
    description: string;
    severity: "warning" | "block";
  };
  type ComplianceReportView = {
    severity: "ok" | "warning" | "block";
    summary: string;
    issues: ComplianceIssueView[];
    checkedAt: string;
    model: string;
  };
  const complianceReport =
    (draft.compliance_report as ComplianceReportView | null) ?? null;

  // Existing scheduled posts for this draft (if any) — shown below the form.
  const { data: scheduledData } = await supabase
    .from("scheduled_posts")
    .select("id, platform, scheduled_for, status")
    .eq("draft_id", id)
    .order("scheduled_for", { ascending: true });
  const scheduled = (scheduledData ?? []) as Scheduled[];

  // Last 5 AI rewrites for audit trail + "what changed" context
  const { data: aiEditRows } = await supabase
    .from("ai_edits")
    .select("id, prompt, response, created_at")
    .eq("draft_id", id)
    .order("created_at", { ascending: false })
    .limit(5);
  const aiEdits = (aiEditRows ?? []) as AiEdit[];

  // Approval links — show latest first so Andréa can grab the active URL
  const { data: approvalRows } = await supabase
    .from("approvals")
    .select(
      "id, token, expires_at, approved_at, rejected_at, client_comment, created_at",
    )
    .eq("draft_id", id)
    .order("created_at", { ascending: false })
    .limit(5);
  const approvals = (approvalRows ?? []) as Approval[];
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";
  function approvalStatus(a: Approval): "approved" | "rejected" | "expired" | "pending" {
    if (a.approved_at) return "approved";
    if (a.rejected_at) return "rejected";
    if (a.expires_at && new Date(a.expires_at).getTime() < Date.now()) {
      return "expired";
    }
    return "pending";
  }
  function approvalTone(
    s: "approved" | "rejected" | "expired" | "pending",
  ): "success" | "warning" | "danger" | "default" {
    if (s === "approved") return "success";
    if (s === "rejected") return "danger";
    if (s === "expired") return "warning";
    return "default";
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <Link
            href={
              draft.transcript_id
                ? `/content-engine/transcripts/${draft.transcript_id}`
                : "/content-engine"
            }
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← {t("transcriptTitle")}
          </Link>
          <h1 className="mt-2 font-display text-4xl text-foreground">
            {t("draftEditTitle")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("draftEditSubtitle")}
          </p>
        </div>
        {canApprove ? (
          <form action={approveDraftAction}>
            <input type="hidden" name="draftId" value={draft.id} />
            <input type="hidden" name="locale" value={locale} />
            <button
              type="submit"
              className="inline-flex h-10 items-center rounded-md bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700"
              data-testid="approve-draft"
            >
              {t("draftActions.approve")}
            </button>
          </form>
        ) : null}
      </div>

      {initialSlides.length > 0 ? (
        <section
          className="mb-8 rounded-lg border border-border bg-card p-5"
          data-testid="compliance-panel"
        >
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 className="font-display text-xl">{t("compliance.title")}</h2>
            <form action={checkComplianceAction}>
              <input type="hidden" name="draftId" value={draft.id} />
              <input type="hidden" name="locale" value={locale} />
              <button
                type="submit"
                className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-xs text-muted-foreground hover:bg-muted"
                data-testid="run-compliance"
              >
                {complianceReport
                  ? t("compliance.recheck")
                  : t("compliance.run")}
              </button>
            </form>
          </div>
          {complianceReport ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Pill tone={complianceTone(complianceReport.severity)}>
                  {t(`compliance.severity.${complianceReport.severity}`)}
                </Pill>
                <span className="text-sm">
                  {complianceReport.summary || t("compliance.noSummary")}
                </span>
              </div>
              {complianceReport.issues.length > 0 ? (
                <ul className="space-y-2">
                  {complianceReport.issues.map((issue, idx) => (
                    <li
                      key={idx}
                      className="rounded-md border border-border bg-background p-3 text-sm"
                      data-testid="compliance-issue"
                    >
                      <div className="mb-1 flex items-center gap-2 text-xs">
                        <Pill tone={complianceTone(issue.severity)}>
                          {t(`compliance.severity.${issue.severity}`)}
                        </Pill>
                        <span className="font-medium">{issue.rule}</span>
                        <span className="text-muted-foreground">
                          · {issue.location}
                        </span>
                      </div>
                      <p className="text-muted-foreground">
                        {issue.description}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className="text-xs text-muted-foreground">
                {t("compliance.checkedAt", {
                  when: new Intl.DateTimeFormat(locale, {
                    dateStyle: "short",
                    timeStyle: "short",
                  }).format(new Date(complianceReport.checkedAt)),
                })}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("compliance.empty")}
            </p>
          )}
        </section>
      ) : null}

      {initialSlides.length > 0 ? (
        <section
          className="mb-8 rounded-lg border border-border bg-card p-5"
          data-testid="ai-rewrite"
        >
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 className="font-display text-xl">{t("aiRewrite.title")}</h2>
            <p className="text-xs text-muted-foreground">
              {t("aiRewrite.hint")}
            </p>
          </div>
          <form action={aiRewriteDraftAction} className="space-y-2">
            <input type="hidden" name="draftId" value={draft.id} />
            <input type="hidden" name="locale" value={locale} />
            <textarea
              id="ai-instruction"
              name="instruction"
              required
              minLength={4}
              maxLength={1000}
              rows={3}
              placeholder={t("aiRewrite.placeholder")}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              data-testid="ai-instruction"
            />
            <div className="flex items-center justify-end">
              <button
                type="submit"
                className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                data-testid="ai-submit"
              >
                {t("aiRewrite.submit")}
              </button>
            </div>
          </form>
          {aiEdits.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {aiEdits.map((edit) => (
                <li
                  key={edit.id}
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                  data-testid="ai-edit-row"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium">{edit.prompt}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {new Intl.DateTimeFormat(locale, {
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(new Date(edit.created_at))}
                    </span>
                  </div>
                  {edit.response ? (
                    <p className="mt-1 text-xs italic text-muted-foreground">
                      {edit.response}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {initialSlides.length > 0 ? (
        <section
          className="mb-8 rounded-lg border border-border bg-card p-5"
          data-testid="adapt-panel"
        >
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 className="font-display text-xl">{t("adapt.title")}</h2>
            <p className="text-xs text-muted-foreground">{t("adapt.hint")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <form action={adaptDraftAction}>
              <input type="hidden" name="draftId" value={draft.id} />
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="platform" value="linkedin" />
              <button
                type="submit"
                className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-muted"
                data-testid="adapt-linkedin"
              >
                {t("adapt.linkedin")}
              </button>
            </form>
            <form action={adaptDraftAction}>
              <input type="hidden" name="draftId" value={draft.id} />
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="platform" value="tiktok" />
              <button
                type="submit"
                className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-muted"
                data-testid="adapt-tiktok"
              >
                {t("adapt.tiktok")}
              </button>
            </form>
            <form action={generateStoriesAction}>
              <input type="hidden" name="draftId" value={draft.id} />
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="count" value="3" />
              <button
                type="submit"
                className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-muted"
                data-testid="generate-stories"
              >
                {t("adapt.stories")}
              </button>
            </form>
            <form action={generateReelScriptAction}>
              <input type="hidden" name="draftId" value={draft.id} />
              <input type="hidden" name="locale" value={locale} />
              <button
                type="submit"
                className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-muted"
                data-testid="generate-reel"
              >
                {t("adapt.reel")}
              </button>
            </form>
          </div>
        </section>
      ) : null}

      {draft.video_script ? (
        <section
          className="mb-8 rounded-lg border border-border bg-card p-5"
          data-testid="reel-script"
        >
          <h2 className="mb-3 font-display text-xl">{t("reel.title")}</h2>
          <pre className="whitespace-pre-wrap break-words rounded-md bg-muted p-3 font-sans text-sm leading-relaxed">
            {draft.video_script}
          </pre>
          <p className="mt-3 text-xs text-muted-foreground">
            {t("reel.hint")}
          </p>

          <div className="mt-6 border-t border-border pt-4">
            <h3 className="mb-2 text-sm font-medium text-foreground">
              {t("reel.videoUpload")}
            </h3>
            {draft.video_url ? (
              <div className="mb-3 space-y-2">
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video
                  src={draft.video_url}
                  controls
                  className="w-full rounded-md border border-border bg-black"
                  data-testid="reel-video-player"
                />
                <a
                  href={draft.video_url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-block text-xs text-primary hover:underline"
                >
                  {t("reel.viewRaw")}
                </a>
              </div>
            ) : (
              <p className="mb-3 text-xs text-muted-foreground">
                {t("reel.videoEmpty")}
              </p>
            )}
            <form
              action={uploadReelVideoAction}
              className="flex flex-wrap items-center gap-2"
            >
              <input type="hidden" name="draftId" value={draft.id} />
              <input type="hidden" name="locale" value={locale} />
              <input
                type="file"
                name="video"
                required
                accept="video/mp4,video/quicktime,video/webm"
                className="text-xs file:mr-2 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-xs file:font-medium hover:file:bg-muted"
                data-testid="reel-video-input"
              />
              <button
                type="submit"
                className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                data-testid="reel-video-submit"
              >
                {draft.video_url
                  ? t("reel.videoReplace")
                  : t("reel.videoUpload")}
              </button>
            </form>
            <p className="mt-2 text-[10px] text-muted-foreground">
              {t("reel.videoSizeHint")}
            </p>
          </div>
        </section>
      ) : null}

      {initialSlides.length > 0 ? (
        <section
          className="mb-8 rounded-lg border border-border bg-card p-5"
          data-testid="approval-links"
        >
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 className="font-display text-xl">{t("approvalLink.title")}</h2>
            <form action={generateApprovalLinkAction}>
              <input type="hidden" name="draftId" value={draft.id} />
              <input type="hidden" name="locale" value={locale} />
              <button
                type="submit"
                className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                data-testid="generate-approval-link"
              >
                {t("approvalLink.generate")}
              </button>
            </form>
          </div>
          {approvals.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("approvalLink.empty")}
            </p>
          ) : (
            <ul className="space-y-2">
              {approvals.map((a) => {
                const status = approvalStatus(a);
                const url = `${appUrl}/a/${a.token}?locale=${locale}`;
                return (
                  <li
                    key={a.id}
                    className="rounded-md border border-border bg-background p-3 text-sm"
                    data-testid="approval-link-row"
                  >
                    <div className="flex items-center gap-2">
                      <Pill tone={approvalTone(status)}>
                        {t(`approvalLink.status.${status}`)}
                      </Pill>
                      <span className="text-xs text-muted-foreground">
                        {t("approvalLink.createdAt", {
                          when: new Intl.DateTimeFormat(locale, {
                            dateStyle: "short",
                            timeStyle: "short",
                          }).format(new Date(a.created_at)),
                        })}
                      </span>
                    </div>
                    <code
                      className="mt-2 block w-full select-all overflow-x-auto rounded bg-muted px-2 py-1 text-xs"
                      data-testid="approval-link-url"
                    >
                      {url}
                    </code>
                    {a.client_comment ? (
                      <p className="mt-2 italic text-muted-foreground">
                        “{a.client_comment}”
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            {t("approvalLink.hint")}
          </p>
        </section>
      ) : null}

      {canSchedule ? (
        <section
          className="mb-8 rounded-lg border border-border bg-card p-5"
          data-testid="scheduler"
        >
          <h2 className="mb-3 font-display text-xl">{t("schedule.title")}</h2>
          <form
            action={scheduleDraftAction}
            className="flex flex-wrap items-end gap-3"
          >
            <input type="hidden" name="draftId" value={draft.id} />
            <input type="hidden" name="locale" value={locale} />
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="scheduled_for"
                className="text-xs text-muted-foreground"
              >
                {t("schedule.when")}
              </label>
              <input
                id="scheduled_for"
                name="scheduled_for"
                type="datetime-local"
                required
                defaultValue={suggestedScheduledFor()}
                className="flex h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="platform"
                className="text-xs text-muted-foreground"
              >
                {t("schedule.platform")}
              </label>
              <select
                id="platform"
                name="platform"
                defaultValue="instagram"
                className="flex h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="instagram">Instagram</option>
                <option value="linkedin">LinkedIn</option>
                <option value="tiktok">TikTok</option>
              </select>
            </div>
            <button
              type="submit"
              className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              data-testid="schedule-draft"
            >
              {t("schedule.submit")}
            </button>
          </form>
          {scheduled.length > 0 ? (
            <ul className="mt-4 space-y-1.5 text-sm">
              {scheduled.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2"
                  data-testid="scheduled-row"
                >
                  <span>
                    {new Intl.DateTimeFormat(locale, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(s.scheduled_for))}
                    {" · "}
                    {s.platform}
                  </span>
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    {s.status}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <section className="mb-8 rounded-lg border border-border bg-card p-5">
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <h2 className="font-display text-xl">{t("creatives.title")}</h2>
          <form action={renderCreativesAction}>
            <input type="hidden" name="draftId" value={draft.id} />
            <input type="hidden" name="locale" value={locale} />
            <button
              type="submit"
              className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              data-testid="render-creatives"
            >
              {t("creatives.render")}
            </button>
          </form>
        </div>
        {slideThumbnails.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("creatives.empty")}
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2 md:grid-cols-5">
            {slideThumbnails.map((slide) => (
              <figure
                key={slide.position}
                className="overflow-hidden rounded-md border border-border bg-muted"
                data-testid="creative-thumb"
              >
                <div className="aspect-[4/5] w-full bg-muted">
                  {slide.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={slide.imageUrl}
                      alt={`Slide ${slide.position}`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                      {t("creatives.notRendered")}
                    </div>
                  )}
                </div>
                <figcaption className="truncate px-2 py-1 text-[10px] text-muted-foreground">
                  #{slide.position} {slide.headline}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          {t("creatives.hint")}
        </p>
      </section>

      <DraftEditForm
        locale={locale}
        draft={{
          id: draft.id,
          title: draft.title,
          pillar: draft.pillar,
          hook: draft.hook,
          caption: draft.caption,
          hashtags: draft.hashtags ?? [],
          status: draft.status,
          transcriptId: draft.transcript_id,
        }}
        initialSlides={initialSlides}
      />
    </div>
  );
}
