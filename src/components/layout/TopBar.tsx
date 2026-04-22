import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import {
  NotificationsBell,
  type NotificationItem,
} from "@/components/layout/NotificationsBell";
import { createClient } from "@/lib/supabase/server";

export async function TopBar({ locale }: { locale: string }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let notifications: NotificationItem[] = [];
  let unreadCount = 0;

  if (user) {
    const { data } = await supabase
      .from("notifications")
      .select("id, type, title, body, link, read_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);
    notifications = (data ?? []) as NotificationItem[];

    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("read_at", null);
    unreadCount = count ?? 0;
  }

  return (
    <header className="flex h-16 items-center justify-end gap-4 border-b border-border bg-card px-8">
      <NotificationsBell
        locale={locale}
        notifications={notifications}
        unreadCount={unreadCount}
      />
      <LanguageSwitcher />
    </header>
  );
}
