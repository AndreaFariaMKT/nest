"use client";

import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/routing";
import { Link } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import type { Route } from "next";

export interface ScreenLink {
  key: string;
  href: string;
  /** Count shown as a badge; 0 hides it. */
  badge?: number;
}

export interface ClientOption {
  slug: string;
  name: string;
}

/**
 * The module's own navigation. It carries the client filter across screens —
 * picking "Helem" on the backlog and clicking through to the fortnight should
 * not silently widen back to every client.
 */
export function ModuleNav({
  screens,
  clients,
  currentClient,
}: {
  screens: ScreenLink[];
  clients: ClientOption[];
  currentClient: string;
}) {
  const t = useTranslations("social");
  const router = useRouter();
  const pathname = usePathname();

  function pick(slug: string) {
    router.replace({
      pathname: pathname as "/social",
      query: slug ? { client: slug } : {},
    });
  }

  const suffix = currentClient ? `?client=${currentClient}` : "";

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
      <nav className="flex flex-wrap gap-1" data-testid="social-nav">
        {screens.map((s) => {
          const active =
            pathname === s.href ||
            (s.href !== "/social" && pathname.startsWith(s.href));
          return (
            <Link
              key={s.key}
              href={`${s.href}${suffix}` as Route}
              className={cn(
                "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "bg-brand text-brand-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {t(`screens.${s.key}`)}
              {s.badge ? (
                <span
                  className={cn(
                    "inline-flex min-w-[18px] justify-center rounded-full px-1.5 text-[10px] leading-4",
                    active
                      ? "bg-brand-foreground/20 text-brand-foreground"
                      : "bg-muted-foreground/15 text-muted-foreground",
                  )}
                >
                  {s.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <label className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">{t("filter.client")}</span>
        <select
          value={currentClient}
          onChange={(e) => pick(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">{t("filter.allClients")}</option>
          {clients.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
