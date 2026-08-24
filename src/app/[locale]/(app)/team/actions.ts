"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

import { log } from "@/lib/log";
import { isOwner } from "@/lib/roles-server";
import { getCurrentTenant } from "@/lib/tenant-server";
import { isAppRole, type AppRole } from "@/lib/roles";

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
  const roleValue = (formData.get("role") ?? "").toString();

  if (!EMAIL_RE.test(email)) {
    return { fieldErrors: { email: "invalid" } };
  }
  // Never trust the posted role. An unknown value used to be impossible to
  // send at all — because the form had no role field and nobody was ever made
  // a member.
  if (!isAppRole(roleValue)) {
    return { error: "badRole" };
  }
  const role: AppRole = roleValue;

  const tenant = await getCurrentTenant();
  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
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

  const invitedId = data?.user?.id;
  if (!invitedId) {
    log.error("team.invite", "invite_returned_no_user", {});
    return { error: "inviteFailed" };
  }

  // The half that was missing. Without this row the new login has no
  // membership for the tenant, getActualRole() fails closed to "client", and
  // the guard redirects them to a portal they are not linked to — an invite
  // that ends on a blank page, permanently, with no way out but SQL.
  //
  // Service role on purpose: tenant_members carries a SELECT policy and no
  // write policy at all, so no authenticated session can write it.
  const { error: memberError } = await admin
    .from("tenant_members")
    .upsert(
      { tenant_id: tenant.id, user_id: invitedId, role },
      { onConflict: "tenant_id,user_id" },
    );

  if (memberError) {
    // The auth user exists but cannot reach the app. Say so rather than
    // reporting a success that leaves them stranded.
    log.error("team.invite", "membership_failed", {
      code: memberError.code ?? "unknown",
    });
    return { error: "membershipFailed" };
  }

  revalidatePath(`/${locale}/team`);
  return { success: email };
}

export type MemberRoleState = { error?: string; ok?: boolean };

/**
 * Change an existing member's role.
 *
 * The other half of the same gap: an invite sent with the wrong role, or a
 * person whose job changed, was unfixable outside the SQL editor.
 */
export async function setMemberRoleAction(
  _prev: MemberRoleState,
  formData: FormData,
): Promise<MemberRoleState> {
  if (!(await isOwner())) return { error: "unauthorized" };

  const userId = (formData.get("user_id") ?? "").toString();
  const roleValue = (formData.get("role") ?? "").toString();
  const locale = (formData.get("locale") ?? "pt-BR").toString();

  if (!userId) return { error: "badRequest" };
  if (!isAppRole(roleValue)) return { error: "badRole" };

  const tenant = await getCurrentTenant();
  const admin = createAdminClient();

  // Scoped to the tenant the caller is actually looking at — being founder of
  // AFM is not authority over Nest's membership list.
  const { error } = await admin
    .from("tenant_members")
    .update({ role: roleValue })
    .eq("tenant_id", tenant.id)
    .eq("user_id", userId);

  if (error) {
    log.error("team.role", "update_failed", { code: error.code ?? "unknown" });
    return { error: "roleFailed" };
  }

  revalidatePath(`/${locale}/team`);
  return { ok: true };
}
