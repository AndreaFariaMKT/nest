"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { VIEW_AS_ROLES, type ViewAsRole } from "@/lib/view-as";

const ROLE_LABEL: Record<ViewAsRole, string> = {
  owner: "Founder",
  staff: "Team",
  client: "Client",
};

/**
 * Persona/role preview, styled for the dark sidebar. Owners can preview the app
 * as a Team member or Client; everyone else just sees their own role chip.
 */
export function ViewAsSwitcher({
  actualRole,
  current,
  name,
}: {
  actualRole: string;
  current: ViewAsRole | null;
  name: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function pick(role: ViewAsRole) {
    const value = role === "owner" ? "" : role;
    document.cookie = value
      ? `nest-view-as=${value}; path=/; max-age=86400; samesite=lax`
      : `nest-view-as=; path=/; max-age=0; samesite=lax`;
    startTransition(() => router.refresh());
  }

  if (actualRole !== "owner") {
    return (
      <div className="px-1 text-xs text-sidebar-foreground/60">
        {name} · {ROLE_LABEL.staff}
      </div>
    );
  }

  const active: ViewAsRole = current ?? "owner";

  return (
    <div data-pending={pending}>
      <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-muted">
        View as
      </p>
      <div className="flex gap-1">
        {VIEW_AS_ROLES.map((role) => {
          const isActive = role === active;
          return (
            <button
              key={role}
              onClick={() => pick(role)}
              aria-pressed={isActive}
              className={
                isActive
                  ? "flex-1 rounded-lg bg-sidebar-active px-2 py-1.5 text-xs font-medium text-sidebar-active-foreground"
                  : "flex-1 rounded-lg bg-white/5 px-2 py-1.5 text-xs font-medium text-sidebar-foreground/70 hover:bg-white/10"
              }
            >
              {role === "owner" ? "You" : ROLE_LABEL[role]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
