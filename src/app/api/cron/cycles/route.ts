import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { currentYearMonth, cycleBounds } from "@/lib/cycles";
import { checkRateLimit, ipFromHeaders } from "@/lib/rate-limit";

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
  // Rate limit by IP — cycles runs monthly, so 4/min is enough for the
  // scheduled firing + ad-hoc manual retries during incident response.
  const ip = ipFromHeaders(request.headers);
  const rl = checkRateLimit({
    key: `cron.cycles:${ip}`,
    limit: 4,
    windowMs: 60_000,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited", resetMs: rl.resetMs },
      { status: 429 },
    );
  }

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
    .select("id, client_id");

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  // For each freshly-created cycle, clone matching templates into real tasks.
  // Templates with client_id = null apply to every client.
  const newCycles = (data ?? []) as { id: string; client_id: string }[];
  let clonedTasks = 0;

  if (newCycles.length > 0) {
    const clientIds = Array.from(new Set(newCycles.map((c) => c.client_id)));

    const { data: templatesData } = await supabase
      .from("tasks")
      .select(
        "client_id, title, description, priority, assignee_id, due_at",
      )
      .eq("is_template", true)
      .or(`client_id.is.null,client_id.in.(${clientIds.join(",")})`);

    const templates = templatesData ?? [];

    if (templates.length > 0) {
      const clones: Record<string, unknown>[] = [];
      for (const cycle of newCycles) {
        for (const tpl of templates) {
          if (tpl.client_id !== null && tpl.client_id !== cycle.client_id) {
            continue;
          }
          clones.push({
            client_id: cycle.client_id,
            cycle_id: cycle.id,
            title: tpl.title,
            description: tpl.description,
            status: "todo",
            priority: tpl.priority,
            assignee_id: tpl.assignee_id,
            due_at: tpl.due_at,
            is_template: false,
          });
        }
      }
      if (clones.length > 0) {
        const { error: cloneError } = await supabase
          .from("tasks")
          .insert(clones);
        if (cloneError) {
          return NextResponse.json(
            { error: cloneError.message },
            { status: 500 },
          );
        }
        clonedTasks = clones.length;
      }
    }
  }

  return NextResponse.json({
    createdOrKept: newCycles.length,
    total: rows.length,
    clonedTasks,
    year,
    month,
  });
}

// Vercel Cron issues GET requests; local curl may use POST — accept both.
export { handler as GET, handler as POST };
