import { describe, expect, it } from "vitest";
import { pageMeta, parsePage } from "@/lib/pagination";

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
