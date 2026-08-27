import { getTranslations } from "next-intl/server";

import { pageLink, type PageMeta, type ParsedPage } from "@/lib/pagination";

/**
 * The numeric pager for a paginated list.
 *
 * The markup was written out twice — in the clients list and the transcripts
 * list — along with two verbatim copies of its four strings in each locale.
 * Both copies also built their own `?page=` link and dropped the rest of the
 * querystring while doing it, so paging a filtered list quietly cleared the
 * filters. One component, one `pageLink`, one set of strings in
 * `common.pagination`.
 *
 * Renders nothing at all when there is only one page: a pager under a list of
 * four rows is furniture, not navigation.
 */
export async function Pager({
  parsed,
  meta,
  shown,
  searchParams,
  defaultSize,
  testId,
}: {
  parsed: ParsedPage;
  meta: PageMeta;
  /** Rows on this page — the last number in "1–30 of 214". */
  shown: number;
  /** The screen's own searchParams, so filters survive paging. */
  searchParams: Record<string, string | string[] | undefined>;
  defaultSize: number;
  /** Kept per-screen so existing end-to-end selectors still resolve. */
  testId?: string;
}) {
  if (meta.totalPages <= 1) return null;
  const t = await getTranslations("common.pagination");
  const href = (page: number) => pageLink(searchParams, page, { defaultSize });

  return (
    <nav
      className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-sm"
      data-testid={testId}
      aria-label={t("pageOf", { page: meta.page, total: meta.totalPages })}
    >
      <p className="text-muted-foreground">
        {t("range", {
          from: parsed.from + 1,
          to: parsed.from + shown,
          total: meta.totalCount,
        })}
      </p>
      <div className="flex items-center gap-2">
        {meta.hasPrev ? (
          <a
            href={href(parsed.page - 1)}
            rel="prev"
            className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            data-testid={testId ? `${testId}-prev` : undefined}
          >
            ← {t("prev")}
          </a>
        ) : null}
        <span className="text-xs text-muted-foreground">
          {t("pageOf", { page: meta.page, total: meta.totalPages })}
        </span>
        {meta.hasNext ? (
          <a
            href={href(parsed.page + 1)}
            rel="next"
            className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            data-testid={testId ? `${testId}-next` : undefined}
          >
            {t("next")} →
          </a>
        ) : null}
      </div>
    </nav>
  );
}
