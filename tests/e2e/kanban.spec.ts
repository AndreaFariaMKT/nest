import { expect, test } from "@playwright/test";

/**
 * Smoke: /projects renders a Kanban board with 5 columns and a new
 * task lands in the "To do" column. HTML5 drag-and-drop is hard to
 * simulate in Playwright reliably — we cover that path via the CRUD
 * smoke (which flips status through the edit form).
 */
test("kanban board renders columns and a new task in To do", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel(/e-?mail/i).fill("dev@nest.local");
  await page.getByLabel(/senha|password/i).fill("devpassword");
  await page
    .getByRole("button", { name: /continuar com e-mail|continue with email/i })
    .click();
  await expect(page).toHaveURL(/\/today$/);

  const stamp = Date.now();
  const title = `Kanban smoke ${stamp}`;

  await page.goto("/en/projects/new");
  await page.locator("#title").fill(title);
  await page.getByRole("button", { name: /create task|criar tarefa/i }).click();
  await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+\/edit$/);

  await page.goto("/en/projects");
  // All 5 columns must be present
  for (const status of ["todo", "in_progress", "blocked", "review", "done"]) {
    await expect(page.getByTestId(`kanban-column-${status}`)).toBeVisible();
  }

  // The new task renders inside the To-do column
  const todoColumn = page.getByTestId("kanban-column-todo");
  await expect(
    todoColumn.getByTestId("kanban-task").filter({ hasText: title }),
  ).toBeVisible();
});
