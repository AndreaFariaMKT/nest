import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { DraftEditForm, type InitialSlide } from "./DraftEditForm";
import { renderCreativesAction } from "../../../actions";

type Draft = Database["public"]["Tables"]["content_drafts"]["Row"];
type Slide = Database["public"]["Tables"]["slides"]["Row"];
type Creative = Database["public"]["Tables"]["creatives"]["Row"];

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

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
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
