"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type Database,
} from "@/types/database";
import type { TaskFormState } from "../actions";

type Task = Database["public"]["Tables"]["tasks"]["Row"];

function toLocalInput(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  // Return in local timezone formatted for <input type="datetime-local">
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export type ClientChoice = { id: string; name: string };
export type AssigneeChoice = { id: string; label: string };

export function TaskForm({
  locale,
  initial,
  clients,
  assignees,
  action,
  submitLabel,
}: {
  locale: string;
  initial?: Task | null;
  clients: ClientChoice[];
  assignees: AssigneeChoice[];
  action: (
    state: TaskFormState,
    formData: FormData,
  ) => Promise<TaskFormState>;
  submitLabel: string;
}) {
  const t = useTranslations("tasks");
  const tCommon = useTranslations("common");
  const [state, formAction, isPending] = useActionState<TaskFormState, FormData>(
    action,
    {},
  );

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="locale" value={locale} />
      {initial ? <input type="hidden" name="id" value={initial.id} /> : null}

      <div className="space-y-1.5">
        <Label htmlFor="title">{t("fields.title")}</Label>
        <Input
          id="title"
          name="title"
          required
          minLength={2}
          maxLength={200}
          defaultValue={initial?.title ?? ""}
        />
        {state.fieldErrors?.title ? (
          <p className="text-xs text-destructive">
            {t(`errors.${state.fieldErrors.title}`)}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">{t("fields.description")}</Label>
        <Textarea
          id="description"
          name="description"
          rows={4}
          maxLength={2000}
          defaultValue={initial?.description ?? ""}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="status">{t("fields.status")}</Label>
          <select
            id="status"
            name="status"
            defaultValue={initial?.status ?? "todo"}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`status.${s}`)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="priority">{t("fields.priority")}</Label>
          <select
            id="priority"
            name="priority"
            defaultValue={initial?.priority ?? "medium"}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {TASK_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {t(`priority.${p}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="due_at">{t("fields.dueAt")}</Label>
          <Input
            id="due_at"
            name="due_at"
            type="datetime-local"
            defaultValue={toLocalInput(initial?.due_at)}
          />
          {state.fieldErrors?.due_at ? (
            <p className="text-xs text-destructive">
              {t(`errors.${state.fieldErrors.due_at}`)}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="assignee_id">{t("fields.assignee")}</Label>
          <select
            id="assignee_id"
            name="assignee_id"
            defaultValue={initial?.assignee_id ?? ""}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">{t("fields.unassigned")}</option>
            {assignees.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="client_id">{t("fields.client")}</Label>
        <select
          id="client_id"
          name="client_id"
          defaultValue={initial?.client_id ?? ""}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">{t("fields.internal")}</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="is_template"
          defaultChecked={initial?.is_template ?? false}
          className="h-4 w-4"
          data-testid="task-template-checkbox"
        />
        <span>{t("fields.isTemplate")}</span>
        <span className="text-xs text-muted-foreground">
          {t("fields.isTemplateHint")}
        </span>
      </label>

      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}

      <div className="flex items-center justify-end gap-2 pt-2">
        <Link
          href="/projects"
          className="inline-flex h-10 items-center rounded-md px-4 text-sm text-muted-foreground hover:text-foreground"
        >
          {tCommon("cancel")}
        </Link>
        <Button type="submit" disabled={isPending}>
          {isPending ? tCommon("loading") : submitLabel}
        </Button>
      </div>
    </form>
  );
}
