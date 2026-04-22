import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { currentYearMonth, cycleBounds } from "@/lib/cycles";

export const dynamic = "force-dynamic";

/**
 * Cron endpoint — creates a `cycles` row for every active client for the
 * current calendar month (idempotent via the `(client_id, year, month)`
 * unique index).
 *
 * Auth: `Authorization: Bearer <CRON_SECRET>` required.
 * Uses the service-role key (safe: we're on the server, not the browser).
 */
async function handler(request: NextRequest) {
  const authHeader = request.headers.get("authorization") ?? "";
  const expected = process.env.CRON_SECRET;

  if (!expected || authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { year, month } = currentYearMonth();
  const bounds = cycleBounds(year, month);

  const { data: clients, error: clientsError } = await supabase
    .from("clients")
    .select("id")
    .eq("status", "active");

  if (clientsError) {
    return NextResponse.json({ error: clientsError.message }, { status: 500 });
  }

  if (!clients || clients.length === 0) {
    return NextResponse.json({ createdOrKept: 0, year, month });
  }

  const rows = clients.map((c) => ({
    client_id: c.id,
    year,
    month,
    starts_on: bounds.startsOn,
    ends_on: bounds.endsOn,
  }));

  const { error: upsertError, data } = await supabase
    .from("cycles")
    .upsert(rows, {
      onConflict: "client_id,year,month",
      ignoreDuplicates: true,
    })
    .select("id");

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({
    createdOrKept: data?.length ?? 0,
    total: rows.length,
    year,
    month,
  });
}

// Vercel Cron issues GET requests; local curl may use POST — accept both.
export { handler as GET, handler as POST };
