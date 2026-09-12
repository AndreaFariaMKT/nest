"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

import { log } from "@/lib/log";
import { isOwner } from "@/lib/roles-server";
import { getCurrentTenant } from "@/lib/tenant-server";
import { isAppRole, type AppRole } from "@/lib/roles";
import { generateTempPassword } from "@/lib/temp-password";

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
  const jobTitle =
    (formData.get("job_title") ?? "").toString().trim().slice(0, 120) || null;
  const department =
    (formData.get("department") ?? "").toString().trim().slice(0, 120) || null;
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
    // One exception to the collapsing, because it says nothing about whether
    // the address exists and everything about the studio's own configuration:
    // 429 is GoTrue refusing to send. With no SMTP configured, Supabase's
    // built-in sender allows a couple of messages an hour, so this is the
    // normal outcome rather than an edge case — and reported as a generic
    // "could not invite" it looks like the address is at fault.
    if (error.status === 429) return { error: "emailRateLimited" };
    return { error: "inviteFailed" };
  }

  const invitedId = data?.user?.id;
  if (!invitedId) {
    log.error("team.invite", "invite_returned_no_user", {});
    return { error: "inviteFailed" };
  }

  const granted = await grantAccess(admin, {
    userId: invitedId,
    tenantId: tenant.id,
    role,
    jobTitle,
    department,
    scope: "team.invite",
  });
  if (granted) return { error: granted };

  revalidatePath(`/${locale}/team`);
  return { success: email };
}

/**
 * Give a brand-new auth user everything they need to reach the app.
 *
 * Shared by the two ways a login comes into existence — the emailed invite and
 * the password handed over directly. Creating the auth user is the easy half;
 * this is the half that was missing once already, and duplicating it would be
 * asking for it to go missing again on one path only.
 *
 * Returns an error key, or null when the person can now log in.
 */
async function grantAccess(
  admin: ReturnType<typeof createAdminClient>,
  opts: {
    userId: string;
    tenantId: string;
    role: AppRole;
    jobTitle: string | null;
    department: string | null;
    scope: string;
  },
): Promise<string | null> {
  // Without this row the new login has no membership for the tenant,
  // getActualRole() fails closed to "client", and the guard redirects them to
  // a portal they are not linked to — an invite that ends on a blank page,
  // permanently, with no way out but SQL.
  //
  // Service role on purpose: tenant_members carries a SELECT policy and no
  // write policy at all, so no authenticated session can write it.
  const { error: memberError } = await admin
    .from("tenant_members")
    .upsert(
      { tenant_id: opts.tenantId, user_id: opts.userId, role: opts.role },
      { onConflict: "tenant_id,user_id" },
    );

  if (memberError) {
    // The auth user exists but cannot reach the app. Say so rather than
    // reporting a success that leaves them stranded.
    log.error(opts.scope, "membership_failed", {
      code: memberError.code ?? "unknown",
    });
    return "membershipFailed";
  }

  // Title and department, if they were given. Written after the membership on
  // purpose and never allowed to fail the call: the profile row is created by
  // the trigger on auth.users, these two columns are descriptive, and access
  // that has already been granted should not report failure because a job
  // title did not stick. Worst case the person fills it in themselves.
  if (opts.jobTitle || opts.department) {
    const { error: profileError } = await admin
      .from("profiles")
      .update({ job_title: opts.jobTitle, department: opts.department })
      .eq("id", opts.userId);
    if (profileError) {
      log.error(opts.scope, "profile_details_failed", {
        code: profileError.code ?? "unknown",
      });
    }
  }

  return null;
}

export type CreateMemberState = {
  error?: string;
  fieldErrors?: Partial<Record<"email", string>>;
  /** Shown once, never stored anywhere this app can read again. */
  created?: { email: string; password: string };
};

/**
 * Create a login directly, with a password the founder hands over.
 *
 * The studio has no SMTP configured, so Supabase's built-in sender allows a
 * couple of messages an hour and `inviteUserByEmail` is not a way to reliably
 * give anyone access. The accountant needs an account now, and waiting on a
 * mail server is the wrong dependency for that.
 *
 * `email_confirm: true` because there is no confirmation mail to click: the
 * founder vouching for the address IS the confirmation, and leaving it false
 * would create an account that cannot log in for a reason nothing on screen
 * explains.
 *
 * The password is generated, never chosen here. A founder inventing one picks
 * something they will reuse, and asking them to type it twice into a form that
 * emails nobody adds a step and a typo without adding a secret.
 */
export async function createMemberAction(
  _prev: CreateMemberState,
  formData: FormData,
): Promise<CreateMemberState> {
  if (!(await isOwner())) return { error: "unauthorized" };

  const email = (formData.get("email") ?? "").toString().trim().toLowerCase();
  const fullName = (formData.get("full_name") ?? "").toString().trim() || null;
  const jobTitle =
    (formData.get("job_title") ?? "").toString().trim().slice(0, 120) || null;
  const department =
    (formData.get("department") ?? "").toString().trim().slice(0, 120) || null;
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  const roleValue = (formData.get("role") ?? "").toString();

  if (!EMAIL_RE.test(email)) return { fieldErrors: { email: "invalid" } };
  if (!isAppRole(roleValue)) return { error: "badRole" };
  const role: AppRole = roleValue;

  const tenant = await getCurrentTenant();
  const admin = createAdminClient();
  const password = generateTempPassword();

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: fullName ? { full_name: fullName } : undefined,
  });

  if (error) {
    // Same enumeration reasoning as the invite path: "already registered" is
    // not something this form gets to confirm.
    log.error("team.create", "create_failed", { status: error.status });
    return { error: "createFailed" };
  }

  const userId = data?.user?.id;
  if (!userId) {
    log.error("team.create", "create_returned_no_user", {});
    return { error: "createFailed" };
  }

  const granted = await grantAccess(admin, {
    userId,
    tenantId: tenant.id,
    role,
    jobTitle,
    department,
    scope: "team.create",
  });
  if (granted) return { error: granted };

  revalidatePath(`/${locale}/team`);
  // The only time this password is ever readable. It is not logged and not
  // stored — GoTrue keeps a hash — so if the founder loses it before handing
  // it over, the way back is to set a new one, not to look this one up.
  return { created: { email, password } };
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

export type AddMemberState = InviteMemberState & CreateMemberState;

/**
 * The two ways to give someone access, behind one form.
 *
 * Which one runs is decided by the submit button the person pressed — an
 * `<button name="mode" value="…">` contributes its value to the form data, so
 * two buttons over one set of fields need no JavaScript and no second copy of
 * the name, role and department inputs.
 *
 * The default is the invite. Handing a password over is the path that works
 * without a mail server, not the one to reach for first: an invite lets the
 * person choose their own secret and never puts it in someone else's hands.
 */
export async function addMemberAction(
  prev: AddMemberState,
  formData: FormData,
): Promise<AddMemberState> {
  return (formData.get("mode") ?? "").toString() === "password"
    ? createMemberAction(prev, formData)
    : inviteMemberAction(prev, formData);
}
