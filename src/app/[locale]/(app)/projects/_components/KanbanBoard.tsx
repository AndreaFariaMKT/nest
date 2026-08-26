"use client";

import {
  useOptimistic,
  useState,
  useTransition,
  type DragEvent,
  startTransition as startTransitionBase,
} from "react";
import { useTranslations } from "next-intl";

import { FormError } from "@/components/ui/FormError";
import { useRouter, usePathname } from "@/i18n/routing";
import { Link } from "@/i18n/routing";
import { Pill } from "@/components/ui/Pill";
import type { TaskPriority, TaskStatus } from "@/types/database";
import { TASK_STATUSES } from "@/types/database";
import { updateTaskStatusAction } from "../actions";

export type KanbanTask = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_at: string | null;
  client_name: string | null;
  assignee_label: string | null;
};

export type FilterOption = { id: string; label: string };

const priorityTone = {
  low: "muted",
  medium: "default",
  high: "warning",
  urgent: "danger",
} as const;

export function KanbanBoard({
  locale,
  tasks,
  clients,
  assignees,
  currentClient,
  currentAssignee,
}: {
  locale: string;
  tasks: KanbanTask[];
  clients: FilterOption[];
  assignees: FilterOption[];
  currentClient: string;
  currentAssignee: string;
}) {
  const t = useTranslations("tasks");
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  const [optimistic, setOptimistic] = useOptimistic<
    KanbanTask[],
    { id: string; status: TaskStatus }
  >(tasks, (state, { id, status }) =>
    state.map((task) => (task.id === id ? { ...task, status } : task)),
  );

  const [error, setError] = useState<string | null>(null);

  function onDropStatus(taskId: string, newStatus: TaskStatus) {
    const current = optimistic.find((t) => t.id === taskId);
    if (!current || current.status === newStatus) return;
    startTransition(async () => {
      setOptimistic({ id: taskId, status: newStatus });
      const fd = new FormData();
      fd.set("id", taskId);
      fd.set("status", newStatus);
      fd.set("locale", locale);
      const result = await updateTaskStatusAction(fd);
      // The card has already moved. A refused write used to leave it in its
      // new column until something happened to refresh the page, and then it
      // jumped back with nothing said.
      setError(result.ok ? null : (result.error ?? "dbFailed"));
    });
  }

  function updateFilter(kind: "client" | "assignee", value: string) {
    const params = new URLSearchParams();
    const next = { client: currentClient, assignee: currentAssignee };
    next[kind] = value;
    if (next.client) params.set("client", next.client);
    if (next.assignee) params.set("assignee", next.assignee);
    const query = params.toString();
    startTransitionBase(() => {
      router.replace(
        // next-intl router accepts a href object; "query" must be plain object
        { pathname: pathname as "/projects", query: Object.fromEntries(params) },
      );
    });
  }

  return (
    <div className="space-y-5">
      <FormError error={error} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <FilterSelect
            label={t("fields.client")}
            name="client"
            value={currentClient}
            options={clients}
            placeholder={t("filters.allClients")}
            onChange={(v) => updateFilter("client", v)}
          />
          <FilterSelect
            label={t("fields.assignee")}
            name="assignee"
            value={currentAssignee}
            options={assignees}
            placeholder={t("filters.allAssignees")}
            onChange={(v) => updateFilter("assignee", v)}
          />
        </div>
        <Link
          href="/projects/new"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {t("new")}
        </Link>
      </div>

      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${TASK_STATUSES.length}, minmax(0, 1fr))` }}
      >
        {TASK_STATUSES.map((status) => {
          const columnTasks = optimistic.filter((task) => task.status === status);
          return (
            <Column
              key={status}
              locale={locale}
              status={status}
              title={t(`status.${status}`)}
              tasks={columnTasks}
              onDropTask={(id) => onDropStatus(id, status)}
            />
          );
        })}
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  name,
  value,
  options,
  placeholder,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  options: FilterOption[];
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <select
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="flex h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Column({
  locale,
  status,
  title,
  tasks,
  onDropTask,
}: {
  locale: string;
  status: TaskStatus;
  title: string;
  tasks: KanbanTask[];
  onDropTask: (taskId: string) => void;
}) {
  function onDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const id = event.dataTransfer.getData("text/plain");
    if (id) onDropTask(id);
  }

  return (
    <div
      className="flex min-h-[200px] flex-col rounded-lg border border-border bg-muted/40"
      data-testid={`kanban-column-${status}`}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="flex items-center justify-between px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span>{title}</span>
        <span>{tasks.length}</span>
      </div>
      <div className="flex flex-1 flex-col gap-2 px-2 pb-2">
        {tasks.map((task) => (
          <TaskCard key={task.id} locale={locale} task={task} />
        ))}
      </div>
    </div>
  );
}

function TaskCard({ locale, task }: { locale: string; task: KanbanTask }) {
  const t = useTranslations("tasks");

  function onDragStart(event: DragEvent<HTMLAnchorElement>) {
    event.dataTransfer.setData("text/plain", task.id);
    event.dataTransfer.effectAllowed = "move";
  }

  return (
    <Link
      href={`/projects/${task.id}/edit`}
      draggable
      onDragStart={onDragStart}
      data-testid="kanban-task"
      className="block rounded-md border border-border bg-card p-3 text-sm transition-colors hover:border-foreground/20 active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-foreground">{task.title}</span>
        <Pill tone={priorityTone[task.priority]} className="shrink-0 text-[10px]">
          {t(`priority.${task.priority}`)}
        </Pill>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
        {task.client_name ? (
          <span>{task.client_name}</span>
        ) : (
          <span>{t("fields.internal")}</span>
        )}
        {task.assignee_label ? (
          <>
            <span>·</span>
            <span>{task.assignee_label}</span>
          </>
        ) : null}
        {task.due_at ? (
          <>
            <span>·</span>
            <span>
              {new Intl.DateTimeFormat(locale, {
                dateStyle: "short",
              }).format(new Date(task.due_at))}
            </span>
          </>
        ) : null}
      </div>
    </Link>
  );
}
