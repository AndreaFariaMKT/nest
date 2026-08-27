import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { OPTION_LIST_CAP } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";
import { isOwner } from "@/lib/roles-server";
import { currentTenantId } from "@/lib/tenant-server";
import { estimateCostUsd, formatUsd } from "@/lib/claude-pricing";

type AiEditRow = {
  id: string;
  model: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  created_at: string;
  draft:
    | {
        client_id: string;
        client: { name: string } | Array<{ name: string }> | null;
      }
    | Array<{
        client_id: string;
        client: { name: string } | Array<{ name: string }> | null;
      }>
    | null;
};

function pickOne<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

type Row = {
  clientName: string;
  model: string;
  callCount: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
};

export default async function AdminUsagePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  // Owner-only gate — staff/client roles get a 404, not a nicer error, to
  // mirror the pattern used elsewhere (no enumeration hints).
  if (!(await isOwner())) notFound();

  const t = await getTranslations("adminUsage");

  // Default window: last 30 days. Override via ?days=N.
  const daysParam = Number.parseInt(
    (Array.isArray(sp.days) ? sp.days[0] : sp.days) ?? "",
    10,
  );
  const days = Number.isFinite(daysParam) && daysParam >= 1 && daysParam <= 365
    ? daysParam
    : 30;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const supabase = await createClient();
  // Tenant-scoped through the join. ai_edits has no tenant_id of its own — it
  // hangs off draft_id — so this screen asked for every row RLS would allow,
  // and a founder of two tenants got both workspaces' spend added together in
  // one total.
  const tenantId = await currentTenantId();
  const { data } = await supabase
    .from("ai_edits")
    .select(
      "id, model, tokens_in, tokens_out, created_at, draft:content_drafts!inner(tenant_id, client_id, client:clients(name))",
    )
    .eq("draft.tenant_id", tenantId)
    .gte("created_at", cutoff.toISOString())
    .order("created_at", { ascending: false })
    .limit(OPTION_LIST_CAP);

  const rows = (data ?? []) as unknown as AiEditRow[];

  // Aggregate by (clientName, model)
  const key = (a: string, b: string) => `${a}::${b}`;
  const agg = new Map<string, Row>();
  let totalIn = 0;
  let totalOut = 0;
  let totalCost = 0;

  for (const r of rows) {
    const draft = pickOne(r.draft);
    const clientRow = draft ? pickOne(draft.client) : null;
    const clientName = clientRow?.name ?? "—";
    const model = r.model ?? "unknown";
    const tIn = r.tokens_in ?? 0;
    const tOut = r.tokens_out ?? 0;
    const cost = estimateCostUsd(r.model, tIn, tOut);

    totalIn += tIn;
    totalOut += tOut;
    totalCost += cost;

    const k = key(clientName, model);
    const existing = agg.get(k);
    if (existing) {
      existing.callCount += 1;
      existing.inputTokens += tIn;
      existing.outputTokens += tOut;
      existing.costUsd += cost;
    } else {
      agg.set(k, {
        clientName,
        model,
        callCount: 1,
        inputTokens: tIn,
        outputTokens: tOut,
        costUsd: cost,
      });
    }
  }

  const aggregated = Array.from(agg.values()).sort(
    (a, b) => b.costUsd - a.costUsd,
  );

  const numberFmt = new Intl.NumberFormat(locale);

  return (
    <div className="">
      <div className="mb-8">
        <h1 className="font-display text-4xl text-foreground">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("subtitle", { days })}
        </p>
      </div>

      <div className="mb-6 flex gap-2 text-sm">
        {[7, 30, 90].map((d) => (
          <a
            key={d}
            href={`?days=${d}`}
            className={`inline-flex h-9 items-center rounded-md border border-input px-3 ${
              d === days ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
            }`}
            data-testid="usage-range"
          >
            {t("range", { days: d })}
          </a>
        ))}
      </div>

      <div className="mb-8 grid grid-cols-1 gap-3 md:grid-cols-4">
        <Stat label={t("totals.calls")} value={numberFmt.format(rows.length)} />
        <Stat
          label={t("totals.inputTokens")}
          value={numberFmt.format(totalIn)}
        />
        <Stat
          label={t("totals.outputTokens")}
          value={numberFmt.format(totalOut)}
        />
        <Stat label={t("totals.cost")} value={formatUsd(totalCost)} />
      </div>

      {aggregated.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">{t("table.client")}</th>
                <th className="px-3 py-2 text-left">{t("table.model")}</th>
                <th className="px-3 py-2 text-right">{t("table.calls")}</th>
                <th className="px-3 py-2 text-right">{t("table.inputTokens")}</th>
                <th className="px-3 py-2 text-right">{t("table.outputTokens")}</th>
                <th className="px-3 py-2 text-right">{t("table.cost")}</th>
              </tr>
            </thead>
            <tbody>
              {aggregated.map((row, i) => (
                <tr
                  key={i}
                  className="border-t border-border"
                  data-testid="usage-row"
                >
                  <td className="px-3 py-2">{row.clientName}</td>
                  <td className="px-3 py-2 font-mono text-xs">{row.model}</td>
                  <td className="px-3 py-2 text-right">
                    {numberFmt.format(row.callCount)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {numberFmt.format(row.inputTokens)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {numberFmt.format(row.outputTokens)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatUsd(row.costUsd)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground">{t("note")}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 font-display text-xl">{value}</div>
    </div>
  );
}
