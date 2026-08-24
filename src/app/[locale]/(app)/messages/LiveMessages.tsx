"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

/**
 * Makes a chat screen behave like one.
 *
 * There was no liveness anywhere in the app — no subscription, no polling,
 * only a refresh after your own send. The room pills promise a channel
 * ("internal only", "the client reads this"), and a reply then sat unseen
 * until somebody happened to reload.
 *
 * Two mechanisms, because they fail in different directions:
 *
 * - A Postgres subscription on inserts to this room. Realtime applies the
 *   table's RLS per subscriber, so the module's split holds: a client is not
 *   told about a team room, because the policy that hides those rows also
 *   hides the events. If the publication migration has not run, or realtime is
 *   off for the project, this silently does nothing — which is exactly today's
 *   behaviour, so it cannot regress anything.
 *
 * - A refresh when the tab becomes visible again. Free, needs no server
 *   feature at all, and covers the common case of coming back to a tab left
 *   open for an hour.
 *
 * It refreshes the route rather than appending a row: the message list is
 * server-rendered with sender names resolved there, and inventing a bubble on
 * the client would mean a second, divergent renderer for the same data.
 */
export function LiveMessages({
  clientId,
  room,
  selfId,
}: {
  /** Null for the studio-wide channel. */
  clientId: string | null;
  room: string;
  /**
   * The viewer. Their own message already arrives with the send action's
   * response — sendMessageAction revalidates both message routes, so the
   * action's own payload carries the re-rendered list. Refreshing again on the
   * echo would render the route a second time for every message you send.
   */
  selfId?: string | null;
}) {
  const router = useRouter();
  // The refresh callback is stable across renders, so the effect below can
  // depend only on what actually identifies the room.
  const refresh = useRef(() => router.refresh());
  refresh.current = () => router.refresh();

  useEffect(() => {
    const supabase = createClient();
    const filter = clientId
      ? `client_id=eq.${clientId}`
      : "client_id=is.null";

    const channel = supabase
      .channel(`messages:${clientId ?? "studio"}:${room}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter },
        (payload) => {
          // The filter takes one condition, so the room is checked here.
          const next = payload.new as
            | { room?: string; sender_id?: string }
            | null;
          if (next?.room && next.room !== room) return;
          if (selfId && next?.sender_id === selfId) return;
          refresh.current();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [clientId, room, selfId]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh.current();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  return null;
}
