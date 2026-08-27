import { describe, expect, it } from "vitest";
import { pageMeta, parsePage, pageLink } from "@/lib/pagination";

describe("parsePage", () => {
  it("defaults to page 1 + 30-per-page when params are missing", () => {
    expect(parsePage({})).toEqual({ page: 1, pageSize: 30, from: 0, to: 29 });
  });

  it("respects ?page + ?pageSize", () => {
    expect(parsePage({ page: "3", pageSize: "10" })).toEqual({
      page: 3,
      pageSize: 10,
      from: 20,
      to: 29,
    });
  });

  it("ignores invalid inputs and falls back to defaults", () => {
    expect(parsePage({ page: "foo", pageSize: "-5" })).toEqual({
      page: 1,
      pageSize: 30,
      from: 0,
      to: 29,
    });
  });

  it("accepts an array input (first element wins)", () => {
    expect(parsePage({ page: ["2", "5"] }).page).toBe(2);
  });

  it("clamps pageSize to maxSize", () => {
    const parsed = parsePage(
      { pageSize: "1000" },
      { defaultSize: 20, maxSize: 50 },
    );
    expect(parsed.pageSize).toBe(50);
  });

  it("honors a custom defaultSize", () => {
    expect(parsePage({}, { defaultSize: 10 }).pageSize).toBe(10);
  });
});

describe("pageMeta", () => {
  it("computes totalPages = ceil(total / size)", () => {
    const meta = pageMeta(parsePage({ page: "1", pageSize: "10" }), 25);
    expect(meta.totalPages).toBe(3);
    expect(meta.hasPrev).toBe(false);
    expect(meta.hasNext).toBe(true);
  });

  it("marks hasNext=false on the last page", () => {
    const meta = pageMeta(parsePage({ page: "3", pageSize: "10" }), 25);
    expect(meta.hasNext).toBe(false);
    expect(meta.hasPrev).toBe(true);
  });

  it("totalPages never drops below 1 even with zero rows", () => {
    expect(pageMeta(parsePage({}), 0).totalPages).toBe(1);
  });
});

describe("pageLink", () => {
  it("keeps every other filter when paging", () => {
    // The regression this helper exists for: both hand-rolled copies built the
    // link from scratch, so paging a filtered list cleared the filters and
    // showed page 2 of everything.
    const link = pageLink(
      { client: "acme", status: "review", page: "1" },
      2,
      { defaultSize: 30 },
    );
    const qs = new URLSearchParams(link.slice(1));
    expect(qs.get("client")).toBe("acme");
    expect(qs.get("status")).toBe("review");
    expect(qs.get("page")).toBe("2");
  });

  it("omits page=1 so the first page keeps a clean URL", () => {
    expect(pageLink({}, 1)).toBe("");
  });

  it("keeps a non-default pageSize across pages", () => {
    const qs = new URLSearchParams(
      pageLink({ pageSize: "100" }, 3, { defaultSize: 30 }).slice(1),
    );
    expect(qs.get("pageSize")).toBe("100");
    expect(qs.get("page")).toBe("3");
  });

  it("drops a pageSize that already is the default", () => {
    expect(pageLink({ pageSize: "30" }, 1, { defaultSize: 30 })).toBe("");
  });

  it("preserves repeated params rather than collapsing them", () => {
    const qs = new URLSearchParams(
      pageLink({ tag: ["a", "b"] }, 2).slice(1),
    );
    expect(qs.getAll("tag")).toEqual(["a", "b"]);
  });
});
