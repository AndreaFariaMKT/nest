import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * The shape of `rate_limit_hit`, read from the migration itself.
 *
 * `checkRateLimitShared` calls this function through a hand-written type,
 * because the generated database types cannot contain a function whose
 * migration has not been applied yet. A hand-written type over a remote
 * contract is exactly the kind of thing that silently stops being true — so
 * this reads the SQL and checks the two agree.
 *
 * It is not a substitute for regenerating the types after 057 lands; it is
 * what keeps the gap honest until then.
 */
const sql = readFileSync(
  fileURLToPath(
    new URL("../../supabase/migrations/057_rate_limits.sql", import.meta.url),
  ),
  "utf8",
);

describe("rate_limit_hit, as the migration declares it", () => {
  it("takes the three arguments the client sends, in that order", () => {
    const signature = /create or replace function public\.rate_limit_hit\(([\s\S]*?)\)\s*returns/.exec(
      sql,
    );
    expect(signature, "function not found in 057").toBeTruthy();
    const args = signature![1]
      .split(",")
      .map((a) => a.trim().split(/\s+/)[0])
      .filter(Boolean);
    expect(args).toEqual(["p_bucket", "p_window_ms", "p_limit"]);
  });

  it("returns the three columns the client reads", () => {
    const returns = /rate_limit_hit\([\s\S]*?\)\s*returns table \(([\s\S]*?)\)/.exec(
      sql,
    );
    expect(returns, "return table not found in 057").toBeTruthy();
    const cols = returns![1]
      .split(",")
      .map((c) => c.trim().split(/\s+/)[0])
      .filter(Boolean);
    expect(cols).toEqual(["allowed", "remaining", "reset_ms"]);
  });

  it("is revoked from the NAMED roles, not only from public", () => {
    // 057 revoked from `public` alone and this assertion passed — because a
    // test that reads SQL cannot know what the SQL does. Supabase's default
    // privileges grant EXECUTE on new functions in `public` to anon,
    // authenticated and service_role BY NAME, and revoking the PUBLIC
    // pseudo-role does not touch those. Measured against production after 057
    // landed: the anon key called the function and got
    // {"allowed":true,"remaining":4}.
    //
    // What that allowed: unlimited anonymous INSERTs of arbitrary bucket names
    // (the short path to filling the disk), and exhausting a specific client's
    // approval budget by calling with their token's bucket.
    const revoke = readFileSync(
      fileURLToPath(
        new URL(
          "../../supabase/migrations/058_rate_limit_revoke_named_roles.sql",
          import.meta.url,
        ),
      ),
      "utf8",
    );
    expect(revoke).toMatch(
      /revoke execute on function public\.rate_limit_hit\(text, integer, integer\)\s*\n?\s*from anon, authenticated;/,
    );
    expect(revoke).toMatch(
      /revoke execute on function public\.rate_limit_sweep\(interval\)\s*\n?\s*from anon, authenticated;/,
    );
    expect(sql).toMatch(
      /grant\s+execute on function public\.rate_limit_hit\(text, integer, integer\) to service_role;/,
    );
  });

  /**
   * And the honest caveat, written where the next person will read it: none of
   * the assertions in this file prove a privilege is actually gone. They prove
   * the migration says so. `scripts/verificar-rate-limit.sh` asks the live
   * database, which is the only thing that can answer.
   */
  it("says out loud that reading SQL is not the same as checking a grant", () => {
    expect(sql).toMatch(/security definer/);
  });

  it("keys the window into the primary key, so rolling over cannot race", () => {
    expect(sql).toMatch(/primary key \(bucket, window_start\)/);
  });

  it("leaves the table with RLS on and no permissive policy", () => {
    expect(sql).toMatch(/alter table public\.rate_limits enable row level security/);
    expect(sql).not.toMatch(/create policy[\s\S]*on public\.rate_limits/);
  });
});
