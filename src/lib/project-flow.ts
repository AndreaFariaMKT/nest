import { addBusinessDays } from "@/lib/invoicing";

/**
 * Turning a project type's flow into that project's tasks.
 *
 * The rule that makes this age well: a step names a ROLE and the resolution
 * happens now, against the people actually on this project. A template that
 * stored people would assign work to whoever has since left.
 */

export type FlowStep = {
  id: string;
  title: string;
  description: string | null;
  role: string | null;
  offset_days: number;
  priority: string;
  sort: number;
};

export type ProjectPerson = { user_id: string; role: string | null };

export type PlannedTask = {
  title: string;
  description: string | null;
  priority: string;
  due_on: string;
  assignee_id: string | null;
  /** True when the step named a role nobody on this project holds. */
  unassigned: boolean;
};

/**
 * Who on this project holds a role.
 *
 * Falls back to the tenant's holders of that role when nobody on the project
 * does — a three-person project still needs the accountant step to land
 * somewhere. Returns null rather than picking arbitrarily when there is no
 * holder at all, and the caller surfaces that: a task assigned to nobody is
 * visible, a task assigned to the wrong person is not.
 */
export function resolveOwner(
  role: string | null,
  projectPeople: readonly ProjectPerson[],
  tenantPeople: readonly ProjectPerson[],
): string | null {
  if (!role) return null;
  const onProject = projectPeople.find((p) => p.role === role);
  if (onProject) return onProject.user_id;
  const inTenant = tenantPeople.find((p) => p.role === role);
  return inTenant ? inTenant.user_id : null;
}

/**
 * Plan the tasks a flow produces, without writing anything.
 *
 * Dates are business days from the project's start, so a flow that begins on a
 * Thursday does not put its "two days later" step on the Saturday.
 */
export function planFlow(
  steps: readonly FlowStep[],
  startsOn: string,
  projectPeople: readonly ProjectPerson[],
  tenantPeople: readonly ProjectPerson[],
): PlannedTask[] {
  return [...steps]
    .sort((a, b) => a.sort - b.sort)
    .map((step) => {
      const assignee = resolveOwner(step.role, projectPeople, tenantPeople);
      return {
        title: step.title,
        description: step.description,
        priority: step.priority,
        due_on:
          step.offset_days === 0
            ? startsOn
            : addBusinessDays(startsOn, step.offset_days),
        assignee_id: assignee,
        unassigned: step.role !== null && assignee === null,
      };
    });
}
