"use client";

import { useOptimistic, useTransition } from "react";
import type { MeetingStatus } from "@/types/database";
import { rescheduleMeetingAction } from "../../meetings/actions";

export type CalendarMeeting = {
  id: string;
  title: string;
  starts_at: string; // ISO
  status: MeetingStatus;
  dateKey: string; // YYYY-MM-DD bucket
};

export type CalendarCell = {
  date: string; // YYYY-MM-DD
  dayOfMonth: number;
  outside: boolean;
};

type Props = {
  locale: string;
  cells: CalendarCell[];
  weekdayLabels: string[];
  meetings: CalendarMeeting[];
  todayKey: string;
};

function statusDotColor(s: MeetingStatus): string {
  if (s === "completed") return "bg-emerald-500";
  if (s === "cancelled") return "bg-destructive/60";
  return "bg-primary";
}

type OptimisticAction = { meetingId: string; newDateKey: string };

export function CalendarGrid({
  locale,
  cells,
  weekdayLabels,
  meetings,
  todayKey,
}: Props) {
  const [, startTransition] = useTransition();
  const [optimisticMeetings, applyOptimistic] = useOptimistic(
    meetings,
    (current, action: OptimisticAction) =>
      current.map((m) =>
        m.id === action.meetingId ? { ...m, dateKey: action.newDateKey } : m,
      ),
  );

  // Bucket meetings by dateKey for O(1) cell lookup.
  const byDay = new Map<string, CalendarMeeting[]>();
  for (const m of optimisticMeetings) {
    const list = byDay.get(m.dateKey) ?? [];
    list.push(m);
    byDay.set(m.dateKey, list);
  }

  function handleDrop(targetDate: string, event: React.DragEvent) {
    event.preventDefault();
    const meetingId = event.dataTransfer.getData("text/plain");
    if (!meetingId) return;
    const current = optimisticMeetings.find((m) => m.id === meetingId);
    if (!current || current.dateKey === targetDate) return;

    startTransition(async () => {
      applyOptimistic({ meetingId, newDateKey: targetDate });
      const fd = new FormData();
      fd.set("meetingId", meetingId);
      fd.set("newDate", targetDate);
      fd.set("locale", locale);
      await rescheduleMeetingAction(fd);
    });
  }

  return (
    <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-border bg-border text-sm">
      {weekdayLabels.map((label) => (
        <div
          key={label}
          className="bg-card px-2 py-1.5 text-center text-xs uppercase tracking-wide text-muted-foreground"
        >
          {label}
        </div>
      ))}
      {cells.map((cell) => {
        const dayMeetings = byDay.get(cell.date) ?? [];
        const isToday = cell.date === todayKey;
        return (
          <div
            key={cell.date}
            className={`min-h-[90px] bg-background p-2 transition-colors ${
              cell.outside ? "text-muted-foreground/60" : "text-foreground"
            }`}
            data-testid="calendar-cell"
            data-date={cell.date}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(cell.date, e)}
          >
            <div className="mb-1 flex items-center justify-between">
              <span
                className={`text-xs font-medium ${
                  isToday
                    ? "flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
                    : ""
                }`}
              >
                {cell.dayOfMonth}
              </span>
            </div>
            <ul className="space-y-1">
              {dayMeetings.map((m) => (
                <li key={m.id}>
                  <a
                    href={`/${locale === "pt-BR" ? "" : `${locale}/`}meetings/${m.id}`}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", m.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    className="flex cursor-grab items-center gap-1.5 truncate rounded-sm px-1 py-0.5 text-xs hover:bg-muted active:cursor-grabbing"
                    data-testid="calendar-meeting"
                  >
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDotColor(m.status)}`}
                    />
                    <span className="truncate">{m.title}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
