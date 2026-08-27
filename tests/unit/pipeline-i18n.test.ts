import { describe, expect, it } from "vitest";

import en from "../../messages/en.json";
import ptBR from "../../messages/pt-BR.json";
import {
  PIPELINE_MOVES,
  PIPELINE_REFUSALS,
  PIPELINE_STAGES,
} from "@/lib/pipeline";

const DICTS = { en, "pt-BR": ptBR } as const;

/**
 * The board renders every stage, move and refusal through a dynamic key, which
 * TypeScript cannot see and next-intl throws on. Same guard as
 * social-i18n.test.ts: adding a stage without its strings should fail here, not
 * in front of whoever opens the funnel.
 */
describe("commercial.pipeline strings", () => {
  for (const [locale, dict] of Object.entries(DICTS)) {
    const scope = (dict as Record<string, any>).commercial?.pipeline;

    it(`${locale}: names every stage`, () => {
      expect(PIPELINE_STAGES.filter((s) => !scope?.stage?.[s])).toEqual([]);
    });

    it(`${locale}: labels every move`, () => {
      expect(PIPELINE_MOVES.filter((m) => !scope?.move?.[m])).toEqual([]);
    });

    it(`${locale}: explains every refusal the domain can return`, () => {
      expect(PIPELINE_REFUSALS.filter((r) => !scope?.refusal?.[r])).toEqual([]);
    });

    it(`${locale}: covers the three refusals the action adds`, () => {
      // Not domain refusals: the row was not found, RLS declined, or the
      // write failed. They render through the same lookup.
      for (const key of ["notFound", "notAllowed", "failed"]) {
        expect(scope?.refusal?.[key], key).toBeTruthy();
      }
    });
  }

  it("ships no stage the domain does not have — 'won' is the conversion", () => {
    const shipped = Object.keys(
      (en as Record<string, any>).commercial.pipeline.stage,
    );
    expect(shipped.filter((s) => !(PIPELINE_STAGES as readonly string[]).includes(s))).toEqual([]);
    expect(shipped).not.toContain("won");
  });

  it("keeps both dictionaries the same shape", () => {
    const shape = (o: Record<string, unknown>) => Object.keys(o).sort();
    const a = (en as Record<string, any>).commercial.pipeline;
    const b = (ptBR as Record<string, any>).commercial.pipeline;
    for (const k of ["stage", "move", "refusal"]) {
      expect(shape(a[k]), k).toEqual(shape(b[k]));
    }
  });
});
