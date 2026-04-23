import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { DraftEditForm, type InitialSlide } from "./DraftEditForm";
import {
  approveDraftAction,
  renderCreativesAction,
  scheduleDraftAction,
} from "../../../actions";

type Draft = Database["public"]["Tables"]["content_drafts"]["Row"];
type Slide = Database["public"]["Tables"]["slides"]["Row"];
type Creative = Database["public"]["Tables"]["creatives"]["Row"];
type Scheduled = Pick<
  Database["public"]["Tables"]["scheduled_posts"]["Row"],
  "id" | "platform" | "scheduled_for" | "status"
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

  // Existing scheduled posts for this draft (if any) — shown below the form.
  const { data: scheduledData } = await supabase
    .from("scheduled_posts")
    .select("id, platform, scheduled_for, status")
    .eq("draft_id", id)
    .order("scheduled_for", { ascending: true });
  const scheduled = (scheduledData ?? []) as Scheduled[];

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
