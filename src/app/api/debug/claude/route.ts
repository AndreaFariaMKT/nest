import { NextResponse, type NextRequest } from "next/server";
import { generate, type ModelKind } from "@/lib/claude";

export const dynamic = "force-dynamic";

/**
 * Dev smoke endpoint — verifies the ANTHROPIC_API_KEY + wrapper are working.
 *
 * Auth: `Authorization: Bearer <CRON_SECRET>` (reuses the cron secret for
 * simplicity; no user-facing flows hit this route in production).
 *
 *   curl -s -X POST http://localhost:3000/api/debug/claude \
 *     -H "Authorization: Bearer $CRON_SECRET" \
 *     -H "Content-Type: application/json" \
 *     -d '{"kind":"extract","prompt":"say ok"}'
 */
export async function POST(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "no CRON_SECRET set" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const kind: ModelKind = (body?.kind ?? "extract") as ModelKind;
  const prompt: string = (body?.prompt ?? "Say 'ok' and nothing else.")
    .toString();

  const result = await generate({
    kind,
    system: "You are a terse test responder. Answer in 5 words or fewer.",
    messages: [{ role: "user", content: prompt }],
    maxTokens: 64,
  });

  return NextResponse.json(result);
}
