import { setRequestLocale, getTranslations, getFormatter } from "next-intl/server";
import { Link } from "@/i18n/routing";
import type { Route } from "next";

import { PageHeader } from "@/components/ui/PageHeader";
import { waitingFor, type SocialPiece } from "@/lib/social";
import { loadScope } from "../_data";
import { ModuleShell } from "../_components/ModuleShell";

export const dynamic = "force-dynamic";

export default async function WaitingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, format, scope] = await Promise.all([
    getTranslations("social"),
    getFormatter(),
    loadScope(searchParams),
  ]);

  const date = (iso: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
    const [y, m, d] = iso.split("-").map((n) => Number.parseInt(n, 10));
    return format.dateTime(new Date(Date.UTC(y, m - 1, d)), {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
  };

  const entries = waitingFor(scope.caps, {
    pieces: scope.pieces as SocialPiece[],
    clients: scope.clientIndex,
    today: scope.today,
  });

  return (
    <>
      <PageHeader
        title={t("waiting.title")}
        subtitle={t(`waiting.subtitleFor.${primaryCap(scope.caps)}`)}
      />
      <ModuleShell scope={scope} />

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {entries.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-muted-foreground">
            {t("waiting.clear")}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {entries.map((e, i) => {
              const values = Object.fromEntries(
                Object.entries(e.values ?? {}).map(([k, v]) => [
                  k,
                  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)
                    ? date(v)
                    : v,
                ]),
              );
              const href = e.id
                ? (`/social/pieces/${e.id}` as Route)
                : (`/social/backlog?client=${
                    scope.clients.find((c) => c.id === e.clientId)?.slug ?? ""
                  }` as Route);
              return (
                <li key={`${e.id ?? e.clientId}-${e.reason}-${i}`}>
                  <Link
                    href={href}
                    className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/50"
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full bg-brand" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-foreground">
                        {e.title}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {t(`waiting.reasons.${e.reason}`, values)}
                      </span>
                    </span>
                    <svg
                      className="h-4 w-4 shrink-0 text-muted-foreground/40"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="mt-4 rounded-xl border-l-2 border-brand bg-muted/40 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
        {t(`waiting.footnote.${primaryCap(scope.caps)}`)}
      </p>
    </>
  );
}

/** The hat the reader mostly wears — decides the framing, not the contents. */
function primaryCap(caps: string[]): string {
  for (const c of ["client", "design", "direction", "coordinate", "publish"]) {
    if (caps.includes(c)) return c;
  }
  return "coordinate";
}
