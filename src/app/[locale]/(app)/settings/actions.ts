"use server";

import { revalidatePath } from "next/cache";
import { createClient as createAdminSupabase } from "@supabase/supabase-js";
import { getCurrentProfile } from "@/lib/auth";

export async function disconnectGoogleAction(): Promise<void> {
  const profile = await getCurrentProfile();
  if (!profile) return;

  const admin = createAdminSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  await admin
    .from("profiles")
    .update({
      google_refresh_token: null,
      google_access_token: null,
      google_token_expires_at: null,
      google_email: null,
      google_scopes: null,
    })
    .eq("id", profile.id);

  revalidatePath("/settings");
}
