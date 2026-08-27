import { describe, expect, it } from "vitest";

import en from "../../messages/en.json";
import ptBR from "../../messages/pt-BR.json";
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_REFUSALS,
} from "@/lib/company-documents";

const DICTS = { en, "pt-BR": ptBR } as const;
const EXPIRY = ["expired", "soon", "ok", "none"] as const;

/**
 * Categories, expiry states and refusals all render through dynamic keys, so
 * next-intl throws at runtime for a missing one and TypeScript cannot see it.
 * Same guard as social-i18n.test.ts.
 */
describe("administration strings", () => {
  for (const [locale, dict] of Object.entries(DICTS)) {
    const scope = (dict as Record<string, any>).administration;

    it(`${locale}: names every category the schema allows`, () => {
      expect(DOCUMENT_CATEGORIES.filter((c) => !scope?.category?.[c])).toEqual([]);
    });

    it(`${locale}: names every expiry state`, () => {
      expect(EXPIRY.filter((e) => !scope?.expiry?.[e])).toEqual([]);
    });

    it(`${locale}: explains every refusal validateDocument can return`, () => {
      expect(DOCUMENT_REFUSALS.filter((r) => !scope?.refusal?.[r])).toEqual([]);
    });

    it(`${locale}: covers the three refusals the actions add`, () => {
      for (const key of ["notFound", "notAllowed", "failed"]) {
        expect(scope?.refusal?.[key], key).toBeTruthy();
      }
    });

    it(`${locale}: labels every field on the form`, () => {
      for (const f of ["title", "category", "url", "validUntil", "notes"]) {
        expect(scope?.fields?.[f], f).toBeTruthy();
      }
    });
  }

  it("ships no category the schema would refuse", () => {
    const shipped = Object.keys(
      (en as Record<string, any>).administration.category,
    );
    expect(
      shipped.filter((c) => !(DOCUMENT_CATEGORIES as readonly string[]).includes(c)),
    ).toEqual([]);
  });

  it("keeps both dictionaries the same shape", () => {
    const shape = (o: Record<string, unknown>) => Object.keys(o).sort();
    const a = (en as Record<string, any>).administration;
    const b = (ptBR as Record<string, any>).administration;
    for (const k of ["category", "expiry", "refusal", "fields"]) {
      expect(shape(a[k]), k).toEqual(shape(b[k]));
    }
  });
});
