import { describe, it, expect } from "vitest";

import en from "../../messages/en.json";
import ptBR from "../../messages/pt-BR.json";
import { NAV, NAV_BY_ROLE } from "@/lib/roles";

type Dict = Record<string, unknown>;

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
