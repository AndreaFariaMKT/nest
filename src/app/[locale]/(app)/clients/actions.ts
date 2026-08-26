"use server";

import { dbError } from "@/lib/db-error";
import { revalidatePath } from "next/cache";
import { log } from "@/lib/log";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import { slugify } from "@/lib/slug";
import { createAdminClient } from "@/lib/supabase/admin";
import { isOwner } from "@/lib/roles-server";

export type ClientStatus = "prospect" | "active" | "paused" | "archived";

export type ClientFormState = {
  error?: string;
  fieldErrors?: Partial<Record<"name" | "posts_per_cycle", string>>;
};

function localePath(locale: string, path: string): Route {
  return (locale === "pt-BR" ? path : `/${locale}${path}`) as Route;
}

function parseName(formData: FormData) {
  return (formData.get("name") ?? "").toString().trim();
}

function parseOptional(formData: FormData, key: string) {
  const value = (formData.get(key) ?? "").toString().trim();
  return value.length > 0 ? value : null;
}

async function uniqueSlug(
  supabase: Awaited<ReturnType<typeof createSupabaseClient>>,
  baseSlug: string,
  excludeId?: string,
) {
  let slug = baseSlug || "client";
  let suffix = 2;
  while (true) {
    let query = supabase.from("clients").select("id").eq("slug", slug).limit(1);
    if (excludeId) query = query.neq("id", excludeId);
    const { data } = await query.maybeSingle();
    if (!data) return slug;
    slug = `${baseSlug || "client"}-${suffix++}`;
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Create
// ───────────────────────────────────────────────────────────────────────────

export async function createClientAction(
  _prev: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  const name = parseName(formData);
  const locale = (formData.get("locale") ?? "pt-BR").toString();

  if (name.length < 2) return { fieldErrors: { name: "tooShort" } };

  const supabase = await createSupabaseClient();
  const slug = await uniqueSlug(supabase, slugify(name));
  const tenantId = await currentTenantId();

  const { error } = await supabase.from("clients").insert({
    tenant_id: tenantId,
    name,
    slug,
    industry: parseOptional(formData, "industry"),
    website: parseOptional(formData, "website"),
    notes: parseOptional(formData, "notes"),
    status: "active",
  });

  if (error) return { error: dbError(error) };

  revalidatePath(`/${locale}/clients`);
  redirect(localePath(locale, `/clients/${slug}`));
}

// ───────────────────────────────────────────────────────────────────────────
// Update
// ───────────────────────────────────────────────────────────────────────────

export async function updateClientAction(
  _prev: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  const id = (formData.get("id") ?? "").toString();
  const name = parseName(formData);
  const status = (formData.get("status") ?? "active").toString() as ClientStatus;
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  // How many publications one fortnight buys — the divisor behind the social
  // module's backlog meter, so a wrong value quietly mis-reads every shelf.
  const socialEnabled = formData.get("social_enabled") !== null;
  // An emptied <input type="number"> submits "", which is present — so `?? "2"`
  // never fires and parseInt("") is NaN. Treat blank as "leave the default"
  // rather than rejecting a save that only changed the client's name.
  const rawPerCycle = (formData.get("posts_per_cycle") ?? "").toString().trim();
  const postsPerCycle = rawPerCycle === "" ? 2 : Number.parseInt(rawPerCycle, 10);

  if (!id) return { error: "Missing client id." };
  if (name.length < 2) return { fieldErrors: { name: "tooShort" } };
  if (!Number.isFinite(postsPerCycle) || postsPerCycle < 1 || postsPerCycle > 40) {
    return { fieldErrors: { posts_per_cycle: "outOfRange" } };
  }

  const supabase = await createSupabaseClient();

  const { data: current } = await supabase
    .from("clients")
    .select("slug, name")
    .eq("id", id)
    .single();

  if (!current) return { error: "Client not found." };

  // Re-slug only when the name actually changed
  const slug =
    current.name === name
      ? current.slug
      : await uniqueSlug(supabase, slugify(name), id);

  const { error } = await supabase
    .from("clients")
    .update({
      name,
      slug,
      industry: parseOptional(formData, "industry"),
      website: parseOptional(formData, "website"),
      notes: parseOptional(formData, "notes"),
      status,
      social_enabled: socialEnabled,
      posts_per_cycle: postsPerCycle,
    })
    .eq("id", id);

  if (error) return { error: dbError(error) };

  revalidatePath(`/${locale}/clients`);
  revalidatePath(`/${locale}/clients/${slug}`);
  revalidatePath(`/${locale}/social`);
  redirect(localePath(locale, `/clients/${slug}`));
}

// ───────────────────────────────────────────────────────────────────────────
// Archive
// ───────────────────────────────────────────────────────────────────────────

export async function archiveClientAction(formData: FormData): Promise<void> {
  const id = (formData.get("id") ?? "").toString();
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  if (!id) return;

  const supabase = await createSupabaseClient();
  await supabase.from("clients").update({ status: "archived" }).eq("id", id);

  revalidatePath(`/${locale}/clients`);
  redirect(localePath(locale, "/clients"));
}

// ───────────────────────────────────────────────────────────────────────────
// Portal token — mint / rotate a token for /p/[token] read-only access
// ───────────────────────────────────────────────────────────────────────────

/** How long a freshly minted /p/[token] link stays valid. */
const PORTAL_TOKEN_DAYS = 90;

function generatePortalToken(): string {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function generatePortalTokenAction(
  formData: FormData,
): Promise<void> {
  const clientId = (formData.get("clientId") ?? "").toString();
  const slug = (formData.get("slug") ?? "").toString();
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  if (!clientId || !slug) return;

  const token = generatePortalToken();
  // Ninety days. Long enough that nobody is re-minting links every month,
  // short enough that a link forwarded out of the studio's control stops
  // working while the relationship it was issued for is still recognisable.
  // Rotating issues a fresh window; revoking still cuts it immediately.
  const expiresAt = new Date(Date.now() + PORTAL_TOKEN_DAYS * 86_400_000);
  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("clients")
    .update({
      portal_token: token,
      portal_token_expires_at: expiresAt.toISOString(),
    })
    .eq("id", clientId);

  if (error) {
    log.error("clients.portal-token", "issue_failed", {
      code: error.code ?? "unknown",
    });
    redirect(localePath(locale, `/clients/${slug}?portal=issueFailed`));
  }

  revalidatePath(`/${locale}/clients/${slug}`);
  redirect(localePath(locale, `/clients/${slug}`));
}

export async function revokePortalTokenAction(
  formData: FormData,
): Promise<void> {
  const clientId = (formData.get("clientId") ?? "").toString();
  const slug = (formData.get("slug") ?? "").toString();
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  if (!clientId || !slug) return;

  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("clients")
    .update({ portal_token: null, portal_token_expires_at: null })
    .eq("id", clientId);

  // The sharpest discarded error in the app. A revoke RLS refused looked
  // exactly like one that worked — same redirect, same page — and what stayed
  // behind was a live bearer link to a client's portal, believed dead.
  if (error) {
    log.error("clients.portal-token", "revoke_failed", {
      code: error.code ?? "unknown",
    });
    redirect(localePath(locale, `/clients/${slug}?portal=revokeFailed`));
  }

  revalidatePath(`/${locale}/clients/${slug}`);
  redirect(localePath(locale, `/clients/${slug}`));
}

export type PortalLoginState = { error?: string; success?: string };

/**
 * Give a client a real login, and link it to their record.
 *
 * `clients.portal_user_id` is what the whole authenticated portal reads — ten
 * screens, the client role's entire navigation, `owns_portal_client()`, the
 * daily digest's recipient list. Migration 017 declared the column and
 * NOTHING in this repository ever wrote it. So the good portal was
 * unreachable for every real client, and the only client-facing surface that
 * worked was the anonymous bearer link at /p/[token].
 *
 * Same shape as the team invite: create the auth user, then write the row that
 * makes them somebody. A failure to write the link is reported rather than
 * hidden behind a success that leaves them with a login and nothing to see.
 */
export async function invitePortalLoginAction(
  _prev: PortalLoginState,
  formData: FormData,
): Promise<PortalLoginState> {
  if (!(await isOwner())) return { error: "unauthorized" };

  const clientId = (formData.get("clientId") ?? "").toString();
  const slug = (formData.get("slug") ?? "").toString();
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  const email = (formData.get("email") ?? "").toString().trim().toLowerCase();

  if (!clientId || !slug) return { error: "badRequest" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "badEmail" };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/portal`,
  });

  if (error) {
    // Collapsed, like the team invite: a distinct "already registered" turns
    // this into an account-enumeration oracle against the studio's clients.
    log.error("clients.portal-login", "invite_failed", {
      status: error.status,
    });
    return { error: "inviteFailed" };
  }

  const userId = data?.user?.id;
  if (!userId) {
    log.error("clients.portal-login", "invite_returned_no_user", {});
    return { error: "inviteFailed" };
  }

  // Which tenant this client belongs to. The membership row below needs it,
  // and reading it from the client record rather than the caller's session
  // keeps the two from ever disagreeing.
  const { data: clientRow } = await admin
    .from("clients")
    .select("tenant_id")
    .eq("id", clientId)
    .maybeSingle();

  if (!clientRow) {
    log.error("clients.portal-login", "client_not_found", {});
    return { error: "linkFailed" };
  }

  // Service role: `clients` is not writable by a session that is not already
  // a member, and this runs before the invitee is anyone at all.
  const { error: linkError } = await admin
    .from("clients")
    .update({ portal_user_id: userId })
    .eq("id", clientId);

  if (linkError) {
    log.error("clients.portal-login", "link_failed", {
      code: linkError.code ?? "unknown",
    });
    return { error: "linkFailed" };
  }

  // And the membership, which is the half that makes the link mean anything.
  //
  // Migration 014 installs a RESTRICTIVE `tenant_isolation` policy on every
  // tenant-owned table — restrictive ANDs with every permissive grant, so a
  // login with no membership row reads NOTHING, whatever else allows it.
  // Without this the invited client signs in, reaches their portal, and every
  // screen is empty forever. Exactly the failure the team invite had.
  const { error: memberError } = await admin
    .from("tenant_members")
    .upsert(
      { tenant_id: clientRow.tenant_id, user_id: userId, role: "client" },
      { onConflict: "tenant_id,user_id" },
    );

  if (memberError) {
    log.error("clients.portal-login", "membership_failed", {
      code: memberError.code ?? "unknown",
    });
    return { error: "linkFailed" };
  }

  revalidatePath(`/${locale}/clients/${slug}`);
  revalidatePath(`/clients/${slug}`);
  return { success: email };
}
