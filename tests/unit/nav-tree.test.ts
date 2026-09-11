import { describe, it, expect } from "vitest";

import {
  nestGroup,
  itemState,
  parseCollapsedGroups,
  serialiseCollapsedGroups,
} from "@/lib/nav-tree";
import { NAV, NAV_BY_ROLE } from "@/lib/roles";

describe("nestGroup", () => {
  it("hangs a module's screens under the module", () => {
    expect(
      nestGroup([
        { key: "finance", href: "/finance" },
        { key: "cashflow", href: "/finance/cashflow" },
        { key: "due", href: "/finance/due" },
        { key: "marketing", href: "/marketing" },
      ]),
    ).toEqual([
      { key: "finance", children: ["cashflow", "due"] },
      { key: "marketing", children: [] },
    ]);
  });

  it("leaves an entry a root when its parent is in another group", () => {
    // The founder's Diretório holds suppliers and accounts while Financeiro
    // sits in Liderança. Indenting them under a parent that is not on screen
    // would be an indent pointing at nothing.
    expect(
      nestGroup([
        { key: "people", href: "/team" },
        { key: "suppliers", href: "/finance/suppliers" },
        { key: "accounts", href: "/finance/accounts" },
      ]),
    ).toEqual([
      { key: "people", children: [] },
      { key: "suppliers", children: [] },
      { key: "accounts", children: [] },
    ]);
  });

  it("requires a path boundary, so a query-string sibling stays a sibling", () => {
    // /projects?type=visual_identity is a filtered view listed ABOVE /projects.
    // Adopting it would render a child before its own parent.
    expect(
      nestGroup([
        { key: "idprojects", href: "/projects?type=visual_identity" },
        { key: "projects", href: "/projects" },
      ]),
    ).toEqual([
      { key: "idprojects", children: [] },
      { key: "projects", children: [] },
    ]);
  });

  it("attaches a grandchild to the root, never a third tier", () => {
    expect(
      nestGroup([
        { key: "a", href: "/a" },
        { key: "b", href: "/a/b" },
        { key: "c", href: "/a/b/c" },
      ]),
    ).toEqual([{ key: "a", children: ["b", "c"] }]);
  });

  it("keeps the order the menu declares", () => {
    expect(
      nestGroup([
        { key: "due", href: "/finance/due" },
        { key: "finance", href: "/finance" },
        { key: "cashflow", href: "/finance/cashflow" },
      ]),
    ).toEqual([{ key: "finance", children: ["due", "cashflow"] }]);
  });
});

describe("itemState", () => {
  it("marks a section as containing the page, not as the page", () => {
    // The bug this exists for: /finance and /finance/due both wearing the
    // solid pill, the menu claiming you are in two places at once.
    expect(itemState("/finance/due", "/finance", true)).toBe("within");
    expect(itemState("/finance/due", "/finance/due", false)).toBe("active");
  });

  it("keeps prefix matching for an entry with no children", () => {
    // /social has its own sub-navigation rendered separately and has to stay
    // lit while inside it.
    expect(itemState("/social/calendar", "/social", false)).toBe("active");
  });

  it("is idle for an unrelated path and for a mere string prefix", () => {
    expect(itemState("/clients", "/finance", true)).toBe("idle");
    // /financeiro is not inside /finance.
    expect(itemState("/financeiro", "/finance", true)).toBe("idle");
  });
});

describe("the collapsed-groups cookie", () => {
  it("round-trips", () => {
    const raw = serialiseCollapsedGroups(["insights", "daily"]);
    expect(parseCollapsedGroups(raw)).toEqual(new Set(["daily", "insights"]));
  });

  it("is empty when absent", () => {
    expect(parseCollapsedGroups(undefined)).toEqual(new Set());
    expect(parseCollapsedGroups("")).toEqual(new Set());
  });

  it("drops anything it did not write", () => {
    // A cookie is user-controlled input. Group names are our own identifiers,
    // so anything else was not put there by us.
    expect(parseCollapsedGroups("daily.<script>.a-b.ok")).toEqual(
      new Set(["daily", "ok"]),
    );
  });
});

describe("against the real menu", () => {
  it("gives the founder's Liderança group a Financeiro section", () => {
    const group = NAV_BY_ROLE.founder.find((g) => g.group === "leadership")!;
    const nodes = nestGroup(
      group.keys.map((k) => ({ key: k, href: NAV[k].href })),
    );
    const finance = nodes.find((n) => n.key === "finance")!;
    expect(finance.children).toEqual([
      "cashflow",
      "entries",
      "due",
      "reconcile",
      "invoicing",
    ]);
    // Commercial and marketing are their own destinations, not finance screens.
    expect(nodes.map((n) => n.key)).toContain("commercial");
    expect(nodes.map((n) => n.key)).toContain("marketing");
  });

  it("nests the accountant's whole finance group, accounts included", () => {
    const group = NAV_BY_ROLE.accountant.find((g) => g.group === "finance")!;
    const nodes = nestGroup(
      group.keys.map((k) => ({ key: k, href: NAV[k].href })),
    );
    const finance = nodes.find((n) => n.key === "finance")!;
    expect(finance.children).toContain("accounts");
    expect(finance.children).toContain("suppliers");
  });

  it("never nests anything under the home screen", () => {
    // "/" is a prefix of everything if the boundary check is ever relaxed.
    for (const groups of Object.values(NAV_BY_ROLE)) {
      for (const group of groups) {
        const nodes = nestGroup(
          group.keys.map((k) => ({ key: k, href: NAV[k].href })),
        );
        for (const node of nodes) {
          if (NAV[node.key].href === "/") expect(node.children).toEqual([]);
        }
      }
    }
  });
});
