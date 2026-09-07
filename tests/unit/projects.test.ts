import { describe, expect, it } from "vitest";

import {
  PROJECT_TYPES,
  PROJECT_STATUSES,
  isProjectType,
  isProjectStatus,
  isActiveStatus,
  isNegotiatingStatus,
  isInternal,
  isLate,
  projectProgress,
} from "@/lib/projects";
import { uniqueSlug, slugify } from "@/lib/slug";

describe("project vocabulary", () => {
  it("holds the seven types the studio sells", () => {
    expect(PROJECT_TYPES).toHaveLength(7);
    expect(PROJECT_TYPES).toContain("visual_identity");
    expect(PROJECT_TYPES).toContain("social_media");
  });

  it("rejects a value that is not one of them", () => {
    expect(isProjectType("website")).toBe(true);
    // The CHECK in 048 would refuse this; the guard means it never gets sent.
    expect(isProjectType("Website")).toBe(false);
    expect(isProjectType("podcast")).toBe(false);
    expect(isProjectType(null)).toBe(false);
  });

  it("knows its five statuses", () => {
    expect(PROJECT_STATUSES).toHaveLength(5);
    expect(isProjectStatus("negotiating")).toBe(true);
    expect(isProjectStatus("finished")).toBe(false);
  });
});

describe("the two leadership counts", () => {
  /**
   * The card says how much is in flight. A paused engagement is not being
   * worked, and counting it inflates the one number that exists to answer
   * that question.
   */
  it("counts active but not paused", () => {
    expect(isActiveStatus("active")).toBe(true);
    expect(isActiveStatus("paused")).toBe(false);
    expect(isActiveStatus("done")).toBe(false);
  });

  it("counts negotiating separately", () => {
    expect(isNegotiatingStatus("negotiating")).toBe(true);
    expect(isNegotiatingStatus("active")).toBe(false);
  });
});

describe("projectProgress", () => {
  it("reports the share of tasks that are done", () => {
    const p = projectProgress(["done", "done", "todo", "in_progress"]);
    expect(p).toEqual({ total: 4, done: 2, open: 2, percent: 50 });
  });

  /**
   * The tempting guard is "no tasks means nothing left to do", which puts a
   * full bar on an engagement nobody has started — the most misleading thing
   * this number could say.
   */
  it("reports 0% for a project with no tasks, not 100%", () => {
    expect(projectProgress([]).percent).toBe(0);
    expect(projectProgress([]).total).toBe(0);
  });

  it("rounds rather than showing a fraction", () => {
    expect(projectProgress(["done", "todo", "todo"]).percent).toBe(33);
  });
});

describe("isLate", () => {
  it("is late once the end date has passed and it is unfinished", () => {
    expect(isLate({ ends_on: "2026-09-01", status: "active" }, "2026-09-07")).toBe(true);
  });

  it("is not late on the day itself", () => {
    expect(isLate({ ends_on: "2026-09-07", status: "active" }, "2026-09-07")).toBe(false);
  });

  it("is never late once done or cancelled", () => {
    expect(isLate({ ends_on: "2026-01-01", status: "done" }, "2026-09-07")).toBe(false);
    expect(isLate({ ends_on: "2026-01-01", status: "cancelled" }, "2026-09-07")).toBe(false);
  });

  it("is never late without an end date", () => {
    expect(isLate({ ends_on: null, status: "active" }, "2026-09-07")).toBe(false);
  });
});

describe("isInternal", () => {
  it("reads a null client as the studio's own work", () => {
    expect(isInternal({ client_id: null })).toBe(true);
    expect(isInternal({ client_id: "abc" })).toBe(false);
  });
});

describe("uniqueSlug", () => {
  it("returns the base when nothing holds it", async () => {
    expect(await uniqueSlug("rebranding", "project", async () => false)).toBe(
      "rebranding",
    );
  });

  it("walks the suffix until one is free", async () => {
    const taken = new Set(["rebranding", "rebranding-2"]);
    expect(
      await uniqueSlug("rebranding", "project", async (s) => taken.has(s)),
    ).toBe("rebranding-3");
  });

  it("falls back when the name is empty", async () => {
    expect(await uniqueSlug("", "project", async () => false)).toBe("project");
  });

  /**
   * The version this replaced was `while (true)` around a database query. A
   * probe that always answers "taken" — a broken filter, an RLS policy hiding
   * the very row being checked for — span against the database forever inside
   * a server action. Finite and ugly beats infinite.
   */
  it("gives up rather than looping forever against a probe that never yields", async () => {
    const slug = await uniqueSlug("x", "project", async () => true, 5);
    expect(slug).toMatch(/^x-[a-z0-9]{6}$/);
  });

  it("composes with slugify the way the actions use it", async () => {
    const slug = await uniqueSlug(
      slugify("Identidade Visual · Nayara"),
      "project",
      async () => false,
    );
    expect(slug).toBe("identidade-visual-nayara");
  });
});
