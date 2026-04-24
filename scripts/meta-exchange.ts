#!/usr/bin/env tsx
/**
 * Exchange a short-lived Meta User Access Token for a long-lived one.
 *
 * Usage:
 *   ./scripts/meta-exchange.ts <short-lived-token>
 *   # or:
 *   npx tsx scripts/meta-exchange.ts <short-lived-token>
 *
 * Reads META_APP_ID + META_APP_SECRET from the shell or from `.env.local`
 * (sourced by the caller). Prints the new long-lived token + expiry to
 * stdout. Does NOT write to `.env.local` — copy-paste the value yourself
 * so you stay in control of secrets on disk.
 */

import { buildRefreshUrl } from "../src/lib/instagram";

async function main() {
  const token = process.argv[2];
  if (!token) {
    console.error(
      "usage: ./scripts/meta-exchange.ts <short-lived-token>",
    );
    process.exit(1);
  }

  const appId = (process.env.META_APP_ID ?? "").trim();
  const appSecret = (process.env.META_APP_SECRET ?? "").trim();
  const apiVersion = (process.env.META_GRAPH_API_VERSION ?? "v21.0").trim();

  if (!appId || !appSecret) {
    console.error(
      "Missing META_APP_ID or META_APP_SECRET — source .env.local first:",
    );
    console.error("  set -a && . .env.local && set +a");
    process.exit(1);
  }

  const url = buildRefreshUrl({ apiVersion, appId, appSecret, token });
  const res = await fetch(url);
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok || body.error) {
    console.error(`✗ Exchange failed (HTTP ${res.status}):`);
    console.error(JSON.stringify(body, null, 2));
    process.exit(1);
  }

  const { access_token, token_type, expires_in } = body as {
    access_token: string;
    token_type: string;
    expires_in?: number;
  };

  const expiresAt = expires_in
    ? new Date(Date.now() + expires_in * 1000).toISOString()
    : "unknown";

  console.log("✓ Exchange successful\n");
  console.log(`token_type:   ${token_type}`);
  console.log(`expires_in:   ${expires_in ?? "(omitted)"} seconds`);
  console.log(`expires_at:   ${expiresAt}`);
  console.log();
  console.log("Paste this into .env.local as META_LONG_LIVED_TOKEN:");
  console.log();
  console.log(access_token);
}

main().catch((err) => {
  console.error("unexpected error:", err);
  process.exit(1);
});
