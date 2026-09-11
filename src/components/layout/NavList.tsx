"use client";

import { Suspense, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import { SocialSubNav, type SubScreen } from "@/components/layout/SocialSubNav";
import { NAV, NAV_BY_ROLE, type AppRole } from "@/lib/roles";
import {
  nestGroup,
  itemState,
  serialiseCollapsedGroups,
  NAV_GROUPS_COOKIE,
  type ItemState,
} from "@/lib/nav-tree";

function GroupChevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-3 w-3 shrink-0 transition-transform duration-150 ${
        open ? "" : "-rotate-90"
      }`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

const TONE: Record<ItemState, string> = {
  active: "bg-sidebar-active text-sidebar-active-foreground",
  // A section holding the open screen, marked without wearing the screen's own
  // pill. A wash rather than the solid fill: present, but not the destination.
  within: "bg-white/[0.06] text-sidebar-foreground hover:bg-white/10",
  idle: "text-sidebar-foreground/75 hover:bg-white/5 hover:text-sidebar-foreground",
};

/**
 * The role's navigation, rendered once and used twice: by the desktop sidebar
 * and by the drawer that stands in for it on a phone.
 *
 * It was written out only once before, in the sidebar — which is why there was
 * no phone navigation at all: adding one meant either copying this or building
 * it. A copy would have drifted the first time a group changed.
 */
export function NavList({
  role,
  socialScreens,
  collapsed = false,
  initialCollapsedGroups,
  onNavigate,
}: {
  role: AppRole;
  socialScreens: SubScreen[];
  /** Icon-only rail. Never true in the drawer, which always has room. */
  collapsed?: boolean;
  /** Groups folded away, from the cookie the server already read. */
  initialCollapsedGroups?: readonly string[];
  /** The drawer closes itself when you pick something. */
  onNavigate?: () => void;
}) {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const pathname = usePathname();
  const groups = NAV_BY_ROLE[role];

  const [folded, setFolded] = useState<Set<string>>(
    () => new Set(initialCollapsedGroups ?? []),
  );

  function toggleGroup(group: string) {
    setFolded((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      // Same mechanism the sidebar's own width uses, and for the same reason:
      // the menu is rendered on the server, so a value only the browser can
      // read would let every group flash open on each navigation before
      // folding shut again.
      document.cookie = `${NAV_GROUPS_COOKIE}=${serialiseCollapsedGroups(
        next,
      )}; path=/; max-age=31536000; samesite=lax`;
      return next;
    });
  }

  // The tree, resolved once and read by Entry to know which entries are
  // sections. Derived from the hrefs the items already carry — see nav-tree.
  const shaped = groups.map((group) => ({
    group,
    nodes: nestGroup(group.keys.map((k) => ({ key: k, href: NAV[k].href }))),
  }));
  const childrenOf = new Map<string, string[]>();
  for (const { nodes } of shaped) {
    for (const node of nodes) childrenOf.set(node.key, node.children);
  }

  function Entry({ itemKey, depth }: { itemKey: string; depth: 0 | 1 }) {
    const item = NAV[itemKey];
    const href = item.href;
    const hasChildren = depth === 0 && (childrenOf.get(itemKey)?.length ?? 0) > 0;
    const state = itemState(pathname, href, hasChildren);
    const Icon = item.icon;

    // The module's own screens hang off its entry rather than a tab row above
    // the page. They open only while you are inside it, so the list stays
    // short everywhere else.
    const showSub =
      itemKey === "social" &&
      !collapsed &&
      socialScreens.length > 0 &&
      (pathname === "/social" || pathname.startsWith("/social/"));

    return (
      <div className="flex flex-col">
        <Link
          href={href}
          onClick={onNavigate}
          title={collapsed ? t(item.label) : undefined}
          aria-current={state === "active" ? "page" : undefined}
          className={
            collapsed
              ? `grid place-items-center rounded-xl p-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${TONE[state]}`
              : `flex items-center gap-3 rounded-xl py-2 pr-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  depth === 1 ? "pl-4 font-normal" : "pl-3 font-medium"
                } ${TONE[state]}`
          }
        >
          {/* The guide rail. A child's indent alone reads as a rendering
              accident at this width; a line that runs the height of the
              section says the item belongs to the one above it. */}
          {depth === 1 && !collapsed ? (
            <span
              aria-hidden="true"
              className={`-my-2 w-px self-stretch ${
                state === "active" ? "bg-sidebar-active-foreground/40" : "bg-white/10"
              }`}
            />
          ) : null}
          <Icon
            className={
              collapsed ? "h-5 w-5" : depth === 1 ? "h-3.5 w-3.5" : "h-4 w-4"
            }
          />
          {!collapsed && t(item.label)}
        </Link>
        {showSub ? (
          <Suspense fallback={null}>
            <SocialSubNav screens={socialScreens} onNavigate={onNavigate} />
          </Suspense>
        ) : null}
      </div>
    );
  }

  return (
    <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 pb-4">
      {shaped.map(({ group, nodes }) => {
        const open = !folded.has(group.group);
        // A folded group still has to admit it holds the open screen, or
        // navigating into one makes the current page vanish from the menu.
        const holdsCurrent = group.keys.some(
          (k) => itemState(pathname, NAV[k].href, false) === "active",
        );
        const panelId = `nav-${group.group}`;

        return (
          <div key={group.group} className="flex flex-col gap-0.5">
            {collapsed ? null : (
              <button
                type="button"
                onClick={() => toggleGroup(group.group)}
                aria-expanded={open}
                aria-controls={panelId}
                aria-label={tCommon("toggleGroup", {
                  group: t(`groups.${group.group}`),
                })}
                className="group/heading flex w-full items-center gap-1.5 rounded-lg px-3 pb-1 pt-0.5 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-muted transition-colors hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <GroupChevron open={open} />
                <span className="truncate">{t(`groups.${group.group}`)}</span>
                {!open && holdsCurrent ? (
                  <span
                    aria-hidden="true"
                    className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-sidebar-active"
                  />
                ) : null}
              </button>
            )}

            {/* Rendered even when folded, rather than dropped: the heading's
                aria-controls has to point at an element that exists. Collapsed
                to the icon rail there is no heading to click, so the groups
                stay open — folding them there would hide items behind a
                control that is not on screen. */}
            <div
              id={panelId}
              hidden={!open && !collapsed}
              // The `hidden` attribute alone would not hide it: Tailwind's
              // preflight `[hidden]{display:none}` and the `flex` utility have
              // the same specificity, and utilities come later in the sheet —
              // so the class wins and the "hidden" panel stays on screen. The
              // attribute stays for what it is actually good at, which is
              // telling a screen reader the section is folded.
              className={`${open || collapsed ? "flex" : "hidden"} flex-col gap-0.5`}
            >
              {nodes.map((node) => (
                <div key={node.key} className="flex flex-col gap-0.5">
                  <Entry itemKey={node.key} depth={0} />
                  {node.children.map((childKey) => (
                    <Entry key={childKey} itemKey={childKey} depth={1} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
