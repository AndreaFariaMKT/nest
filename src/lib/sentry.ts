// Minimal Sentry client — no @sentry/nextjs dep, just a fetch to the public
// envelope endpoint. Activates when SENTRY_DSN is set; otherwise every call
// is a no-op.
//
// Trade-offs vs. the official SDK:
//   + No 500 KB bundle bloat, no postinstall noise, no webpack plugin.
//   + Works on both Node and Edge runtimes (just fetch).
//   - No breadcrumbs, no performance tracing, no source-map upload, no
//     browser client. For Nest's current scale this is fine — we mostly
//     want "server action threw" + "cron run failed" captured.
//
// If someone wants the full Sentry kit later, swap `captureException` +
// `captureMessage` to route through @sentry/nextjs's Sentry.captureException.

type Level = "fatal" | "error" | "warning" | "info" | "debug";

type DsnParts = {
  protocol: string;
  publicKey: string;
  host: string;
  projectId: string;
};

function parseDsn(raw: string | undefined): DsnParts | null {
  if (!raw) return null;
  // Format: https://<publicKey>@<host>/<projectId>
  const match = /^(https?):\/\/([^@]+)@([^/]+)\/(\d+)$/.exec(raw.trim());
  if (!match) return null;
  return {
    protocol: match[1],
    publicKey: match[2],
    host: match[3],
    projectId: match[4],
  };
}

function envelopeUrl(parts: DsnParts): string {
  return `${parts.protocol}://${parts.host}/api/${parts.projectId}/envelope/`;
}

function authHeader(parts: DsnParts): string {
  return (
    `Sentry sentry_version=7, sentry_key=${parts.publicKey},` +
    ` sentry_client=nest/1.0`
  );
}

function makeEventId(): string {
  // 32 lowercase hex chars — Sentry's required format for event_id.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function buildEnvelope(params: {
  parts: DsnParts;
  eventId: string;
  event: Record<string, unknown>;
}): string {
  const header = JSON.stringify({
    event_id: params.eventId,
    sent_at: new Date().toISOString(),
    dsn: `${params.parts.protocol}://${params.parts.publicKey}@${params.parts.host}/${params.parts.projectId}`,
  });
  const itemHeader = JSON.stringify({ type: "event" });
  const payload = JSON.stringify(params.event);
  return `${header}\n${itemHeader}\n${payload}\n`;
}

async function send(event: Record<string, unknown>): Promise<string | null> {
  const parts = parseDsn(process.env.SENTRY_DSN);
  if (!parts) return null; // opt-in; silently no-op when DSN is absent

  const eventId = makeEventId();
  const fullEvent = {
    event_id: eventId,
    timestamp: Date.now() / 1000,
    platform: "node",
    environment: process.env.NODE_ENV ?? "development",
    release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7),
    server_name: process.env.VERCEL_URL ?? "local",
    ...event,
  };

  try {
    await fetch(envelopeUrl(parts), {
      method: "POST",
      headers: {
        "content-type": "application/x-sentry-envelope",
        "x-sentry-auth": authHeader(parts),
      },
      body: buildEnvelope({ parts, eventId, event: fullEvent }),
      // Fire and (mostly) forget — don't block the handler on Sentry I/O.
      // 3s is generous; if Sentry's unreachable we'd rather drop the event
      // than 500 the user.
      signal: AbortSignal.timeout(3000),
    });
    return eventId;
  } catch {
    return null;
  }
}

export type CaptureOptions = {
  level?: Level;
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  fingerprint?: string[];
};

export async function captureException(
  err: unknown,
  opts: CaptureOptions = {},
): Promise<string | null> {
  const error =
    err instanceof Error ? err : new Error(typeof err === "string" ? err : String(err));

  return send({
    level: opts.level ?? "error",
    tags: opts.tags,
    extra: opts.extra,
    fingerprint: opts.fingerprint,
    exception: {
      values: [
        {
          type: error.name,
          value: error.message,
          stacktrace: error.stack
            ? parseStack(error.stack)
            : undefined,
        },
      ],
    },
  });
}

export async function captureMessage(
  message: string,
  opts: CaptureOptions = {},
): Promise<string | null> {
  return send({
    message: { formatted: message },
    level: opts.level ?? "info",
    tags: opts.tags,
    extra: opts.extra,
    fingerprint: opts.fingerprint,
  });
}

export function isSentryConfigured(): boolean {
  return parseDsn(process.env.SENTRY_DSN) !== null;
}

// Very naive stack parser — good enough for Node v8 / v14+ style traces.
type SentryFrame = {
  function?: string;
  filename: string;
  lineno: number;
  colno: number;
};

function parseStack(stack: string): { frames: SentryFrame[] } {
  const lines = stack.split("\n").slice(1); // drop the "Error: msg" first line
  const frames: SentryFrame[] = [];
  for (const line of lines) {
    const withFn =
      /^\s+at\s+([^\s]+)\s+\(([^:]+):(\d+):(\d+)\)$/.exec(line);
    if (withFn) {
      frames.push({
        function: withFn[1],
        filename: withFn[2],
        lineno: Number(withFn[3]),
        colno: Number(withFn[4]),
      });
      continue;
    }
    const noFn = /^\s+at\s+([^:]+):(\d+):(\d+)$/.exec(line);
    if (noFn) {
      frames.push({
        filename: noFn[1],
        lineno: Number(noFn[2]),
        colno: Number(noFn[3]),
      });
    }
  }
  frames.reverse(); // Sentry expects oldest-first
  return { frames };
}
