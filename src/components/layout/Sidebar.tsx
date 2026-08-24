"use client";

import { Suspense, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import { NestMark } from "@/components/icons/NestMark";
import { RolePreview } from "@/components/layout/RolePreview";
import { SignOutButton } from "@/components/layout/SignOutButton";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import {
  NotificationsBell,
  type NotificationItem,
} from "@/components/layout/NotificationsBell";
import {
  SocialSubNav,
  type SubScreen,
} from "@/components/layout/SocialSubNav";
import { NAV, NAV_BY_ROLE, type AppRole } from "@/lib/roles";
import type { Theme } from "@/lib/theme";

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points={dir === "left" ? "15 18 9 12 15 6" : "9 18 15 12 9 6"} />
    </svg>
  );
}

export function Sidebar({
  theme,
  locale,
  profileName,
  role,
  actualRole,
  viewRole,
  notifications,
  unreadCount,
  initialCollapsed,
  socialScreens,
}: {
  theme: Theme;
  locale: string;
  profileName: string;
  role: AppRole;
  actualRole: AppRole;
  viewRole: AppRole | null;
  notifications: NotificationItem[];
  unreadCount: number;
  initialCollapsed: boolean;
  /** The social module's screens, rendered as sub-items while inside it. */
  socialScreens: SubScreen[];
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const groups = NAV_BY_ROLE[role];
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `nest-sidebar=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <aside
      className={`flex h-screen shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200 ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Header: wordmark + collapse toggle */}
      <div
        className={`flex items-center px-3 py-5 ${
          collapsed ? "flex-col gap-3" : "justify-between pl-5"
        }`}
      >
        {collapsed ? (
          <NestMark className="h-6 w-6 text-brand-soft" />
        ) : (
          <div className="flex items-center gap-2">
            <NestMark className="h-6 w-6 text-brand-soft" />
            <span className="font-display text-2xl lowercase tracking-tight text-brand-soft">
              {theme === "afm" ? "AFM" : "nest"}
            </span>
          </div>
        )}
        <button
          onClick={toggle}
          aria-label="Toggle sidebar"
          className="grid h-7 w-7 place-items-center rounded-lg text-sidebar-foreground/60 hover:bg-white/5 hover:text-sidebar-foreground"
        >
          <Chevron dir={collapsed ? "right" : "left"} />
        </button>
      </div>

      {/* Role-based nav */}
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
              const active =
                pathname === href || pathname.startsWith(`${href}/`);
              const Icon = item.icon;
              const activeCls = active
                ? "bg-sidebar-active text-sidebar-active-foreground"
                : "text-sidebar-foreground/75 hover:bg-white/5 hover:text-sidebar-foreground";
              // The module's own screens hang off its entry rather than a tab
              // row above the page. They open only while you are inside it, so
              // the sidebar stays short everywhere else.
              const showSub =
                key === "social" &&
                !collapsed &&
                socialScreens.length > 0 &&
                (pathname === "/social" || pathname.startsWith("/social/"));

              return (
                <div key={key} className="flex flex-col">
                  <Link
                    href={href}
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
                      <SocialSubNav screens={socialScreens} />
                    </Suspense>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div
        className={`space-y-3 border-t border-sidebar-border py-4 ${
          collapsed ? "flex flex-col items-center gap-3 px-2" : "px-4"
        }`}
      >
        {collapsed ? (
          <>
            <NotificationsBell
              locale={locale}
              notifications={notifications}
              unreadCount={unreadCount}
            />
            <SignOutButton />
          </>
        ) : (
          <>
            <RolePreview actualRole={actualRole} current={viewRole} />
            <div className="flex items-center justify-between">
              <p className="min-w-0 flex-1 truncate text-xs text-sidebar-foreground/60">
                {profileName}
              </p>
              <div className="flex items-center gap-1">
                <NotificationsBell
                  locale={locale}
                  notifications={notifications}
                  unreadCount={unreadCount}
                />
                <LanguageSwitcher />
                <SignOutButton />
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
