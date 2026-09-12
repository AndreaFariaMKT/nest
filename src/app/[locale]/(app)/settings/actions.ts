"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { log } from "@/lib/log";
import { passwordProblem } from "@/lib/temp-password";

export async function disconnectGoogleAction(): Promise<void> {
  const profile = await getCurrentProfile();
  if (!profile) return;

  const admin = createAdminClient();
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

export type PasswordState = {
  error?: string;
  fieldErrors?: Partial<Record<"password", string>>;
  ok?: boolean;
};

/**
 * Change your own password.
 *
 * There was no way to do this in the app at all, which mattered the moment a
 * login could be created with a password the founder picked and read out: a
 * shared secret that cannot be replaced is a shared secret forever.
 *
 * Deliberately the session client, not the admin one. `updateUser` acts on
 * whoever is signed in, so this action cannot be pointed at another account by
 * posting a different id — there is no id to post. The admin client, which can
 * set anyone's password, has no business being reachable from a form that
 * exists to change your own.
 */
export async function changePasswordAction(
  _prev: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const password = (formData.get("password") ?? "").toString();
  const confirmation = (formData.get("confirmation") ?? "").toString();

  const problem = passwordProblem(password, confirmation);
  if (problem) return { fieldErrors: { password: problem } };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    // Includes GoTrue's own refusals — a password it considers weak, or a
    // session too old to change credentials with.
    log.error("settings.password", "update_failed", { status: error.status });
    return { error: "passwordFailed" };
  }

  return { ok: true };
}
