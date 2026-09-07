import { describe, expect, it } from "vitest";

import { planFlow, resolveOwner, type FlowStep } from "@/lib/project-flow";

const steps: FlowStep[] = [
  { id: "3", title: "Revisão", description: null, role: "manager", offset_days: 4, priority: "medium", sort: 30 },
  { id: "1", title: "Pautas", description: null, role: "social", offset_days: 0, priority: "high", sort: 10 },
  { id: "2", title: "Roteiros", description: null, role: "social", offset_days: 2, priority: "high", sort: 20 },
];

const onProject = [
  { user_id: "ana", role: "social" },
  { user_id: "bia", role: "designer_social" },
];
const inTenant = [
  { user_id: "ana", role: "social" },
  { user_id: "carla", role: "manager" },
  { user_id: "dora", role: "developer" },
];

describe("resolveOwner", () => {
  it("prefers someone actually on the project", () => {
    expect(resolveOwner("social", onProject, inTenant)).toBe("ana");
  });

  /**
   * A three-person project still needs the accountant step to land somewhere,
   * so a role nobody on the project holds falls back to the tenant.
   */
  it("falls back to the tenant when nobody on the project holds the role", () => {
    expect(resolveOwner("manager", onProject, inTenant)).toBe("carla");
  });

  /**
   * A task assigned to nobody is visible; a task assigned to the wrong person
   * is not. So when there is no holder at all, this refuses to pick.
   */
  it("returns null rather than picking arbitrarily", () => {
    expect(resolveOwner("accountant", onProject, inTenant)).toBeNull();
  });

  it("leaves a step with no role unassigned", () => {
    expect(resolveOwner(null, onProject, inTenant)).toBeNull();
  });
});

describe("planFlow", () => {
  it("runs the steps in their sort order, not the order they arrived", () => {
    const plan = planFlow(steps, "2026-09-07", onProject, inTenant);
    expect(plan.map((p) => p.title)).toEqual(["Pautas", "Roteiros", "Revisão"]);
  });

  /**
   * Business days, so a flow starting on a Thursday does not put its "two days
   * later" step on the Saturday.
   */
  it("spaces the steps in business days from the start", () => {
    // 2026-09-07 is a Monday.
    const plan = planFlow(steps, "2026-09-07", onProject, inTenant);
    expect(plan[0].due_on).toBe("2026-09-07");
    expect(plan[1].due_on).toBe("2026-09-09");
    expect(plan[2].due_on).toBe("2026-09-11");
  });

  it("does not put a step on a weekend when the project starts on a Thursday", () => {
    // 2026-09-10 is a Thursday; two business days is the following Monday.
    const plan = planFlow(steps, "2026-09-10", onProject, inTenant);
    expect(plan[1].due_on).toBe("2026-09-14");
  });

  it("assigns each step to the holder of its role", () => {
    const plan = planFlow(steps, "2026-09-07", onProject, inTenant);
    expect(plan[0].assignee_id).toBe("ana");
    expect(plan[2].assignee_id).toBe("carla");
  });

  it("flags a step whose role nobody holds, rather than dropping it", () => {
    const orphan: FlowStep[] = [
      { id: "x", title: "Fechamento fiscal", description: null, role: "accountant", offset_days: 1, priority: "high", sort: 10 },
    ];
    const [task] = planFlow(orphan, "2026-09-07", onProject, inTenant);
    expect(task.assignee_id).toBeNull();
    expect(task.unassigned).toBe(true);
  });

  it("does not flag a step that was never meant to have an owner", () => {
    const noRole: FlowStep[] = [
      { id: "y", title: "Kickoff", description: null, role: null, offset_days: 0, priority: "medium", sort: 10 },
    ];
    expect(planFlow(noRole, "2026-09-07", onProject, inTenant)[0].unassigned).toBe(false);
  });

  it("plans nothing from an empty flow", () => {
    expect(planFlow([], "2026-09-07", onProject, inTenant)).toEqual([]);
  });
});
