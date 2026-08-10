import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import { wordCount } from "@/lib/vtt";
import { pageMeta, parsePage } from "@/lib/pagination";
import { generateCarouselsAction } from "./actions";

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

const PAGE_SIZE = 25;

export default async function ContentEnginePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("contentEngine");

  const parsed = parsePage(sp, { defaultSize: PAGE_SIZE, maxSize: 100 });

  const supabase = await createClient();
  const { data, count } = await supabase
    .from("transcripts")
    .select(
      "id, content, language, created_at, meeting:meetings(client:clients(slug, name))",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(parsed.from, parsed.to);

  const baseRows = ((data ?? []) as unknown as Row[]).map((r) => {
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

  // Draft counts per transcript (separate query — easier than a nested count)
  const ids = baseRows.map((r) => r.id);
  const draftCounts = new Map<string, number>();
  if (ids.length > 0) {
    const { data: counts } = await supabase
      .from("content_drafts")
      .select("transcript_id")
      .in("transcript_id", ids);
    for (const c of counts ?? []) {
      const key = (c as { transcript_id: string }).transcript_id;
      draftCounts.set(key, (draftCounts.get(key) ?? 0) + 1);
    }
  }
  const rows = baseRows.map((r) => ({
    ...r,
    draftsCount: draftCounts.get(r.id) ?? 0,
  }));

  const meta = pageMeta(parsed, count ?? rows.length);
  const pageLink = (page: number): string => {
    const params = new URLSearchParams();
    if (page > 1) params.set("page", String(page));
    if (parsed.pageSize !== PAGE_SIZE) {
      params.set("pageSize", String(parsed.pageSize));
    }
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  };

  return (
    <div className="">
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
                    {" · "}
                    {t("draftsCount", { count: row.draftsCount })}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href={`/content-engine/transcripts/${row.id}`}
                    className="inline-flex h-8 items-center rounded-md border border-input bg-background px-3 text-xs hover:bg-muted"
                  >
                    {t("actions.viewDrafts")}
                  </Link>
                  <form action={generateCarouselsAction}>
                    <input type="hidden" name="transcriptId" value={row.id} />
                    <input type="hidden" name="locale" value={locale} />
                    <button
                      type="submit"
                      className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                      data-testid="generate-carousels"
                    >
                      {t("actions.generate")}
                    </button>
                  </form>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {meta.totalPages > 1 ? (
        <nav
          className="mt-6 flex items-center justify-between border-t border-border pt-4 text-sm"
          data-testid="transcripts-pagination"
        >
          <p className="text-muted-foreground">
            {t("pagination.range", {
              from: parsed.from + 1,
              to: parsed.from + rows.length,
              total: meta.totalCount,
            })}
          </p>
          <div className="flex items-center gap-2">
            {meta.hasPrev ? (
              <a
                href={pageLink(parsed.page - 1)}
                className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 hover:bg-muted"
              >
                ← {t("pagination.prev")}
              </a>
            ) : null}
            <span className="text-xs text-muted-foreground">
              {t("pagination.pageOf", {
                page: meta.page,
                total: meta.totalPages,
              })}
            </span>
            {meta.hasNext ? (
              <a
                href={pageLink(parsed.page + 1)}
                className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 hover:bg-muted"
              >
                {t("pagination.next")} →
              </a>
            ) : null}
          </div>
        </nav>
      ) : null}
    </div>
  );
}

export const dynamic = "force-dynamic";
