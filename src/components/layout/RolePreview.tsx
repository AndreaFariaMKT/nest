"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { useTranslations } from "next-intl";

import { APP_ROLES, type AppRole } from "@/lib/roles";

/**
 * Founder-only role preview — see the app exactly as any role would. Non-founders
 * just see their own role. Selection is stored in a cookie and re-renders the tree.
 */
export function RolePreview({
  actualRole,
  current,
}: {
  actualRole: AppRole;
  current: AppRole | null;
}) {
  // ROLE_LABEL is a hardcoded English map. This mounts in the sidebar footer
  // and the mobile drawer — persistent chrome on every page, for every user —
  // so "Founder" and "Designer · identity" were sitting in English on every
  // screen of a Portuguese product. team.appRoles already carries the right
  // strings in both dictionaries; they were written and never used here.
  const t = useTranslations("team");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (actualRole !== "founder") {
    return (
      <div className="px-1 text-xs text-sidebar-foreground/60">
        {t(`appRoles.${actualRole}`)}
      </div>
    );
  }

  const value = current ?? "founder";

  function pick(role: AppRole) {
    const v = role === "founder" ? "" : role;
    document.cookie = v
      ? `nest-view-role=${v}; path=/; max-age=86400; samesite=lax`
      : `nest-view-role=; path=/; max-age=0; samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <div>
      <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-muted">
        {tCommon("viewAs")}
      </p>
      <select
        value={value}
        onChange={(e) => pick(e.target.value as AppRole)}
        disabled={pending}
        className="w-full rounded-lg bg-white/5 px-2 py-1.5 text-xs text-sidebar-foreground outline-none"
      >
        {APP_ROLES.map((r) => (
          <option key={r} value={r} className="text-ink">
            {t(`appRoles.${r}`)}
          </option>
        ))}
      </select>
    </div>
  );
}
