"use server";

import { dbError } from "@/lib/db-error";
import { revalidatePath } from "next/cache";
import { log } from "@/lib/log";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import { slugify, uniqueSlug } from "@/lib/slug";
import { isProjectStatus, isProjectType } from "@/lib/projects";
// Temporary while 048 is unapplied — see the file for why.
import { pending } from "@/lib/projects-db";

export type ProjectFormState = {
  error?: string;
  fieldErrors?: Partial<Record<"name" | "type" | "dates", string>>;
};

function localePath(locale: string, path: string): Route {
  return (locale === "pt-BR" ? path : `/${locale}${path}`) as Route;
}

function optional(formData: FormData, key: string) {
  const value = (formData.get(key) ?? "").toString().trim();
  return value.length > 0 ? value : null;
}

function readForm(formData: FormData) {
  const rawType = (formData.get("type") ?? "").toString().trim();
  const rawStatus = (formData.get("status") ?? "").toString().trim();
  return {
    name: (formData.get("name") ?? "").toString().trim(),
    // Validated against the same list the CHECK in 048 holds. A typo would
    // otherwise reach Postgres and come back as a constraint violation, which
    // is a 500 where a field error belongs.
    type: isProjectType(rawType) ? rawType : null,
    status: isProjectStatus(rawStatus) ? rawStatus : "active",
    clientId: optional(formData, "client_id"),
    scope: optional(formData, "scope"),
    startsOn: optional(formData, "starts_on"),
    endsOn: optional(formData, "ends_on"),
    // Multi-select: everyone who works on this engagement.
    memberIds: formData.getAll("member_ids").map((v) => v.toString()),
    locale: (formData.get("locale") ?? "pt-BR").toString(),
  };
}

type Form = ReturnType<typeof readForm>;

function validate(form: Form): ProjectFormState | null {
  if (form.name.length < 2) return { fieldErrors: { name: "tooShort" } };
  if (form.name.length > 120) return { fieldErrors: { name: "tooLong" } };
  if (!form.type) return { fieldErrors: { type: "required" } };
  // The DB carries the same rule (projects_dates_ordered). Checking here means
  // the person sees it on the field instead of as a failed save.
  if (form.startsOn && form.endsOn && form.endsOn < form.startsOn) {
    return { fieldErrors: { dates: "endsBeforeStarts" } };
  }
  return null;
}

/**
 * Replace the member list for a project.
 *
 * Delete-then-insert rather than a diff: the set is a handful of people, the
 * table is a pure join with nothing worth preserving per row, and a diff would
 * be more code to get subtly wrong for no gain.
 */
async function setMembers(
  supabase: Awaited<ReturnType<typeof createSupabaseClient>>,
  projectId: string,
  tenantId: string,
  memberIds: string[],
) {
  await pending(supabase).from("project_members").delete().eq("project_id", projectId);
  if (memberIds.length === 0) return null;

  const rows = memberIds.map((userId) => ({
    project_id: projectId,
    user_id: userId,
    tenant_id: tenantId,
  }));
  const { error } = await pending(supabase).from("project_members").insert(rows);
  return error;
}

export async function createProjectAction(
  _prev: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const form = readForm(formData);
  const invalid = validate(form);
  if (invalid) return invalid;

  const supabase = await createSupabaseClient();
  const tenantId = await currentTenantId();

  // Unique per tenant, not globally — two houses may both run a "Rebranding".
  const slug = await uniqueSlug(slugify(form.name), "projeto", async (s) => {
    const { data } = await pending(supabase)
      .from("projects")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("slug", s)
      .limit(1)
      .maybeSingle();
    return !!data;
  });

  const { data, error } = await pending(supabase)
    .from("projects")
    .insert({
      tenant_id: tenantId,
      client_id: form.clientId,
      name: form.name,
      slug,
      type: form.type,
      status: form.status,
      scope: form.scope,
      starts_on: form.startsOn,
      ends_on: form.endsOn,
    })
    .select("id")
    .single();

  if (error || !data) {
    log.error("projects.create", "insert_failed", { code: error?.code });
    return { error: dbError(error) };
  }

  const memberError = await setMembers(
    supabase,
    data.id,
    tenantId,
    form.memberIds,
  );
  if (memberError) {
    // The project exists and is usable; only the team list did not stick.
    // Saying "failed" here would send someone to create it a second time.
    log.error("projects.create", "members_failed", {
      code: memberError.code ?? "unknown",
    });
  }

  revalidatePath(`/${form.locale}/projects`);
  redirect(localePath(form.locale, `/projects/${data.id}`));
}

export async function updateProjectAction(
  _prev: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const id = (formData.get("id") ?? "").toString();
  if (!id) return { error: "missingId" };

  const form = readForm(formData);
  const invalid = validate(form);
  if (invalid) return invalid;

  const supabase = await createSupabaseClient();
  const tenantId = await currentTenantId();

  const { error } = await pending(supabase)
    .from("projects")
    .update({
      client_id: form.clientId,
      name: form.name,
      type: form.type,
      status: form.status,
      scope: form.scope,
      starts_on: form.startsOn,
      ends_on: form.endsOn,
    })
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) {
    log.error("projects.update", "update_failed", { code: error.code });
    return { error: dbError(error) };
  }

  const memberError = await setMembers(supabase, id, tenantId, form.memberIds);
  if (memberError) {
    log.error("projects.update", "members_failed", {
      code: memberError.code ?? "unknown",
    });
  }

  revalidatePath(`/${form.locale}/projects`);
  revalidatePath(`/${form.locale}/projects/${id}`);
  redirect(localePath(form.locale, `/projects/${id}`));
}

export async function deleteProjectAction(formData: FormData): Promise<void> {
  const id = (formData.get("id") ?? "").toString();
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  if (!id) return;

  const supabase = await createSupabaseClient();
  const tenantId = await currentTenantId();

  // Tasks point here with `on delete set null`, so they survive as unfiled
  // work rather than disappearing with the engagement.
  const { error } = await pending(supabase)
    .from("projects")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) log.error("projects.delete", "delete_failed", { code: error.code });

  revalidatePath(`/${locale}/projects`);
  redirect(localePath(locale, "/projects"));
}
