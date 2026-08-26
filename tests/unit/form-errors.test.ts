import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

import en from "../../messages/en.json";
import ptBR from "../../messages/pt-BR.json";
import { DB_ERRORS } from "@/lib/db-error";

const ACTIONS = [
  "clients/actions.ts",
  "clients/[slug]/brand-kit/actions.ts",
  "clients/[slug]/contracts/actions.ts",
  "projects/actions.ts",
  "meetings/actions.ts",
  "services/actions.ts",
  "content-engine/actions.ts",
];

/**
 * A failed save used to render Postgres's own words — "new row violates
 * row-level security policy for table tasks" — in English, inside a
 * Portuguese form. db-error.ts exists to turn that into a key, and had only
 * ever been wired into the social module.
 */
describe("form refusals", () => {
  it("no action returns a raw Postgres message", () => {
    for (const file of ACTIONS) {
      const source = readFileSync(
        `${process.cwd()}/src/app/[locale]/(app)/${file}`,
        "utf8",
      );
      expect(source, file).not.toContain("error: error.message");
    }
  });

  it("every SQLSTATE key it can emit is named in both locales", () => {
    for (const [name, dict] of [
      ["en", en],
      ["pt-BR", ptBR],
    ] as const) {
      const copy = (dict.common as { db: Record<string, string> }).db;
      for (const key of DB_ERRORS) {
        expect(copy[key], `${name} · common.db.${key}`).toBeTruthy();
      }
    }
  });
});

const SILENT_WRITES = [
  "clients/[slug]/services-actions.ts",
  "clients/[slug]/members-actions.ts",
];

/**
 * These were `Promise<void>` with the write's error discarded. Under RLS a
 * refusal is indistinguishable from a success — the row simply does not
 * appear — and the Kanban board made it worse by moving the card first, so a
 * refused drag looked like it worked until the next refresh put it back.
 */
describe("writes that used to fail silently", () => {
  it("returns a result instead of void", () => {
    for (const file of SILENT_WRITES) {
      const source = readFileSync(
        `${process.cwd()}/src/app/[locale]/(app)/${file}`,
        "utf8",
      );
      expect(source, file).not.toContain("): Promise<void> {");
      expect(source, file).toContain("dbError(");
    }
  });

  it("the board reports a refused drag", () => {
    const board = readFileSync(
      `${process.cwd()}/src/app/[locale]/(app)/projects/_components/KanbanBoard.tsx`,
      "utf8",
    );
    expect(board).toContain("const result = await updateTaskStatusAction(fd)");
    expect(board).toContain("<FormError error={error} />");
  });
});

/**
 * Four writes and reads that reported success, or nothing, when they failed.
 * Each has a different consequence and all four were invisible.
 */
describe("failures that used to be silent", () => {
  const read = (p: string) =>
    readFileSync(`${process.cwd()}/${p}`, "utf8");

  it("the publish cron notices when it cannot record its own post", () => {
    // The carousel is already public here. A row left `pending` after a
    // successful publish is republished the next morning, daily.
    const source = read("src/app/api/cron/publish/route.ts");
    expect(source).toContain("mark_published_failed");
    expect(source).toContain("published_post_insert_failed");
  });

  it("a monthly report that did not save says so", () => {
    // Every other failure path in that action redirects with ?report=failed
    // precisely so a spent Opus call cannot look like a success. The last
    // step landed on the plain client page instead.
    const source = read("src/app/[locale]/(app)/reports/actions.ts");
    expect(source).toContain('if (upsertError || !upserted?.id)');
  });

  it("a broken metrics collector reports failure, not an empty day", () => {
    const source = read("src/app/api/cron/metrics-collect/route.ts");
    expect(source).toContain("stale_posts_unavailable");
  });

  it("a failed piece read does not render as an empty shelf", () => {
    const source = read("src/app/[locale]/(app)/social/_data.ts");
    expect(source).toContain("throw new Error(`listPieces failed on page");
    expect(source).not.toContain("if (error) break;");
  });
});
