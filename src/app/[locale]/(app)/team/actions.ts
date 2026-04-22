"use server";

import { revalidatePath } from "next/cache";
import { createClient as createServiceClient } from "@supabase/supabase-js";
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

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: fullName ? { full_name: fullName } : undefined,
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/today`,
  });

  if (error) return { error: error.message };

  revalidatePath(`/${locale}/team`);
  return { success: email };
}
