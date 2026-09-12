import { describe, it, expect } from "vitest";

import en from "../../messages/en.json";
import ptBR from "../../messages/pt-BR.json";

type Node = Record<string, unknown>;

function flatten(node: unknown, prefix = ""): string[] {
  if (node === null || typeof node !== "object") return [prefix];
  return Object.entries(node as Node).flatMap(([k, v]) =>
    flatten(v, prefix ? `${prefix}.${k}` : k),
  );
}

/**
 * The two dictionaries, key for key.
 *
 * next-intl throws at render on a missing key, so a string added to one locale
 * and forgotten in the other is not a cosmetic gap — it is a 500 on whichever
 * screen renders it, for whoever has that language set. The founder works in
 * pt-BR and the app also ships English, which is exactly the arrangement where
 * nobody notices for a month.
 *
 * This used to be checked for the `finance` namespace alone, on the grounds
 * that it was the one being changed. Every namespace is the one being changed
 * eventually, and the two files were already in perfect parity — so the wider
 * check costs nothing today and is the only version that keeps being true.
 *
 * Placeholders are checked too: `{count}` renamed on one side and not the
 * other renders the literal brace to the person reading it.
 */
describe("pt-BR and en", () => {
  const enKeys = new Set(flatten(en));
  const ptKeys = new Set(flatten(ptBR));

  it("carry exactly the same keys", () => {
    expect({
      missingFromPtBR: [...enKeys].filter((k) => !ptKeys.has(k)).sort(),
      missingFromEn: [...ptKeys].filter((k) => !enKeys.has(k)).sort(),
    }).toEqual({ missingFromPtBR: [], missingFromEn: [] });
  });

  it("use the same placeholders in every shared string", () => {
    const at = (dict: unknown, path: string): unknown =>
      path.split(".").reduce<unknown>((n, k) => (n as Node)?.[k], dict);
    const names = (s: unknown) =>
      typeof s === "string"
        ? [...s.matchAll(/\{(\w+)[^}]*\}/g)].map((m) => m[1]).sort()
        : [];

    const mismatched: string[] = [];
    for (const key of enKeys) {
      if (!ptKeys.has(key)) continue;
      const a = names(at(en, key));
      const b = names(at(ptBR, key));
      if (a.join(",") !== b.join(",")) {
        mismatched.push(`${key}: en{${a}} vs pt-BR{${b}}`);
      }
    }
    expect(mismatched).toEqual([]);
  });
});
