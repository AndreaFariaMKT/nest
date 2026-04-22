import { expect, test } from "@playwright/test";

test("owner creates a task and it shows up in the list", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel(/e-?mail/i).fill("dev@nest.local");
  await page.getByLabel(/senha|password/i).fill("devpassword");
  await page
    .getByRole("button", { name: /continuar com e-mail|continue with email/i })
    .click();
  await expect(page).toHaveURL(/\/today$/);

  const stamp = Date.now();
  const taskTitle = `Smoke task ${stamp}`;

  await page.goto("/en/projects/new");
  await page.locator("#title").fill(taskTitle);
  await page.locator("#priority").selectOption("high");
  await page.getByRole("button", { name: /create task|criar tarefa/i }).click();

  // Lands on the edit page for the just-created task
  await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+\/edit$/);
  await expect(page.locator("#title")).toHaveValue(taskTitle);

  // Back on the kanban, the new task appears in the To-do column
  await page.goto("/en/projects");
  await expect(
    page
      .getByTestId("kanban-column-todo")
      .getByTestId("kanban-task")
      .filter({ hasText: taskTitle }),
  ).toBeVisible();
});
