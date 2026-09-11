/**
 * Shape for the sidebar: which entries are sections and which hang under them,
 * and which one the current page belongs to.
 *
 * The menu was a flat list of pills. Once the finance module grew from one
 * screen to eight, "Financeiro" and its six screens sat at the same level in
 * the same group, reading as seven unrelated destinations — and two of them
 * lit up at once, because /finance prefix-matches /finance/due.
 *
 * Nothing here is new data. The hierarchy is derived from the hrefs the items
 * already have, so a screen added to a module cannot forget to declare its
 * parent.
 */

export type NavEntry = { key: string; href: string };

export type NavNode = {
  key: string;
  /** Keys nested under this one, in their original order. */
  children: string[];
};

/**
 * The longest entry in the group whose href is a path prefix of this one.
 *
 * The `/` boundary is required. Without it `/projects` would adopt
 * `/projects?type=visual_identity` — a sibling filtered view, which the menu
 * lists ABOVE it — and the child would render before its own parent.
 */
function parentOf(entry: NavEntry, all: readonly NavEntry[]): string | null {
  let best: NavEntry | null = null;
  for (const other of all) {
    if (other.key === entry.key) continue;
    if (!entry.href.startsWith(`${other.href}/`)) continue;
    if (!best || other.href.length > best.href.length) best = other;
  }
  return best ? best.key : null;
}

/**
 * Nest a group's keys one level deep.
 *
 * Opt-in per group, and that is the point. Deriving hierarchy from hrefs alone
 * restructured the client portal, where `/portal` is a path prefix of all nine
 * other entries: the whole menu folded under "Visão do projeto", and
 * "Esperando você" — first on purpose, because it is the only screen that asks
 * the client for something — became the second item, indented, in a smaller
 * icon. Correct by the rule and wrong for the person reading it.
 *
 * So the rule is not global. A group says whether it is hierarchical; WITHIN
 * one that does, the shape is still derived, so a screen added to a module
 * cannot forget to declare its parent.
 *
 * One level, deliberately. `/finance/reconcile` under `/finance` is the shape
 * the product has; a third tier in a 256px rail is an indent nobody can read.
 * A grandchild attaches to its nearest ancestor that is itself a root.
 *
 * An entry whose parent is in a DIFFERENT group stays a root — which is what
 * makes the founder's menu right: `suppliers` and `accounts` live under
 * Diretório, away from the Financeiro block, and must not be indented under a
 * parent that is not there.
 */
export function nestGroup(entries: readonly NavEntry[]): NavNode[] {
  const parent = new Map<string, string | null>();
  for (const e of entries) parent.set(e.key, parentOf(e, entries));

  // Collapse a chain: if my parent has a parent, attach to the root.
  const rootOf = (key: string): string | null => {
    let p = parent.get(key) ?? null;
    const seen = new Set<string>([key]);
    while (p && parent.get(p) && !seen.has(p)) {
      seen.add(p);
      p = parent.get(p) ?? null;
    }
    return p;
  };

  const nodes: NavNode[] = [];
  const byKey = new Map<string, NavNode>();

  for (const e of entries) {
    const root = rootOf(e.key);
    if (root === null) {
      const node = { key: e.key, children: [] as string[] };
      nodes.push(node);
      byKey.set(e.key, node);
    }
  }
  for (const e of entries) {
    const root = rootOf(e.key);
    if (root !== null) byKey.get(root)?.children.push(e.key);
  }
  return nodes;
}

export type ItemState = "active" | "within" | "idle";

/**
 * How an entry should read against the current path.
 *
 * `within` exists so a section holding the open screen is marked without
 * wearing the same solid pill as the screen itself. Before this, /finance and
 * /finance/due were both fully highlighted and the menu claimed you were in
 * two places.
 *
 * An entry with no children keeps prefix matching: /social has to stay lit on
 * /social/calendar, whose sub-navigation is rendered separately.
 */
export function itemState(
  pathname: string,
  href: string,
  hasChildren: boolean,
): ItemState {
  if (pathname === href) return "active";
  if (!pathname.startsWith(`${href}/`)) return "idle";
  return hasChildren ? "within" : "active";
}

/** Cookie name for the groups the person has folded away. */
export const NAV_GROUPS_COOKIE = "nest-nav-groups";

/**
 * Read and write the collapsed set as a cookie rather than localStorage.
 *
 * The sidebar's own collapsed state already works this way, for the reason
 * that matters here too: the server renders the menu, so a value only the
 * browser can read means the groups flash open on every navigation before
 * folding shut.
 */
export function parseCollapsedGroups(raw: string | undefined): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(".")
      .map((s) => s.trim())
      // Group names are our own identifiers; anything else in the cookie was
      // not put there by us. Letters and dashes, because the eleven names of
      // today are lowercase but `socialReport` and `content-engine` are the
      // shape the next one takes — and a name this rejected would simply never
      // stay folded, with nothing to show for it.
      .filter((s) => /^[A-Za-z-]{1,32}$/.test(s)),
  );
}

/**
 * One cookie out of a `document.cookie` string.
 *
 * The drawer on a phone unmounts its whole subtree when it closes, so the
 * fold state has to be re-read on each open rather than kept in React. The
 * server prop cannot do it: it is whatever the cookie said on the last
 * navigation, and folding a group is not one.
 */
export function readCookie(jar: string, name: string): string | undefined {
  for (const part of jar.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

export function serialiseCollapsedGroups(groups: Iterable<string>): string {
  return [...new Set(groups)].sort().join(".");
}
