import { expect, test } from "@playwright/test";
test("supervisor creates, edits, submits and reloads a frozen batch", async ({
  page,
  context,
}, testInfo) => {
  await page.goto("/login");
  await page
    .getByRole("button", { name: "Cutting Supervisor", exact: true })
    .click();
  await expect(page).toHaveURL(/\/supervisor$/);
  await page.getByRole("link", { name: "Create Order", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Create cutting order" }),
  ).toBeVisible();
  await expect(page.getByLabel("Recipe (required)")).toContainText(
    "Casual Blouse",
  );
  await expect(page.getByLabel("Recipe (required)")).toContainText("Crop Top");
  await page.getByLabel("Target batch quantity (garments, required)").fill("0");
  await expect(
    page.getByText("Enter a positive whole garment quantity.", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Target batch quantity (garments, required)")
    .fill("50");
  await page
    .getByLabel("Fabric roll ID (required)")
    .fill(`E2E-CUTTING-${crypto.randomUUID()}`);
  await page.getByLabel("Actual fabric used (yards, required)").fill("94.5");
  await expect(page.getByText("90 yards", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("row").filter({ hasText: "Sleeve Cuffs" }),
  ).toContainText("100");
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("cutting-preparation.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Create Order", exact: true }).click();
  await expect(page).toHaveURL(/\/supervisor\/[\da-f-]+$/);
  const id = page.url().split("/").at(-1)!;
  await page.reload();
  await expect(
    page.getByLabel("Target batch quantity (garments, required)"),
  ).toHaveValue("50");
  await page.getByLabel("Actual fabric used (yards, required)").fill("95");
  await expect(
    page.getByRole("button", { name: "Submit for verification", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Save preparation", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Submit for verification", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Submit for verification", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm submission", exact: true })
    .click();
  await expect(
    page.getByText("Pending verification", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByLabel("Actual fabric used (yards, required)"),
  ).toHaveValue("95");
  await expect(page.getByLabel("Recipe (required)")).toBeDisabled();
  await expect(
    page.getByLabel("Target batch quantity (garments, required)"),
  ).toHaveAttribute("readonly", "");
  const result = await context.request.get(`/api/orders/${id}`);
  expect(result.status()).toBe(200);
  const body = (await result.json()).data;
  expect(body.status).toBe("PENDING_VERIFICATION");
  expect(body.components).toHaveLength(5);
  expect(
    body.attempts[0].items.every(
      (i: { actualQty: number | null }) => i.actualQty === null,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page
    .getByRole("button", { name: "Cutting Verifier", exact: true })
    .click();
  await expect(page).toHaveURL(/\/verifier$/);
  expect(
    (
      await context.request.post("/api/orders", {
        headers: { Origin: "http://127.0.0.1:3100" },
        data: {},
      })
    ).status(),
  ).toBe(403);
  expect((await context.request.get(`/api/orders/${id}`)).status()).toBe(403);
});
