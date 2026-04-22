"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";

export async function markAllNotificationsReadAction(
  formData: FormData,
): Promise<void> {
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  const supabase = await createSupabaseClient();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);

  revalidatePath(`/${locale}/today`);
  // Revalidate any page with the TopBar — in practice every (app) route
  // re-fetches on next navigation, so revalidating the "app" root is
  // enough for the bell to refresh.
  revalidatePath(`/${locale}`);
}
