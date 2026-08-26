"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { usePathname } from "@/i18n/routing";
import { BrandMark } from "@/components/icons/Brand";
import { NavList } from "@/components/layout/NavList";
import { RolePreview } from "@/components/layout/RolePreview";
import { SignOutButton } from "@/components/layout/SignOutButton";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import {
  NotificationsBell,
  type NotificationItem,
} from "@/components/layout/NotificationsBell";
import type { SubScreen } from "@/components/layout/SocialSubNav";
import type { AppRole } from "@/lib/roles";
import type { Theme } from "@/lib/theme";

/**
 * Navigation for a phone.
 *
 * The app had none: the sidebar was a fixed 256px column at every width, so on
 * a 375px screen the content had about fifty pixels. That is survivable on the
 * studio's own screens, where everyone is at a desk — and not survivable in
 * the client portal, which people open from the link in an email, on a phone,
 * to press Approve.
 *
 * Same NavList the sidebar renders, in a drawer.
 */
export function MobileNav({
  theme,
  tenantName,
  locale,
  profileName,
  role,
  actualRole,
  viewRole,
  notifications,
  unreadCount,
  socialScreens,
}: {
  theme: Theme;
  tenantName: string;
  locale: string;
  profileName: string;
  role: AppRole;
  actualRole: AppRole;
  viewRole: AppRole | null;
  notifications: NotificationItem[];
  unreadCount: number;
  socialScreens: SubScreen[];
}) {
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Navigating with the drawer open would leave it covering the page it just
  // took you to.
  useEffect(() => setOpen(false), [pathname]);

  // A drawer that scrolls the page behind it reads as broken on iOS.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <header className="relative flex items-center gap-2 border-b border-border bg-sidebar px-3 py-2.5 text-sidebar-foreground md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={tCommon("openMenu")}
          aria-expanded={open}
          className="grid h-9 w-9 place-items-center rounded-lg text-sidebar-foreground/70 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>

        {/* Centred on the bar, not on the gap between the menu button and
            the icons — those two sides are different widths. */}
        <span className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 items-center">
          <BrandMark
            theme={theme}
            className="h-5 w-auto text-brand-soft"
            aria-label={tenantName}
          />
        </span>

        <span className="ml-auto flex items-center gap-1">
          <NotificationsBell
            locale={locale}
            notifications={notifications}
            unreadCount={unreadCount}
          />
          <SignOutButton />
        </span>
      </header>

      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label={tCommon("closeMenu")}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/50"
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-sidebar text-sidebar-foreground shadow-xl">
            <div className="flex items-center justify-between px-4 py-4">
              <span className="flex items-center gap-2">
                <BrandMark
                  theme={theme}
                  className="h-5 w-auto text-brand-soft"
                  aria-label={tenantName}
                />
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={tCommon("closeMenu")}
                className="grid h-8 w-8 place-items-center rounded-lg text-sidebar-foreground/60 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <NavList
              role={role}
              socialScreens={socialScreens}
              onNavigate={() => setOpen(false)}
            />

            <div className="space-y-3 border-t border-sidebar-border px-4 py-4">
              <RolePreview actualRole={actualRole} current={viewRole} />
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 flex-1 truncate text-xs text-sidebar-foreground/60">
                  {profileName}
                </p>
                <LanguageSwitcher />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
