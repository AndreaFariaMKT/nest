"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import type { Route } from "next";

export interface SubScreen {
  key: string;
  href: string;
}

/**
 * The social module's screens, as sub-items of the sidebar's own entry.
 *
 * They used to be a horizontal tab row above every screen, which wrapped onto
 * two lines at pt-BR label lengths once the module reached thirteen of them.
 * A sidebar has a whole column to spend and only shows these while you are
 * inside the module.
 *
 * The `?client=` filter is threaded through every link on purpose. Picking a
 * client on the backlog and clicking to the fortnight should not silently
 * widen back to every client — that was the tab row's job, and dropping it
 * here would have quietly lost it.
 *
 * Isolated in its own component so `useSearchParams` has a Suspense boundary
 * of its own: reading it in the Sidebar itself would opt every route that
 * renders the layout out of static rendering.
 */
export function SocialSubNav({ screens }: { screens: SubScreen[] }) {
  const t = useTranslations("social");
  const pathname = usePathname();
  const params = useSearchParams();

  const client = params.get("client");
  const suffix = client ? `?client=${encodeURIComponent(client)}` : "";

  return (
    <div
      data-testid="social-nav"
      className="ml-4 mt-0.5 flex flex-col gap-0.5 border-l border-sidebar-border pl-3"
    >
      {screens.map((s) => {
        const active =
          pathname === s.href ||
          (s.href !== "/social" && pathname.startsWith(`${s.href}/`));
        return (
          <Link
            key={s.key}
            href={`${s.href}${suffix}` as Route}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-3 py-1.5 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              active
                ? "bg-sidebar-active/60 text-sidebar-active-foreground"
                : "text-sidebar-foreground/60 hover:bg-white/5 hover:text-sidebar-foreground"
            }`}
          >
            {t(`screens.${s.key}`)}
          </Link>
        );
      })}
    </div>
  );
}
