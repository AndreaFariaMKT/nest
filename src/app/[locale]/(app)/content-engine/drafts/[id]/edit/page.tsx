import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { DraftEditForm, type InitialSlide } from "./DraftEditForm";

type Draft = Database["public"]["Tables"]["content_drafts"]["Row"];
type Slide = Database["public"]["Tables"]["slides"]["Row"];

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
