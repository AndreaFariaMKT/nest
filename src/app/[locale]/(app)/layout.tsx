import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/Sidebar";
import type { NotificationItem } from "@/components/layout/NotificationsBell";
import { getCurrentTenant } from "@/lib/tenant-server";
import { getSessionUser, getCurrentProfile } from "@/lib/auth";
import { getViewAs } from "@/lib/view-as-server";

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [user, tenant, profile, viewAs] = await Promise.all([
    getSessionUser(),
    getCurrentTenant(),
    getCurrentProfile(),
    getViewAs(),
  ]);

  if (!user) {
    redirect({ href: "/login", locale: locale as "pt-BR" | "en" });
    return null;
  }

  const supabase = await createClient();
  const [list, unread] = await Promise.all([
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
  const notifications = (list.data ?? []) as NotificationItem[];
  const unreadCount = unread.count ?? 0;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        theme={tenant.theme}
        locale={locale}
        profileName={profile?.full_name ?? user.email ?? ""}
        profileRole={profile?.role ?? "staff"}
        viewAs={viewAs}
        notifications={notifications}
        unreadCount={unreadCount}
      />
      <main className="min-w-0 flex-1 overflow-y-auto px-8 py-8">{children}</main>
    </div>
  );
}
