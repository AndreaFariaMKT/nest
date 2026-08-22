"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import type { MeetingFormState } from "../actions";
import type { MeetingStatus } from "@/types/database";
import { MEETING_STATUSES } from "@/types/database";

export type ClientChoice = { id: string; name: string };

type InitialMeeting = {
  id?: string;
  title: string;
  clientId: string | null;
  startsAt: string | null;
  endsAt: string | null;
  status: MeetingStatus;
  googleMeetUrl: string | null;
  summary: string | null;
  agendaUrl: string | null;
  transcriptUrl: string | null;
  decisions: string[];
};

// Format an ISO timestamp as "YYYY-MM-DDTHH:mm" in the user's local timezone,
// which is what the <input type="datetime-local"> expects.
function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function MeetingForm({
  locale,
  clients,
  meeting,
  action,
  submitLabel,
}: {
  locale: string;
  clients: ClientChoice[];
  meeting?: InitialMeeting;
  action: (
    prev: MeetingFormState,
    formData: FormData,
  ) => Promise<MeetingFormState>;
  submitLabel: string;
}) {
  const t = useTranslations("meetings");
  const [state, formAction] = useActionState<MeetingFormState, FormData>(
    action,
    {},
  );

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="locale" value={locale} />
      {meeting?.id ? (
        <input type="hidden" name="meetingId" value={meeting.id} />
      ) : null}

      <div className="space-y-1.5">
        <label
          htmlFor="title"
          className="text-sm font-medium text-foreground"
        >
          {t("fields.title")}
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          defaultValue={meeting?.title ?? ""}
          minLength={2}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          data-testid="meeting-title"
        />
        {state.fieldErrors?.title ? (
          <p className="text-xs text-destructive">
            {t(`errors.${state.fieldErrors.title}`)}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <label
            htmlFor="starts_at"
            className="text-sm font-medium text-foreground"
          >
            {t("fields.startsAt")}
          </label>
          <input
            id="starts_at"
            name="starts_at"
            type="datetime-local"
            required
            defaultValue={toLocalInputValue(meeting?.startsAt ?? null)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            data-testid="meeting-starts-at"
          />
          {state.fieldErrors?.starts_at ? (
            <p className="text-xs text-destructive">
              {t(`errors.${state.fieldErrors.starts_at}`)}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="ends_at"
            className="text-sm font-medium text-foreground"
          >
            {t("fields.endsAt")}
          </label>
          <input
            id="ends_at"
            name="ends_at"
            type="datetime-local"
            defaultValue={toLocalInputValue(meeting?.endsAt ?? null)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <label
            htmlFor="client_id"
            className="text-sm font-medium text-foreground"
          >
            {t("fields.client")}
          </label>
          <select
            id="client_id"
            name="client_id"
            defaultValue={meeting?.clientId ?? ""}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">{t("fields.noClient")}</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="status"
            className="text-sm font-medium text-foreground"
          >
            {t("fields.status")}
          </label>
          <select
            id="status"
            name="status"
            defaultValue={meeting?.status ?? "scheduled"}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {MEETING_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`status.${s}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="google_meet_url"
          className="text-sm font-medium text-foreground"
        >
          {t("fields.meetUrl")}
        </label>
        <input
          id="google_meet_url"
          name="google_meet_url"
          type="url"
          defaultValue={meeting?.googleMeetUrl ?? ""}
          placeholder="https://meet.google.com/..."
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <p className="text-xs text-muted-foreground">{t("fields.meetHint")}</p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="summary" className="text-sm font-medium text-foreground">
          {t("fields.summary")}
        </label>
        <textarea
          id="summary"
          name="summary"
          rows={3}
          defaultValue={meeting?.summary ?? ""}
          placeholder={t("fields.summaryPlaceholder")}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="agenda_url" className="text-sm font-medium text-foreground">
            {t("fields.agendaUrl")}
          </label>
          <input
            id="agenda_url"
            name="agenda_url"
            type="url"
            defaultValue={meeting?.agendaUrl ?? ""}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="transcript_url" className="text-sm font-medium text-foreground">
            {t("fields.transcriptUrl")}
          </label>
          <input
            id="transcript_url"
            name="transcript_url"
            type="url"
            defaultValue={meeting?.transcriptUrl ?? ""}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {/* The transcript is the record; this list is what anyone actually reads
          three months later. A meeting with no decision written down is a
          meeting that will be held again. */}
      <div className="space-y-1.5">
        <label htmlFor="decisions" className="text-sm font-medium text-foreground">
          {t("fields.decisions")}
        </label>
        <textarea
          id="decisions"
          name="decisions"
          rows={4}
          defaultValue={(meeting?.decisions ?? []).join("\n")}
          placeholder={t("fields.decisionsPlaceholder")}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <p className="text-xs text-muted-foreground">{t("fields.decisionsHint")}</p>
      </div>

      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}

      <div className="flex items-center justify-end">
        <button
          type="submit"
          className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          data-testid="meeting-submit"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
