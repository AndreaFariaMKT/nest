"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { currentYearMonth } from "@/lib/cycles";
import type { TaskPriority, TaskStatus } from "@/types/database";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/types/database";

export type TaskFormState = {
  error?: string;
  fieldErrors?: Partial<Record<"title" | "due_at", string>>;
};

function localePath(locale: string, path: string): Route {
  return (locale === "pt-BR" ? path : `/${locale}${path}`) as Route;
}

function readForm(formData: FormData) {
  const title = (formData.get("title") ?? "").toString().trim();
  const description =
    (formData.get("description") ?? "").toString().trim() || null;
  const rawStatus = (formData.get("status") ?? "todo").toString();
  const status: TaskStatus = (TASK_STATUSES as string[]).includes(rawStatus)
    ? (rawStatus as TaskStatus)
    : "todo";
  const rawPriority = (formData.get("priority") ?? "medium").toString();
  const priority: TaskPriority = (TASK_PRIORITIES as string[]).includes(
    rawPriority,
  )
    ? (rawPriority as TaskPriority)
    : "medium";
  const rawDue = (formData.get("due_at") ?? "").toString().trim();
  const dueAt = rawDue ? new Date(rawDue).toISOString() : null;
  const assigneeId =
    (formData.get("assignee_id") ?? "").toString().trim() || null;
  const clientId =
    (formData.get("client_id") ?? "").toString().trim() || null;
  const locale = (formData.get("locale") ?? "pt-BR").toString();

  return {
    title,
    description,
    status,
    priority,
    dueAt,
    rawDue,
    assigneeId,
    clientId,
    locale,
  };
}

async function resolveCurrentCycle(
  supabase: Awaited<ReturnType<typeof createSupabaseClient>>,
  clientId: string | null,
): Promise<string | null> {
  if (!clientId) return null;
  const { year, month } = currentYearMonth();
  const { data } = await supabase
    .from("cycles")
    .select("id")
    .eq("client_id", clientId)
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();
  return data?.id ?? null;
}

export async function createTaskAction(
  _prev: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const form = readForm(formData);
  if (form.title.length < 2) return { fieldErrors: { title: "tooShort" } };
  if (form.rawDue && !form.dueAt) {
    return { fieldErrors: { due_at: "invalid" } };
  }

  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const cycleId = await resolveCurrentCycle(supabase, form.clientId);

  const { error, data } = await supabase
    .from("tasks")
    .insert({
      title: form.title,
      description: form.description,
      status: form.status,
      priority: form.priority,
      due_at: form.dueAt,
      assignee_id: form.assigneeId,
      client_id: form.clientId,
      cycle_id: cycleId,
      created_by: user?.id ?? null,
      completed_at: form.status === "done" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath(`/${form.locale}/projects`);
  redirect(localePath(form.locale, `/projects/${data.id}/edit`));
}

export async function updateTaskAction(
  _prev: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const id = (formData.get("id") ?? "").toString();
  if (!id) return { error: "Missing task id." };
  const form = readForm(formData);
  if (form.title.length < 2) return { fieldErrors: { title: "tooShort" } };
  if (form.rawDue && !form.dueAt) {
    return { fieldErrors: { due_at: "invalid" } };
  }

  const supabase = await createSupabaseClient();
  const { data: existing } = await supabase
    .from("tasks")
    .select("status, completed_at, client_id")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return { error: "Task not found." };

  // Re-resolve cycle only when client changed
  let cycleId: string | null | undefined = undefined;
  if (existing.client_id !== form.clientId) {
    cycleId = await resolveCurrentCycle(supabase, form.clientId);
  }

  let completedAt = existing.completed_at;
  if (form.status === "done" && existing.status !== "done") {
    completedAt = new Date().toISOString();
  } else if (form.status !== "done" && existing.status === "done") {
    completedAt = null;
  }

  const update: Record<string, unknown> = {
    title: form.title,
    description: form.description,
    status: form.status,
    priority: form.priority,
    due_at: form.dueAt,
    assignee_id: form.assigneeId,
    client_id: form.clientId,
    completed_at: completedAt,
  };
  if (cycleId !== undefined) update.cycle_id = cycleId;

  const { error } = await supabase.from("tasks").update(update).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(`/${form.locale}/projects`);
  revalidatePath(`/${form.locale}/projects/${id}/edit`);
  redirect(localePath(form.locale, "/projects"));
}

export async function deleteTaskAction(formData: FormData): Promise<void> {
  const id = (formData.get("id") ?? "").toString();
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  if (!id) return;
  const supabase = await createSupabaseClient();
  await supabase.from("tasks").delete().eq("id", id);
  revalidatePath(`/${locale}/projects`);
}

export async function updateTaskStatusAction(
  formData: FormData,
): Promise<void> {
  const id = (formData.get("id") ?? "").toString();
  const rawStatus = (formData.get("status") ?? "").toString();
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  if (!id || !(TASK_STATUSES as string[]).includes(rawStatus)) return;
  const status = rawStatus as TaskStatus;

  const supabase = await createSupabaseClient();
  const { data: existing } = await supabase
    .from("tasks")
    .select("status, completed_at")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return;

  let completedAt = existing.completed_at;
  if (status === "done" && existing.status !== "done") {
    completedAt = new Date().toISOString();
  } else if (status !== "done" && existing.status === "done") {
    completedAt = null;
  }

  await supabase
    .from("tasks")
    .update({ status, completed_at: completedAt })
    .eq("id", id);

  revalidatePath(`/${locale}/projects`);
}
