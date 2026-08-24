import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/ui/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { getActualRole } from "@/lib/roles-server";
import { ErrorLogList, type ErrorRow } from "./ErrorLogList";

export const dynamic = "force-dynamic";

/**
 * What broke, for the person who can do something about it.
 *
 * Founder only, and guarded twice: `/admin` is in guard.ts's RESTRICTED so the
 * middleware turns anyone else away, and this redirect stands on its own —
 * a link that is not rendered is not a permission, and neither is a middleware
 * rule somebody might edit.
 *
 * `getActualRole`, not `getCurrentRole`: a founder previewing the app as a
 * designer should see what a designer sees, and that does not include this.
 *
 * Read on the SESSION client, so the RLS policy in migration 036 is the real
 * gate. If this page's guard ever regresses, the database still refuses.
 */
export default async function ErrorsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  if ((await getActualRole()) !== "founder") redirect("/today");

  const t = await getTranslations("admin.errors");
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.trim() ?? "";
  const showResolved = (Array.isArray(sp.all) ? sp.all[0] : sp.all) === "1";

  const supabase = await createClient();
  let query = supabase
    .from("error_log")
    .select(
      "id, ref, occurred_at, severity, source, area, scope, code, message, path, role, release, resolved_at, fingerprint",
    )
    .order("occurred_at", { ascending: false })
    .limit(100);

  if (!showResolved) query = query.is("resolved_at", null);

  if (q) {
    // An exact match when it looks like a ref — that is the common case, and
    // `ref` is unique, so a LIKE would be a scan for no reason.
    if (/^NST-[A-Z0-9]{6}$/i.test(q)) {
      query = query.eq("ref", q.toUpperCase());
    } else {
      // Allowlist, not denylist: PostgREST parses this grammar, and stripping
      // a handful of characters is not the same as controlling what is left.
      const safe = q.replace(/[^A-Za-z0-9 ._-]/g, " ").trim();
      if (safe) query = query.or(`area.ilike.%${safe}%,scope.ilike.%${safe}%`);
    }
  }

  const { data } = await query;
  const rows = (data ?? []) as ErrorRow[];

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <ErrorLogList
        rows={rows}
        locale={locale}
        query={q}
        showResolved={showResolved}
      />
    </>
  );
}
