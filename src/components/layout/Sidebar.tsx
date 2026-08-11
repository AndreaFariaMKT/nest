"use client";

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
import { NAV, NAV_BY_ROLE, type AppRole } from "@/lib/roles";
import type { Theme } from "@/lib/theme";

export function Sidebar({
  theme,
  locale,
  profileName,
  role,
  actualRole,
  viewRole,
  notifications,
  unreadCount,
}: {
  theme: Theme;
  locale: string;
  profileName: string;
  role: AppRole;
  actualRole: AppRole;
  viewRole: AppRole | null;
  notifications: NotificationItem[];
  unreadCount: number;
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const groups = NAV_BY_ROLE[role];

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
      {/* Wordmark */}
      <div className="flex items-center gap-2 px-5 py-5">
        <NestMark className="h-6 w-6 text-brand-soft" />
        <span className="font-display text-2xl lowercase tracking-tight text-brand-soft">
          {theme === "afm" ? "AFM" : "nest"}
        </span>
      </div>

      {/* Role-based nav */}
      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 pb-4">
        {groups.map((group) => (
          <div key={group.group} className="flex flex-col gap-0.5">
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-muted">
              {t(`groups.${group.group}`)}
            </p>
            {group.keys.map((key) => {
              const item = NAV[key];
              const href = item.href;
              const active =
                pathname === href || pathname.startsWith(`${href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={key}
                  href={href}
                  className={
                    active
                      ? "flex items-center gap-3 rounded-xl bg-sidebar-active px-3 py-2 text-sm font-medium text-sidebar-active-foreground"
                      : "flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-sidebar-foreground/75 transition-colors hover:bg-white/5 hover:text-sidebar-foreground"
                  }
                >
                  <Icon className="h-4 w-4" />
                  {t(item.label)}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="space-y-3 border-t border-sidebar-border px-4 py-4">
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
      </div>
    </aside>
  );
}
