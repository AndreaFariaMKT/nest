import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import type { Route } from "next";

import { isReplyOverdue } from "@/lib/social";
import type { SocialScope } from "../_data";
import { ClientFilter } from "./ClientFilter";

/**
 * The bar every module screen sits under.
 *
 * It used to be a row of thirteen tabs, each carrying a count. The row wrapped
 * onto two lines, and the counts had stopped meaning anything: four of the
 * five were lit on any ordinary fortnight, in the same grey, so "in flight, as
 * expected" and "past its reply date" looked identical.
 *
 * The screens moved to the sidebar. What is left here is the client filter —
 * which belongs to the page, not the navigation — and exactly one count: how
 * many pieces are past the date the client was given. That one is news, and it
 * is the only one that gets a colour.
 */
export async function ModuleShell({ scope }: { scope: SocialScope }) {
  const { pieces, clients, client } = scope;
  const t = await getTranslations("social");

  // Counted from the pieces, not from waitingFor(). `replyPassed` is emitted
  // only under `caps.includes("client")`, and no internal role holds that cap
  // — the guard bounces role `client` out of /social entirely. So this bar was
  // structurally always zero and never rendered on any of the eleven screens.
  // The count it needs is the studio-side one: how many pieces are sitting
  // with a client past the date that client was given.
  const overdue = pieces.filter(
    (p) =>
      (p.status === "client_review" || p.status === "changes_requested") &&
      isReplyOverdue(p.publish_on, scope.today),
  ).length;

  const suffix = client ? `?client=${client.slug}` : "";

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
      {overdue ? (
        <Link
          href={`/social/waiting${suffix}` as Route}
          className="rounded-md bg-destructive/10 px-3 py-1.5 text-sm text-destructive transition-colors hover:bg-destructive/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t("overdueBar", { n: overdue })}
        </Link>
      ) : (
        <span />
      )}

      <ClientFilter
        clients={clients.map((c) => ({ slug: c.slug, name: c.name }))}
        currentClient={client?.slug ?? ""}
      />
    </div>
  );
}
