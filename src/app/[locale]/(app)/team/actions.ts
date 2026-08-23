"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

import { log } from "@/lib/log";
import { isOwner } from "@/lib/auth";

export type InviteMemberState = {
  error?: string;
  fieldErrors?: Partial<Record<"email", string>>;
  success?: string; // email that was just invited
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function inviteMemberAction(
  _prev: InviteMemberState,
  formData: FormData,
): Promise<InviteMemberState> {
  if (!(await isOwner())) {
    return { error: "unauthorized" };
  }

  const email = (formData.get("email") ?? "").toString().trim().toLowerCase();
  const fullName = (formData.get("full_name") ?? "").toString().trim() || null;
  const locale = (formData.get("locale") ?? "pt-BR").toString();

  if (!EMAIL_RE.test(email)) {
    return { fieldErrors: { email: "invalid" } };
  }

  const admin = createAdminClient();

  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: fullName ? { full_name: fullName } : undefined,
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/today`,
  });

  if (error) {
    // Collapsed on purpose. GoTrue answers "A user with this email address has
    // already been registered", which turns the invite form into a clean
    // account-enumeration oracle against the studio's staff and clients: type
    // an address, read whether it has a Nest login. The real error goes to the
    // log, where the person who can act on it will actually see it.
    log.error("team.invite", "invite_failed", { status: error.status });
    return { error: "inviteFailed" };
  }

  revalidatePath(`/${locale}/team`);
  return { success: email };
}
