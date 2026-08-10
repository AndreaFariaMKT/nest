"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import { NestMark } from "@/components/icons/NestMark";
import {
  CalendarIcon,
  ChartIcon,
  ClientsIcon,
  ContentIcon,
  HomeIcon,
  MeetingsIcon,
  PaletteIcon,
  ProjectsIcon,
  ServicesIcon,
  SettingsIcon,
  TeamIcon,
} from "@/components/icons/NavIcons";
import { ViewAsSwitcher } from "@/components/layout/ViewAsSwitcher";
import { SignOutButton } from "@/components/layout/SignOutButton";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import {
  NotificationsBell,
  type NotificationItem,
} from "@/components/layout/NotificationsBell";
import type { Theme } from "@/lib/theme";
import type { ViewAsRole } from "@/lib/view-as";

type Item = { href: string; icon: typeof HomeIcon; key: string };
type Group = { label: string; items: Item[] };

const groups: Group[] = [
  {
    label: "daily",
    items: [
      { href: "/today", icon: HomeIcon, key: "today" },
      { href: "/calendar", icon: CalendarIcon, key: "calendar" },
      { href: "/meetings", icon: MeetingsIcon, key: "meetings" },
    ],
  },
  {
    label: "work",
    items: [
      { href: "/projects", icon: ProjectsIcon, key: "projects" },
      { href: "/clients", icon: ClientsIcon, key: "clients" },
      { href: "/services", icon: ServicesIcon, key: "services" },
    ],
  },
  {
    label: "content",
    items: [
      { href: "/content-engine", icon: ContentIcon, key: "contentEngine" },
      { href: "/brand-kits", icon: PaletteIcon, key: "brandKits" },
    ],
  },
  {
    label: "insights",
    items: [{ href: "/reports", icon: ChartIcon, key: "reports" }],
  },
  {
    label: "directory",
    items: [
      { href: "/team", icon: TeamIcon, key: "team" },
      { href: "/settings", icon: SettingsIcon, key: "settings" },
    ],
  },
];

export function Sidebar({
  theme,
  locale,
  profileName,
  profileRole,
  viewAs,
  notifications,
  unreadCount,
}: {
  theme: Theme;
  locale: string;
  profileName: string;
  profileRole: string;
  viewAs: ViewAsRole | null;
  notifications: NotificationItem[];
  unreadCount: number;
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
      {/* Wordmark */}
      <div className="flex items-center gap-2 px-5 py-5">
        <NestMark className="h-6 w-6 text-brand-soft" />
        <span className="font-display text-2xl lowercase tracking-tight text-brand-soft">
          {theme === "afm" ? "AFM" : "nest"}
        </span>
      </div>

      {/* Grouped nav */}
      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 pb-4">
        {groups.map((group) => (
          <div key={group.label} className="flex flex-col gap-0.5">
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-muted">
              {t(`groups.${group.label}`)}
            </p>
            {group.items.map(({ href, icon: Icon, key }) => {
              const active =
                pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  className={
                    active
                      ? "flex items-center gap-3 rounded-xl bg-sidebar-active px-3 py-2 text-sm font-medium text-sidebar-active-foreground"
                      : "flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-sidebar-foreground/75 transition-colors hover:bg-white/5 hover:text-sidebar-foreground"
                  }
                >
                  <Icon className="h-4 w-4" />
                  {t(key)}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer: view-as + utilities + identity */}
      <div className="space-y-3 border-t border-sidebar-border px-4 py-4">
        <ViewAsSwitcher
          actualRole={profileRole}
          current={viewAs}
          name={profileName}
        />
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
