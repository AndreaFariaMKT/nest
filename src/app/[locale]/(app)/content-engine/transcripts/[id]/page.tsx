import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/routing";
import { Pill } from "@/components/ui/Pill";
import { createClient } from "@/lib/supabase/server";
import { wordCount } from "@/lib/vtt";
import type { Database } from "@/types/database";

type Draft = Database["public"]["Tables"]["content_drafts"]["Row"] & {
  slides:
    | Array<Database["public"]["Tables"]["slides"]["Row"]>
    | null;
};

export default async function TranscriptDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("contentEngine");

  const supabase = await createClient();

  const { data: transcript } = await supabase
    .from("transcripts")
    .select("id, content, language, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!transcript) notFound();

  const { data: draftRows } = await supabase
    .from("content_drafts")
    .select("*, slides(*)")
    .eq("transcript_id", id)
    .order("created_at", { ascending: false });
  const drafts = (draftRows ?? []) as unknown as Draft[];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8">
        <Link
          href="/content-engine"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← {t("title")}
        </Link>
        <h1 className="mt-2 font-display text-4xl text-foreground">
          {t("transcriptTitle")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {transcript.language} · {t("wordCount", { count: wordCount(transcript.content) })}
        </p>
      </div>

      <section className="mb-8">
        <h2 className="mb-2 font-display text-xl">{t("sections.drafts")}</h2>
        {drafts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
            {t("sections.draftsEmpty")}
          </div>
        ) : (
          <div className="space-y-3">
            {drafts.map((draft) => {
              const slides = Array.isArray(draft.slides) ? draft.slides : [];
              const orderedSlides = [...slides].sort(
                (a, b) => a.position - b.position,
              );
              return (
                <article
                  key={draft.id}
                  className="rounded-lg border border-border bg-card p-5"
                  data-testid="draft-card"
                >
                  <header className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-display text-lg">{draft.title}</h3>
                      {draft.pillar ? (
                        <p className="text-xs text-muted-foreground">
                          {draft.pillar}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Pill tone="muted">{draft.status}</Pill>
                      <Link
                        href={`/content-engine/drafts/${draft.id}/edit`}
                        className="text-xs text-muted-foreground hover:text-foreground"
                        data-testid="edit-draft"
                      >
                        {t("draftActions.editLink")}
                      </Link>
                    </div>
                  </header>
                  {draft.hook ? (
                    <p className="mb-3 text-sm italic">{draft.hook}</p>
                  ) : null}
                  <ol className="space-y-1.5 text-sm">
                    {orderedSlides.map((slide) => (
                      <li
                        key={slide.id}
                        className="rounded-md bg-muted px-3 py-2"
                      >
                        {slide.headline ? (
                          <div className="font-medium">{slide.headline}</div>
                        ) : null}
                        {slide.body ? (
                          <p className="mt-0.5 text-muted-foreground">
                            {slide.body}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                  {draft.caption ? (
                    <p className="mt-3 whitespace-pre-wrap text-xs text-muted-foreground">
                      {draft.caption}
                    </p>
                  ) : null}
                  {draft.hashtags.length > 0 ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {draft.hashtags.join(" ")}
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export const dynamic = "force-dynamic";
