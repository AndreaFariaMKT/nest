"use server";

import { dbError } from "@/lib/db-error";
import { revalidatePath } from "next/cache";
import { log } from "@/lib/log";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import { slugify, uniqueSlug } from "@/lib/slug";
import { parseBrlToCents } from "@/lib/money";
import { studioDayInstant, todayIso } from "@/lib/social";
import { planFlow, type FlowStep } from "@/lib/project-flow";
import { isProjectStatus, isProjectType } from "@/lib/projects";
// Temporary while 048 is unapplied — see the file for why.

export type ProjectFormState = {
  error?: string;
  fieldErrors?: Partial<Record<"name" | "type" | "dates" | "value", string>>;
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
    rawValue: optional(formData, "service_value"),
    currency: (formData.get("currency") ?? "BRL").toString() === "USD" ? "USD" : "BRL",
    contractUrl: optional(formData, "contract_url"),
    proposalUrl: optional(formData, "proposal_url"),
    paymentTerms: optional(formData, "payment_terms"),
    locale: (formData.get("locale") ?? "pt-BR").toString(),
  };
}

type Form = ReturnType<typeof readForm>;

/** A form that has been through validate(): `type` is settled. */
type ValidForm = Form & { type: NonNullable<Form["type"]> };

function validate(form: Form): ProjectFormState | null {
  if (form.name.length < 2) return { fieldErrors: { name: "tooShort" } };
  if (form.name.length > 120) return { fieldErrors: { name: "tooLong" } };
  if (!form.type) return { fieldErrors: { type: "required" } };
  // The DB carries the same rule (projects_dates_ordered). Checking here means
  // the person sees it on the field instead of as a failed save.
  if (form.startsOn && form.endsOn && form.endsOn < form.startsOn) {
    return { fieldErrors: { dates: "endsBeforeStarts" } };
  }
  // parseBrlToCents refuses a lone dot that reads as thousands, among other
  // shapes — a null here is a typo, not an empty field.
  if (form.rawValue && parseBrlToCents(form.rawValue) === null) {
    return { fieldErrors: { value: "invalidValue" } };
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
  await supabase.from("project_members").delete().eq("project_id", projectId);
  if (memberIds.length === 0) return null;

  const rows = memberIds.map((userId) => ({
    project_id: projectId,
    user_id: userId,
    tenant_id: tenantId,
  }));
  const { error } = await supabase.from("project_members").insert(rows);
  return error;
}

export async function createProjectAction(
  _prev: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const form = readForm(formData);
  const invalid = validate(form);
  if (invalid) return invalid;
  // validate() refuses a null type, so this narrowing is a statement of what
  // already holds rather than an assumption.
  const valid = form as ValidForm;

  const supabase = await createSupabaseClient();
  const tenantId = await currentTenantId();

  // Unique per tenant, not globally — two houses may both run a "Rebranding".
  const slug = await uniqueSlug(slugify(form.name), "projeto", async (s) => {
    const { data } = await supabase
      .from("projects")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("slug", s)
      .limit(1)
      .maybeSingle();
    return !!data;
  });

  const { data, error } = await supabase
    .from("projects")
    .insert({
      tenant_id: tenantId,
      client_id: form.clientId,
      name: form.name,
      slug,
      type: valid.type,
      status: valid.status,
      scope: form.scope,
      starts_on: form.startsOn,
      ends_on: form.endsOn,
      service_value_cents: form.rawValue ? parseBrlToCents(form.rawValue) : null,
      currency: form.currency,
      contract_url: form.contractUrl,
      proposal_url: form.proposalUrl,
      payment_terms: form.paymentTerms,
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
  const valid = form as ValidForm;

  const supabase = await createSupabaseClient();
  const tenantId = await currentTenantId();

  const { error } = await supabase
    .from("projects")
    .update({
      client_id: form.clientId,
      name: form.name,
      type: valid.type,
      status: valid.status,
      scope: form.scope,
      starts_on: form.startsOn,
      ends_on: form.endsOn,
      service_value_cents: form.rawValue ? parseBrlToCents(form.rawValue) : null,
      currency: form.currency,
      contract_url: form.contractUrl,
      proposal_url: form.proposalUrl,
      payment_terms: form.paymentTerms,
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
  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) log.error("projects.delete", "delete_failed", { code: error.code });

  revalidatePath(`/${locale}/projects`);
  redirect(localePath(locale, "/projects"));
}

/**
 * Run a project type's flow, creating its tasks.
 *
 * Guarded by `flow_applied_at`: running it twice would double the board, and
 * the second run is always an accident. Re-running deliberately means clearing
 * that column, which is a decision rather than a double-click.
 *
 * Dates come out as business days from the project's start — see
 * @/lib/project-flow — and each task is assigned to whoever holds the step's
 * role on this project, falling back to the tenant. A step whose role nobody
 * holds is still created, unassigned: work that is visible and unowned beats
 * work that was silently dropped.
 */
export async function applyProjectFlowAction(formData: FormData): Promise<void> {
  const id = (formData.get("id") ?? "").toString();
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  if (!id) return;

  const supabase = await createSupabaseClient();
  const tenantId = await currentTenantId();

  const { data: project } = await supabase
    .from("projects")
    .select("id, type, starts_on, client_id, flow_applied_at")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!project || project.flow_applied_at) return;

  const [{ data: stepData }, { data: memberData }, { data: tenantMembers }] =
    await Promise.all([
      supabase
        .from("project_flow_steps")
        .select("id, title, description, role, offset_days, priority, sort")
        .eq("tenant_id", tenantId)
        .eq("project_type", project.type),
      supabase
        .from("project_members")
        .select("user_id, role_on_project")
        .eq("project_id", id),
      supabase
        .from("tenant_members")
        .select("user_id, role")
        .eq("tenant_id", tenantId),
    ]);

  const steps = (stepData ?? []) as FlowStep[];
  if (steps.length === 0) return;

  const planned = planFlow(
    steps,
    // A project with no start date runs from today rather than refusing: the
    // flow is more useful slightly wrong about dates than not run at all.
    project.starts_on ?? todayIso(),
    ((memberData ?? []) as Array<{ user_id: string; role_on_project: string | null }>)
      .map((m) => ({ user_id: m.user_id, role: m.role_on_project })),
    ((tenantMembers ?? []) as Array<{ user_id: string; role: string }>)
      .map((m) => ({ user_id: m.user_id, role: m.role })),
  );

  const { error } = await supabase.from("tasks").insert(
    planned.map((task) => ({
      tenant_id: tenantId,
      title: task.title,
      description: task.description,
      status: "todo" as const,
      priority: task.priority as "low" | "medium" | "high" | "urgent",
      due_at: studioDayInstant(task.due_on),
      assignee_id: task.assignee_id,
      client_id: project.client_id,
      is_template: false,
      ...({ project_id: id } as Record<string, string>),
    })),
  );

  if (error) {
    log.error("projects.flow", "insert_failed", { code: error.code });
    return;
  }

  await supabase
    .from("projects")
    .update({ flow_applied_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", tenantId);

  revalidatePath(`/${locale}/projects/${id}`);
  revalidatePath(`/${locale}/tasks`);
}
