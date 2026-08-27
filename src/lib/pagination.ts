// Pagination helpers — parse page/pageSize from searchParams, compute range
// offsets for supabase `.range(from, to)`, and render sensible number of
// "pages total" for a simple numeric pager.

export type PageInput = {
  page?: string | string[];
  pageSize?: string | string[];
};

export type ParsedPage = {
  page: number; // 1-indexed
  pageSize: number;
  from: number; // inclusive, 0-indexed
  to: number; // inclusive, 0-indexed (for supabase.range())
};

const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 200;

function readFirst(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export function parsePage(
  input: PageInput,
  opts: { defaultSize?: number; maxSize?: number } = {},
): ParsedPage {
  const defaultSize = opts.defaultSize ?? DEFAULT_PAGE_SIZE;
  const maxSize = opts.maxSize ?? MAX_PAGE_SIZE;

  const pageRaw = Number.parseInt(readFirst(input.page) ?? "", 10);
  const sizeRaw = Number.parseInt(readFirst(input.pageSize) ?? "", 10);

  const page =
    Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;
  const pageSize =
    Number.isFinite(sizeRaw) && sizeRaw >= 1
      ? Math.min(Math.floor(sizeRaw), maxSize)
      : defaultSize;

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  return { page, pageSize, from, to };
}

export type PageMeta = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
};

export function pageMeta(
  parsed: ParsedPage,
  totalCount: number,
): PageMeta {
  const totalPages = Math.max(1, Math.ceil(totalCount / parsed.pageSize));
  return {
    page: parsed.page,
    pageSize: parsed.pageSize,
    totalCount,
    totalPages,
    hasPrev: parsed.page > 1,
    hasNext: parsed.page < totalPages,
  };
}

/**
 * The querystring for a given page, preserving every other parameter.
 *
 * This was written by hand in two screens and both copies dropped the rest of
 * the querystring: on a list with filters applied, paging to page 2 silently
 * cleared the filters and showed page 2 of everything. `page` is omitted at 1
 * and `pageSize` at its default so the first page keeps a clean URL.
 */
export function pageLink(
  sp: PageInput & Record<string, string | string[] | undefined>,
  page: number,
  opts: { defaultSize?: number } = {},
): string {
  const defaultSize = opts.defaultSize ?? DEFAULT_PAGE_SIZE;
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(sp)) {
    if (key === "page" || key === "pageSize") continue;
    if (value === undefined) continue;
    for (const v of Array.isArray(value) ? value : [value]) {
      if (v !== "") params.append(key, v);
    }
  }

  if (page > 1) params.set("page", String(page));
  const size = readFirst(sp.pageSize);
  if (size && Number.parseInt(size, 10) !== defaultSize) {
    params.set("pageSize", size);
  }

  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/**
 * Ceiling for a list that fills a `<select>` rather than a screen.
 *
 * These reads have no pager and should not get one — you cannot page a
 * dropdown — but "no pager" had become "no ceiling": every client-picker on
 * every form read the whole `clients` table, and the kanban read every task in
 * the tenant. Set high enough that no real studio reaches it, low enough that
 * a runaway table cannot take a page down.
 *
 * If a list ever does hit this, the fix is a typeahead that queries as you
 * type, not a bigger number.
 */
export const OPTION_LIST_CAP = 500;
