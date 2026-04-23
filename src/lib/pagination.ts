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
