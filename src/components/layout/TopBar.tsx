import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { ThemeSwitch } from "@/components/layout/ThemeSwitch";
import { ViewAsSwitcher } from "@/components/layout/ViewAsSwitcher";
import {
  NotificationsBell,
  type NotificationItem,
} from "@/components/layout/NotificationsBell";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, getSessionUser } from "@/lib/auth";
import { getViewAs } from "@/lib/view-as-server";
import type { Theme } from "@/lib/theme";

export async function TopBar({
  locale,
  theme,
}: {
  locale: string;
  theme: Theme;
}) {
  const [user, profile, viewAs] = await Promise.all([
    getSessionUser(),
    getCurrentProfile(),
    getViewAs(),
  ]);

  let notifications: NotificationItem[] = [];
  let unreadCount = 0;

  if (user) {
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
    notifications = (list.data ?? []) as NotificationItem[];
    unreadCount = unread.count ?? 0;
  }

  return (
    <header className="flex items-center justify-between gap-4 px-2">
      <ViewAsSwitcher
        actualRole={profile?.role ?? "staff"}
        current={viewAs}
        name={profile?.full_name ?? user?.email ?? ""}
      />
      <div className="flex items-center gap-3">
        <ThemeSwitch initial={theme} />
        <NotificationsBell
          locale={locale}
          notifications={notifications}
          unreadCount={unreadCount}
        />
        <LanguageSwitcher />
      </div>
    </header>
  );
}
