import { describe, expect, it } from "vitest";

import en from "../../messages/en.json";
import ptBR from "../../messages/pt-BR.json";
import { PORTAL_DECISIONS, PORTAL_REFUSALS } from "@/lib/portal-approval";

const DICTS = { en, "pt-BR": ptBR } as const;

/**
 * The refusal is rendered from a dynamic key — `t(`refusal.${reason}`)` — which
 * TypeScript cannot see and next-intl throws on at runtime. Same reasoning as
 * tests/unit/social-i18n.test.ts: adding a refusal without its two strings
 * should fail the build, not the client's screen.
 */
describe("portal.engineContent strings", () => {
  for (const [locale, dict] of Object.entries(DICTS)) {
    const scope = (dict as Record<string, any>).portal?.engineContent;

    it(`${locale}: has the engineContent scope`, () => {
      expect(scope).toBeTruthy();
    });

    it(`${locale}: has a string for every refusal the domain can return`, () => {
      const missing = PORTAL_REFUSALS.filter((r) => !scope?.refusal?.[r]);
      expect(missing).toEqual([]);
    });

    it(`${locale}: covers the two extra refusals the action adds`, () => {
      // Not domain refusals — they come from the action (throttle, write
      // failure) but render through the same lookup.
      for (const key of ["rateLimited", "failed"]) {
        expect(scope?.refusal?.[key], key).toBeTruthy();
      }
    });

    it(`${locale}: labels both decisions`, () => {
      expect(PORTAL_DECISIONS).toHaveLength(2);
      expect(scope?.approve).toBeTruthy();
      expect(scope?.requestChanges).toBeTruthy();
    });
  }

  it("carries no refusal string the domain cannot produce", () => {
    const known = new Set<string>([...PORTAL_REFUSALS, "rateLimited", "failed"]);
    const shipped = Object.keys(
      (en as Record<string, any>).portal.engineContent.refusal,
    );
    expect(shipped.filter((k) => !known.has(k))).toEqual([]);
  });

  it("keeps both dictionaries the same shape", () => {
    const shape = (o: Record<string, unknown>) => Object.keys(o).sort();
    const a = (en as Record<string, any>).portal.engineContent;
    const b = (ptBR as Record<string, any>).portal.engineContent;
    expect(shape(a)).toEqual(shape(b));
    expect(shape(a.refusal)).toEqual(shape(b.refusal));
  });
});
