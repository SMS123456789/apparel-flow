import { expect, test } from "@playwright/test";
test("login and real demo panel are visible without overflow", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page).toHaveTitle("ApparelFlow");
  await expect(
    page.getByRole("heading", { name: "Sign in", exact: true }),
  ).toBeVisible();
  for (const name of [
    "Cutting Supervisor",
    "Cutting Verifier",
    "Sewing Supervisor",
  ])
    await expect(page.getByRole("button", { name, exact: true })).toBeEnabled();
  await expect(page.getByLabel("Email (required)")).toBeVisible();
  await expect(page.getByLabel("Password (required)")).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  expect(
    (await page.content()).includes(
      process.env.BOOTSTRAP_ADMIN_PASSWORD ?? "private-admin-not-configured",
    ),
  ).toBe(false);
});
