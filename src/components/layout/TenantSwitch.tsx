"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { TENANT_LIST, type TenantSlug } from "@/lib/tenant";

/**
 * Tenant switcher (AFM ⇄ Nest). Switching the tenant changes BOTH the data
 * scope and the theme, so it writes the cookie, flips <html data-theme> for an
 * instant re-theme, then refreshes the server tree to load the new tenant's data.
 */
export function TenantSwitch({ current }: { current: TenantSlug }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function pick(slug: TenantSlug, theme: string) {
    if (slug === current) return;
    document.cookie = `nest-tenant=${slug}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.dataset.theme = theme;
    startTransition(() => router.refresh());
  }

  return (
    <div
      className="inline-flex items-center gap-1 rounded-full border border-border bg-card p-0.5"
      data-pending={pending}
    >
      {TENANT_LIST.map((t) => (
        <button
          key={t.slug}
          onClick={() => pick(t.slug, t.theme)}
          aria-pressed={t.slug === current}
          className={
            t.slug === current
              ? "rounded-full bg-brand px-3 py-1 text-xs font-medium text-brand-foreground"
              : "rounded-full px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          }
        >
          {t.name}
        </button>
      ))}
    </div>
  );
}
