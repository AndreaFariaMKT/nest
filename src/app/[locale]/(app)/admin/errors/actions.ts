"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth";
import { getActualRole } from "@/lib/roles-server";
import { log } from "@/lib/log";

/**
 * Mark a whole group as dealt with.
 *
 * Through the service role behind an explicit founder check, not a
 * client-writable RLS policy — migration 036 gives this table no INSERT,
 * UPDATE or DELETE policy at all, so a bug in a browser can neither forge a
 * record nor erase one. The only way to change a row is this function.
 *
 * Resolves by fingerprint rather than id: the same failure recorded forty
 * times is one thing to deal with, not forty.
 */
export async function resolveErrorAction(formData: FormData): Promise<void> {
  const [user, role] = await Promise.all([getSessionUser(), getActualRole()]);
  if (!user || role !== "founder") return;

  const fingerprint = (formData.get("fingerprint") ?? "").toString();
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  if (!fingerprint) return;

  const admin = createAdminClient();
  const { error } = await admin
    .from("error_log")
    .update({ resolved_at: new Date().toISOString(), resolved_by: user.id })
    .eq("fingerprint", fingerprint)
    .is("resolved_at", null);
  if (error) {
    log.error("admin.errors", "resolve_failed", { code: error.code });
  }

  revalidatePath(`/${locale}/admin/errors`);
  revalidatePath("/admin/errors");
}
