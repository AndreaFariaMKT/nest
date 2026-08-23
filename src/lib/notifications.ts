import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Insert a notification for a different user (bypasses the "own only"
 * RLS policy via the service-role key). Safe because this only runs
 * server-side.
 *
 * `tenantId` is required, not optional. `notifications.tenant_id` is NOT NULL
 * with a DEFAULT of the AFM tenant (migration 013), and the table carries the
 * restrictive `tenant_isolation` floor (014) — so an insert that omitted it
 * filed a Nest-tenant user's notification under AFM, where that floor then
 * hid it from them permanently. Not a leak: a silent loss, and one that reads
 * like a broken cron when someone eventually goes looking.
 */
export async function notifyUser({
  userId,
  tenantId,
  type,
  title,
  body,
  link,
}: {
  userId: string;
  tenantId: string;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
}): Promise<void> {
  if (!userId || !tenantId) return;

  const admin = createAdminClient();

  await admin.from("notifications").insert({
    user_id: userId,
    tenant_id: tenantId,
    type,
    title,
    body: body ?? null,
    link: link ?? null,
  });
}
