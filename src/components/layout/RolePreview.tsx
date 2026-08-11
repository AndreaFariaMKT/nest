"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { APP_ROLES, ROLE_LABEL, type AppRole } from "@/lib/roles";

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
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (actualRole !== "founder") {
    return (
      <div className="px-1 text-xs text-sidebar-foreground/60">
        {ROLE_LABEL[actualRole]}
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
        View as
      </p>
      <select
        value={value}
        onChange={(e) => pick(e.target.value as AppRole)}
        disabled={pending}
        className="w-full rounded-lg bg-white/5 px-2 py-1.5 text-xs text-sidebar-foreground outline-none"
      >
        {APP_ROLES.map((r) => (
          <option key={r} value={r} className="text-ink">
            {ROLE_LABEL[r]}
          </option>
        ))}
      </select>
    </div>
  );
}
