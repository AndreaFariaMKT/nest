/**
 * Resolving which account a piece publishes to.
 *
 * The publish path used to read one set of credentials from the environment
 * and use it for every client in the deployment — so a second client's post
 * would have gone live on the first client's feed. Credentials now belong to a
 * client (migration 032), and this is the only place that turns a stored row
 * into something the platform wrappers accept.
 *
 * Deliberately server-only: it decrypts. `secretsAvailable()` gates that, so a
 * deployment without SOCIAL_SECRET_KEY reports "not usable" rather than
 * throwing halfway through a publish run.
 */

import { decryptSecret, secretsAvailable } from "@/lib/secrets";
import type { IgCredentials } from "@/lib/instagram";
import type { LinkedInCredentials } from "@/lib/linkedin";
import type { TikTokCredentials } from "@/lib/tiktok";
import type { Database } from "@/types/database.gen";

export type Platform = Database["public"]["Enums"]["platform"];

/** The stored row, as the cron reads it. */
export interface SocialAccountRow {
  client_id: string;
  platform: Platform;
  account_ref: string | null;
  secret_enc: string | null;
  api_version: string | null;
  publish_mode: string;
  enabled: boolean;
}

/** Why an account cannot publish. Stable keys — they reach the cron summary. */
export type AccountProblem =
  | "no_account"
  | "not_enabled"
  | "no_secret"
  | "secret_unreadable"
  | "no_account_ref"
  | "no_secret_key";

export type ResolvedAccount =
  | { ok: true; platform: "instagram"; creds: IgCredentials }
  | { ok: true; platform: "linkedin"; creds: LinkedInCredentials }
  | { ok: true; platform: "tiktok"; creds: TikTokCredentials }
  | { ok: false; problem: AccountProblem };

const DEFAULT_IG_API = "v21.0";
const DEFAULT_LI_API = "202410";

/**
 * Turn a stored row into platform credentials, or say why not.
 *
 * Every refusal is a distinct key rather than a bare null, because these are
 * the states an operator has to tell apart during onboarding: an account that
 * was never registered, one registered but not switched on, one switched on
 * with no token yet, and one whose token no longer decrypts because the key
 * was rotated. Collapsing them turns a five-minute fix into a hunt.
 */
export function resolveAccount(
  row: SocialAccountRow | null | undefined,
): ResolvedAccount {
  if (!row) return { ok: false, problem: "no_account" };
  // Checked before the secret so a half-finished onboarding reads as
  // "not enabled" rather than "no token" — the former is the real state.
  if (!row.enabled) return { ok: false, problem: "not_enabled" };
  if (!row.secret_enc) return { ok: false, problem: "no_secret" };
  if (!secretsAvailable()) return { ok: false, problem: "no_secret_key" };

  const token = decryptSecret(row.secret_enc);
  // decryptSecret fails closed to null on a tampered value or one written
  // under a rotated key — the two are indistinguishable by design.
  if (!token) return { ok: false, problem: "secret_unreadable" };

  switch (row.platform) {
    case "instagram":
      if (!row.account_ref) return { ok: false, problem: "no_account_ref" };
      return {
        ok: true,
        platform: "instagram",
        creds: {
          token,
          igBusinessAccountId: row.account_ref,
          apiVersion: row.api_version?.trim() || DEFAULT_IG_API,
        },
      };
    case "linkedin":
      if (!row.account_ref) return { ok: false, problem: "no_account_ref" };
      return {
        ok: true,
        platform: "linkedin",
        creds: {
          accessToken: token,
          organizationUrn: row.account_ref,
          apiVersion: row.api_version?.trim() || DEFAULT_LI_API,
        },
      };
    case "tiktok":
      // No account_ref: the TikTok token identifies the account by itself, so
      // requiring one would be inventing a field for symmetry's sake.
      return {
        ok: true,
        platform: "tiktok",
        creds: {
          accessToken: token,
          publishMode: row.publish_mode === "direct" ? "direct" : "inbox",
        },
      };
  }
}

/** Index rows by client and platform for a run that publishes many pieces. */
export function accountIndex(
  rows: SocialAccountRow[],
): Map<string, SocialAccountRow> {
  const m = new Map<string, SocialAccountRow>();
  for (const r of rows) m.set(accountKey(r.client_id, r.platform), r);
  return m;
}

export function accountKey(clientId: string, platform: Platform): string {
  return `${clientId}:${platform}`;
}
