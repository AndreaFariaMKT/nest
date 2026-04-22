import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import { wordCount } from "@/lib/vtt";

type Row = {
  id: string;
  content: string;
  language: string;
  created_at: string;
  meeting:
    | { client: { slug: string; name: string } | Array<{ slug: string; name: string }> | null }
    | Array<{ client: { slug: string; name: string } | Array<{ slug: string; name: string }> | null }>
    | null;
};

function pickOne<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

export default async function ContentEnginePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("contentEngine");

  const supabase = await createClient();
  const { data } = await supabase
    .from("transcripts")
    .select(
      "id, content, language, created_at, meeting:meetings(client:clients(slug, name))",
    )
    .order("created_at", { ascending: false })
    .limit(25);

  const rows = ((data ?? []) as unknown as Row[]).map((r) => {
    const meeting = pickOne(r.meeting);
    const client = meeting ? pickOne(meeting.client) : null;
    return {
      id: r.id,
      language: r.language,
      createdAt: r.created_at,
      words: wordCount(r.content),
      client,
    };
  });

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-foreground">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Link
          href="/content-engine/new"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {t("new")}
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card px-8 py-16 text-center text-sm text-muted-foreground">
          {t("empty")}
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className="rounded-lg border border-border bg-card p-4"
              data-testid="transcript-row"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">
                    {row.client?.name ?? "—"}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {new Intl.DateTimeFormat(locale, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(row.createdAt))}
                    {" · "}
                    {row.language}
                    {" · "}
                    {t("wordCount", { count: row.words })}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export const dynamic = "force-dynamic";
