"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Pill } from "@/components/ui/Pill";
import { resolveErrorAction } from "./actions";

export interface ErrorRow {
  id: string;
  ref: string;
  occurred_at: string;
  severity: string;
  source: string;
  area: string;
  scope: string;
  code: string | null;
  message: string | null;
  path: string | null;
  role: string | null;
  release: string | null;
  resolved_at: string | null;
  fingerprint: string;
}

const TONE: Record<string, "warning" | "danger" | "muted"> = {
  warn: "warning",
  error: "danger",
  fatal: "danger",
};

/**
 * The list, grouped by fingerprint.
 *
 * Grouping is the point. A crash-looping cron writes the same failure every
 * five minutes, and an ungrouped list becomes ten thousand identical rows with
 * everything else buried underneath — which is the state the hub's version
 * ends up in, because it has neither grouping nor retention.
 *
 * Timestamps are rendered in São Paulo explicitly. "2 h ago" is useless in a
 * message pasted to somebody else, and a bare toLocaleString renders
 * differently for every reader.
 */
export function ErrorLogList({
  rows,
  locale,
  query,
  showResolved,
}: {
  rows: ErrorRow[];
  locale: string;
  query: string;
  showResolved: boolean;
}) {
  const t = useTranslations("admin.errors");
  const [copied, setCopied] = useState<string | null>(null);
  const [copyFailed, setCopyFailed] = useState(false);

  const when = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: "short",
      timeStyle: "medium",
      timeZone: "America/Sao_Paulo",
    }).format(new Date(iso));

  const groups = new Map<string, ErrorRow[]>();
  for (const r of rows) {
    const list = groups.get(r.fingerprint) ?? [];
    list.push(r);
    groups.set(r.fingerprint, list);
  }

  async function copy(group: ErrorRow[]) {
    const head = group[0];
    const text = [
      `${head.ref} · ${head.severity} · ${head.area} / ${head.scope}`,
      `${t("occurrences", { n: group.length })} — ${when(head.occurred_at)}`,
      head.code ? `code: ${head.code}` : null,
      head.message ? `message: ${head.message}` : null,
      head.path ? `path: ${head.path}` : null,
      // The commit that was actually running, not the current deploy.
      head.release ? `release: ${head.release}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(head.ref);
      setCopyFailed(false);
    } catch {
      // Surfaced, not swallowed: a copy button that silently does nothing is
      // worse than no copy button.
      setCopyFailed(true);
    }
  }

  return (
    <>
      <form method="GET" className="mb-4 flex flex-wrap items-center gap-2">
        <input
          name="q"
          defaultValue={query}
          placeholder={t("searchPlaceholder")}
          className="w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            name="all"
            value="1"
            defaultChecked={showResolved}
            className="h-4 w-4 rounded border-input"
          />
          {t("showResolved")}
        </label>
        <button
          type="submit"
          className="rounded-md bg-muted px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/70"
        >
          {t("search")}
        </button>
      </form>

      {copyFailed ? (
        <p className="mb-3 text-xs text-destructive">{t("copyFailed")}</p>
      ) : null}

      {groups.size === 0 ? (
        <p className="rounded-2xl border border-border bg-card px-5 py-10 text-center text-sm text-muted-foreground">
          {query ? t("emptySearch") : t("empty")}
        </p>
      ) : (
        <ul className="space-y-3">
          {[...groups.values()].map((group) => {
            const head = group[0];
            return (
              <li
                key={head.fingerprint}
                className="rounded-2xl border border-border bg-card p-5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-brand">
                    {head.ref}
                  </span>
                  <Pill
                    tone={TONE[head.severity] ?? "muted"}
                    className="text-[10px]"
                  >
                    {head.severity}
                  </Pill>
                  <Pill tone="muted" className="text-[10px]">
                    {head.source}
                  </Pill>
                  {group.length > 1 ? (
                    <Pill tone="warning" className="text-[10px]">
                      {t("occurrences", { n: group.length })}
                    </Pill>
                  ) : null}
                  {head.resolved_at ? (
                    <Pill tone="success" className="text-[10px]">
                      {t("resolved")}
                    </Pill>
                  ) : null}
                  <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                    {when(head.occurred_at)}
                  </span>
                </div>

                <p className="mt-2 text-sm font-medium text-foreground">
                  {head.area} / {head.scope}
                </p>
                {head.message ? (
                  <p className="mt-1 break-words text-sm text-muted-foreground">
                    {head.message}
                  </p>
                ) : null}
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  {[head.code, head.path, head.role, head.release?.slice(0, 7)]
                    .filter(Boolean)
                    .join(" · ")}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => copy(group)}
                    className="text-xs font-medium text-brand underline-offset-2 hover:underline"
                  >
                    {copied === head.ref ? t("copied") : t("copy")}
                  </button>
                  {!head.resolved_at ? (
                    <form action={resolveErrorAction}>
                      <input type="hidden" name="fingerprint" value={head.fingerprint} />
                      <input type="hidden" name="locale" value={locale} />
                      <button
                        type="submit"
                        className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                      >
                        {t("markResolved")}
                      </button>
                    </form>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
