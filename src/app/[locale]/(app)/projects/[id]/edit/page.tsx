import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import {
  TaskForm,
  type AssigneeChoice,
  type ClientChoice,
} from "../../_components/TaskForm";
import { updateTaskAction } from "../../actions";
import { DeleteTaskButton } from "./DeleteTaskButton";
import type { Database } from "@/types/database";

type Task = Database["public"]["Tables"]["tasks"]["Row"];

export default async function EditTaskPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("tasks");

  const supabase = await createClient();
  const { data } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const task = data as Task;

  const { data: clientsData } = await supabase
    .from("clients")
    .select("id, name, status")
    .neq("status", "archived")
    .order("name", { ascending: true });
  const clients: ClientChoice[] = (clientsData ?? []).map((c) => ({
    id: c.id,
    name: c.name,
  }));

  const { data: profilesData } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .order("full_name", { ascending: true });
  const assignees: AssigneeChoice[] = (profilesData ?? []).map((p) => ({
    id: p.id,
    label: p.full_name ?? p.email,
  }));

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <Link
            href="/projects"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← {t("title")}
          </Link>
          <h1 className="mt-2 font-display text-4xl text-foreground">
            {t("editTitle")}
          </h1>
        </div>
        <DeleteTaskButton
          taskId={task.id}
          locale={locale}
          label={t("delete")}
          confirmLabel={t("confirmDelete")}
        />
      </div>
      <TaskForm
        locale={locale}
        initial={task}
        clients={clients}
        assignees={assignees}
        action={updateTaskAction}
        submitLabel={t("saveSubmit")}
      />
    </div>
  );
}
