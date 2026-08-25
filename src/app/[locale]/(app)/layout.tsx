import { cookies } from "next/headers";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import type { NotificationItem } from "@/components/layout/NotificationsBell";
import { getCurrentTenant } from "@/lib/tenant-server";
import { getSessionUser, getCurrentProfile } from "@/lib/auth";
import { getCurrentRole, getActualRole, getViewRole } from "@/lib/roles-server";
import { socialSidebarScreens } from "@/lib/social";

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // The session first, alone, because everything below needs the user id.
  // Redirecting here rather than after the second wave also means an
  // unauthenticated request stops before issuing any query at all.
  const user = await getSessionUser();
  if (!user) {
    redirect({ href: "/login", locale: locale as "pt-BR" | "en" });
    return null;
  }

  const supabase = await createClient();

  // One wave, not two. The notifications only need `user.id`, which the line
  // above already resolved — they used to wait for the tenant/profile/role
  // reads to finish first, for no reason. The five helpers are all
  // React.cache()-wrapped, so the layout, Sidebar and every screen below share
  // one result each.
  const [tenant, profile, role, actualRole, viewRole, list, unread] =
    await Promise.all([
      getCurrentTenant(),
      getCurrentProfile(),
      getCurrentRole(),
      getActualRole(),
      getViewRole(),
      supabase
        .from("notifications")
        .select("id, type, title, body, link, read_at, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("read_at", null),
    ]);

  // Pure — a filter over a constant list, no query. The module's screens hang
  // off the sidebar's own entry now that there are thirteen of them.
  const socialScreens = socialSidebarScreens(role);

  const notifications = (list.data ?? []) as NotificationItem[];
  const unreadCount = unread.count ?? 0;
  const collapsed = (await cookies()).get("nest-sidebar")?.value === "1";

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        theme={tenant.theme}
        tenantName={tenant.name}
        locale={locale}
        profileName={profile?.full_name ?? user.email ?? ""}
        role={role}
        actualRole={actualRole}
        viewRole={viewRole}
        notifications={notifications}
        unreadCount={unreadCount}
        initialCollapsed={collapsed}
        socialScreens={socialScreens}
      />
      {/* Below md the sidebar is hidden and this bar carries the navigation.
          px-4 on a phone: eight units of padding on each side of a 375px
          screen is a quarter of it. */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <MobileNav
          theme={tenant.theme}
        tenantName={tenant.name}
          locale={locale}
          profileName={profile?.full_name ?? user.email ?? ""}
          role={role}
          actualRole={actualRole}
          viewRole={viewRole}
          notifications={notifications}
          unreadCount={unreadCount}
          socialScreens={socialScreens}
        />
        <main className="min-w-0 flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
