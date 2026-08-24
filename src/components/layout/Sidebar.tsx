"use client";

import { useState } from "react";
import { NestMark } from "@/components/icons/NestMark";
import { RolePreview } from "@/components/layout/RolePreview";
import { SignOutButton } from "@/components/layout/SignOutButton";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import {
  NotificationsBell,
  type NotificationItem,
} from "@/components/layout/NotificationsBell";
import { NavList } from "@/components/layout/NavList";
import type { SubScreen } from "@/components/layout/SocialSubNav";
import type { AppRole } from "@/lib/roles";
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
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `nest-sidebar=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <aside
      className={`hidden h-screen shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:flex ${
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

      <NavList
        role={role}
        socialScreens={socialScreens}
        collapsed={collapsed}
      />

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
