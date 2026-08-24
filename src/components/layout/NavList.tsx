"use client";

import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import { SocialSubNav, type SubScreen } from "@/components/layout/SocialSubNav";
import { NAV, NAV_BY_ROLE, type AppRole } from "@/lib/roles";

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
  onNavigate,
}: {
  role: AppRole;
  socialScreens: SubScreen[];
  /** Icon-only rail. Never true in the drawer, which always has room. */
  collapsed?: boolean;
  /** The drawer closes itself when you pick something. */
  onNavigate?: () => void;
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const groups = NAV_BY_ROLE[role];

  return (
    <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 pb-4">
      {groups.map((group) => (
        <div key={group.group} className="flex flex-col gap-0.5">
          {!collapsed && (
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-muted">
              {t(`groups.${group.group}`)}
            </p>
          )}
          {group.keys.map((key) => {
            const item = NAV[key];
            const href = item.href;
            const active = pathname === href || pathname.startsWith(`${href}/`);
            const Icon = item.icon;
            const activeCls = active
              ? "bg-sidebar-active text-sidebar-active-foreground"
              : "text-sidebar-foreground/75 hover:bg-white/5 hover:text-sidebar-foreground";
            // The module's own screens hang off its entry rather than a tab
            // row above the page. They open only while you are inside it, so
            // the list stays short everywhere else.
            const showSub =
              key === "social" &&
              !collapsed &&
              socialScreens.length > 0 &&
              (pathname === "/social" || pathname.startsWith("/social/"));

            return (
              <div key={key} className="flex flex-col">
                <Link
                  href={href}
                  onClick={onNavigate}
                  title={collapsed ? t(item.label) : undefined}
                  aria-current={active ? "page" : undefined}
                  className={
                    collapsed
                      ? `grid place-items-center rounded-xl p-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${activeCls}`
                      : `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${activeCls}`
                  }
                >
                  <Icon className={collapsed ? "h-5 w-5" : "h-4 w-4"} />
                  {!collapsed && t(item.label)}
                </Link>
                {showSub ? (
                  <Suspense fallback={null}>
                    <SocialSubNav
                      screens={socialScreens}
                      onNavigate={onNavigate}
                    />
                  </Suspense>
                ) : null}
              </div>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
