import { describe, it, expect } from "vitest";

import en from "../../messages/en.json";
import ptBR from "../../messages/pt-BR.json";
import { NAV, NAV_BY_ROLE } from "@/lib/roles";

type Dict = Record<string, unknown>;

function flatten(node: unknown, prefix = ""): string[] {
  if (node === null || typeof node !== "object") return [prefix];
  return Object.entries(node as Dict).flatMap(([k, v]) =>
    flatten(v, prefix ? `${prefix}.${k}` : k),
  );
}

/**
 * The finance module's strings, in both languages, or not at all.
 *
 * next-intl throws at render on a missing key, and most of these live on
 * screens only two people ever open — so a key added to pt-BR and forgotten in
 * en is a 500 nobody sees until the accountant switches language. The module
 * gained three screens and about a hundred strings at once; this is the check
 * that keeps the two files the same shape.
 */
describe("finance strings", () => {
  it("has the same keys in both languages", () => {
    const a = new Set(flatten((en as Dict).finance));
    const b = new Set(flatten((ptBR as Dict).finance));
    const onlyEn = [...a].filter((k) => !b.has(k));
    const onlyPt = [...b].filter((k) => !a.has(k));
    expect({ onlyEn, onlyPt }).toEqual({ onlyEn: [], onlyPt: [] });
  });
});

/**
 * Every menu entry can name itself.
 *
 * The sidebar renders `t(`nav.${item.label}`)` for whatever role is logged in.
 * A new screen wired into NAV_BY_ROLE without its label is a crash on the
 * layout — every page for that role, not just the new one.
 */
describe("navigation labels", () => {
  const used = new Set(
    Object.values(NAV_BY_ROLE).flatMap((groups) =>
      groups.flatMap((g) => g.keys),
    ),
  );

  for (const [name, dict] of [
    ["en", en],
    ["pt-BR", ptBR],
  ] as const) {
    it(`${name} names every menu entry and group`, () => {
      const nav = (dict as Dict).nav as Record<string, unknown>;
      const groups = nav.groups as Record<string, string>;

      const missing: string[] = [];
      for (const key of used) {
        const item = NAV[key];
        expect(item, `NAV has no entry for "${key}"`).toBeTruthy();
        if (!nav[item.label]) missing.push(`nav.${item.label}`);
      }
      for (const g of new Set(
        Object.values(NAV_BY_ROLE).flatMap((gs) => gs.map((x) => x.group)),
      )) {
        if (!groups[g]) missing.push(`nav.groups.${g}`);
      }
      expect(missing).toEqual([]);
    });
  }
});
