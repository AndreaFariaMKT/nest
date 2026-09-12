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

  it("is revoked from public and granted only to the service role", () => {
    // security definer + EXECUTE to PUBLIC would let an anonymous caller
    // inflate the counter for any key — including another client's approval
    // token, which locks them out of approving their own post.
    expect(sql).toMatch(
      /revoke execute on function public\.rate_limit_hit\(text, integer, integer\) from public;/,
    );
    expect(sql).toMatch(
      /grant\s+execute on function public\.rate_limit_hit\(text, integer, integer\) to service_role;/,
    );
  });

  it("keys the window into the primary key, so rolling over cannot race", () => {
    expect(sql).toMatch(/primary key \(bucket, window_start\)/);
  });

  it("leaves the table with RLS on and no permissive policy", () => {
    expect(sql).toMatch(/alter table public\.rate_limits enable row level security/);
    expect(sql).not.toMatch(/create policy[\s\S]*on public\.rate_limits/);
  });
});
