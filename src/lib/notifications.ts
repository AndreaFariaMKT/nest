import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Insert a notification for a different user (bypasses the "own only"
 * RLS policy via the service-role key). Safe because this only runs
 * server-side.
 */
export async function notifyUser({
  userId,
  type,
  title,
  body,
  link,
}: {
  userId: string;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
}): Promise<void> {
  if (!userId) return;

  const admin = createAdminClient();

  await admin.from("notifications").insert({
    user_id: userId,
    type,
    title,
    body: body ?? null,
    link: link ?? null,
  });
}
