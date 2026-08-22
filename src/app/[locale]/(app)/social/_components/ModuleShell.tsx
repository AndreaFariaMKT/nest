import {
  backlogStock,
  IN_FLIGHT_STAGES,
  socialScreensFor,
  waitingFor,
  type SocialPiece,
} from "@/lib/social";
import type { SocialScope } from "../_data";
import { ModuleNav, type ScreenLink } from "./ModuleNav";

/**
 * The bar every module screen sits under. The counts are the point: a tab that
 * says "3" is the difference between remembering to look and finding out on
 * Friday.
 */
export function ModuleShell({ scope }: { scope: SocialScope }) {
  const { pieces, caps, role, clients, client } = scope;

  const waiting = waitingFor(caps, {
    pieces: pieces as SocialPiece[],
    clients: scope.clientIndex,
    today: scope.today,
  }).length;

  // The badge must count exactly what the board behind it renders.
  const inFortnight = pieces.filter((p) =>
    IN_FLIGHT_STAGES.includes(p.status),
  ).length;

  const inDesign = pieces.filter(
    (p) => p.status === "creative_review" && p.design_state !== "signed_off",
  ).length;

  const toPublish = pieces.filter((p) => p.status === "scheduled").length;

  const backlog = pieces.filter((p) => p.status === "backlog").length;
  const perCycle = client
    ? client.posts_per_cycle
    : clients.reduce((sum, c) => sum + c.posts_per_cycle, 0);
  const stock = backlogStock(backlog, perCycle || 1);

  const badges: Record<string, number> = {
    waiting,
    fortnight: inFortnight,
    production: inDesign,
    publishing: toPublish,
    // The shelf badges only when it is thin — a healthy backlog is not news.
    backlog: stock.low ? backlog : 0,
  };

  const screens: ScreenLink[] = socialScreensFor(role).map((s) => ({
    ...s,
    badge: badges[s.key] ?? 0,
  }));

  return (
    <ModuleNav
      screens={screens}
      clients={clients.map((c) => ({ slug: c.slug, name: c.name }))}
      currentClient={client?.slug ?? ""}
    />
  );
}
