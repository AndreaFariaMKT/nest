import { listAssignablePeople } from "@/lib/people";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/routing";
import { OPTION_LIST_CAP } from "@/lib/pagination";
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
    .order("name", { ascending: true })
    .limit(OPTION_LIST_CAP);
  const clients: ClientChoice[] = (clientsData ?? []).map((c) => ({
    id: c.id,
    name: c.name,
  }));

  // Not `profiles`: that table's `role` column is the legacy enum the
  // app never writes, so filtering on it matched everyone and not
  // filtering matched every tenant. See listAssignablePeople.
  const assignees: AssigneeChoice[] = await listAssignablePeople();

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
