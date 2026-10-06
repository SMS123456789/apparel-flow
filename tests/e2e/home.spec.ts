import { expect, test } from "@playwright/test";

test("the scaffold home page loads", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  const response = await page.goto("/");

  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle("ApparelFlow");
  await expect(
    page.getByRole("heading", { name: "ApparelFlow", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByText("Cutting Operations & Gatekeeper Verification Terminal"),
  ).toBeVisible();
  await expect(
    page.getByText("Application scaffold initialized."),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
