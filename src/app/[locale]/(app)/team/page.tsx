import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { isOwner } from "@/lib/roles-server";
import { getCurrentTenant } from "@/lib/tenant-server";
import { isAppRole, type AppRole } from "@/lib/roles";
import { InviteForm } from "./_components/InviteForm";
import { RoleSelect } from "./_components/RoleSelect";

type Row = { user_id: string; role: string };
type Profile = { id: string; email: string | null; full_name: string | null };

export default async function TeamPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!(await isOwner())) notFound();

  const [t, tenant, me, supabase] = await Promise.all([
    getTranslations("team"),
    getCurrentTenant(),
    getSessionUser(),
    createClient(),
  ]);

  // The membership table is the role the app actually runs on. This page used
  // to render `profiles.role` — the legacy owner/staff/client enum nothing
  // writes — so it showed "Staff" beside a person the app was treating as a
  // client, which is the one thing a permissions screen must never do.
  const { data: memberData } = await supabase
    .from("tenant_members")
    .select("user_id, role")
    .eq("tenant_id", tenant.id);
  const members = (memberData ?? []) as Row[];

  // No FK from tenant_members to profiles (it points at auth.users), so the
  // names come in a second read rather than an embed.
  const ids = members.map((m) => m.user_id);
  const { data: profileData } = ids.length
    ? await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", ids)
    : { data: [] };
  const byId = new Map(
    ((profileData ?? []) as Profile[]).map((p) => [p.id, p]),
  );

  const rows = members
    .map((m) => ({
      ...m,
      appRole: (isAppRole(m.role) ? m.role : "client") as AppRole,
      profile: byId.get(m.user_id),
    }))
    .sort((a, b) =>
      (a.profile?.full_name ?? a.profile?.email ?? "").localeCompare(
        b.profile?.full_name ?? b.profile?.email ?? "",
      ),
    );

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <h1 className="font-display text-4xl text-foreground">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <section className="mb-10 rounded-lg border border-border bg-card p-5">
        <h2 className="font-display text-xl">{t("inviteTitle")}</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          {t("inviteSubtitle")}
        </p>
        <InviteForm locale={locale} />
      </section>

      <section>
        <h2 className="mb-1 font-display text-xl">{t("membersTitle")}</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          {t("membersHint", { tenant: tenant.name })}
        </p>
        <ul className="space-y-2">
          {rows.map((r) => (
            <li
              key={r.user_id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card p-3 text-sm"
              data-testid="team-member"
            >
              <div className="min-w-0">
                <div className="truncate font-medium">
                  {r.profile?.full_name ?? r.profile?.email ?? t("pendingName")}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {r.profile?.email ?? t("pendingInvite")}
                </div>
              </div>
              <RoleSelect
                userId={r.user_id}
                role={r.appRole}
                locale={locale}
                // Her own row. Demoting yourself on a screen only founders can
                // open is a one-click lockout with no way back in the app.
                disabled={r.user_id === me?.id}
              />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export const dynamic = "force-dynamic";
