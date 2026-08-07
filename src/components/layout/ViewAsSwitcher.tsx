"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { VIEW_AS_ROLES, type ViewAsRole } from "@/lib/view-as";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

const ROLE_LABEL: Record<ViewAsRole, string> = {
  owner: "Founder",
  staff: "Team",
  client: "Client",
};

/**
 * Persona/role preview. Owners can preview the app as a Team member or Client;
 * everyone else just sees their own identity chip. Selection is stored in a
 * cookie and applied by re-running the server tree.
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

  // Non-owners can't impersonate — show just their identity.
  if (actualRole !== "owner") {
    return (
      <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5">
        <Avatar name={name} />
        <div className="leading-tight">
          <p className="text-xs font-medium text-foreground">{name}</p>
          <p className="text-[10px] text-muted-foreground">{ROLE_LABEL.staff}</p>
        </div>
      </div>
    );
  }

  const active: ViewAsRole = current ?? "owner";

  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:inline">
        View as
      </span>
      <div className="flex items-center gap-1.5" data-pending={pending}>
        {VIEW_AS_ROLES.map((role) => {
          const isActive = role === active;
          const label = role === "owner" ? name : ROLE_LABEL[role];
          return (
            <button
              key={role}
              onClick={() => pick(role)}
              aria-pressed={isActive}
              className={
                isActive
                  ? "flex items-center gap-2 rounded-full bg-sidebar px-3 py-1.5 text-sidebar-foreground"
                  : "flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-foreground hover:border-brand/40"
              }
            >
              <Avatar name={role === "owner" ? name : ROLE_LABEL[role]} muted={!isActive} />
              <div className="leading-tight">
                <p className="text-xs font-medium">{label}</p>
                <p
                  className={
                    isActive
                      ? "text-[10px] text-sidebar-muted"
                      : "text-[10px] text-muted-foreground"
                  }
                >
                  {ROLE_LABEL[role]}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Avatar({ name, muted }: { name: string; muted?: boolean }) {
  return (
    <span
      className={
        muted
          ? "grid h-6 w-6 place-items-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground"
          : "grid h-6 w-6 place-items-center rounded-full bg-brand text-[10px] font-semibold text-brand-foreground"
      }
    >
      {initials(name)}
    </span>
  );
}
