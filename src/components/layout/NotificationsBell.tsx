"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { markAllNotificationsReadAction } from "@/app/[locale]/(app)/_notifications-actions";

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

export function NotificationsBell({
  locale,
  notifications,
  unreadCount,
}: {
  locale: string;
  notifications: NotificationItem[];
  unreadCount: number;
}) {
  const t = useTranslations("notifications");
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function onMarkAll() {
    const fd = new FormData();
    fd.set("locale", locale);
    startTransition(() => markAllNotificationsReadAction(fd));
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted"
        aria-label={t("title")}
        data-testid="notifications-bell"
      >
        <BellIcon className="h-5 w-5 text-muted-foreground" />
        {unreadCount > 0 ? (
          <span
            className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground"
            data-testid="notifications-unread"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className="absolute right-0 top-full z-20 mt-2 w-80 rounded-md border border-border bg-card shadow-lg"
          onBlur={() => setOpen(false)}
          data-testid="notifications-dropdown"
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-sm font-medium">{t("title")}</span>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={onMarkAll}
                disabled={isPending}
                className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                {t("markAllRead")}
              </button>
            ) : null}
          </div>
          {notifications.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              {t("empty")}
            </p>
          ) : (
            <ul className="max-h-80 divide-y divide-border overflow-y-auto">
              {notifications.map((n) => {
                const content = (
                  <div className="space-y-0.5">
                    <div className="flex items-start gap-2">
                      {!n.read_at ? (
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      ) : null}
                      <span className="font-medium">{n.title}</span>
                    </div>
                    {n.body ? (
                      <p className="pl-4 text-xs text-muted-foreground">
                        {n.body}
                      </p>
                    ) : null}
                  </div>
                );
                return (
                  <li key={n.id} className="px-3 py-2 text-sm hover:bg-muted">
                    {n.link ? (
                      <Link
                        href={n.link as "/projects"}
                        onClick={() => setOpen(false)}
                      >
                        {content}
                      </Link>
                    ) : (
                      content
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 4 1.5 5 2 6H4c.5-1 2-2 2-6z" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </svg>
  );
}
