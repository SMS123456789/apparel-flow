import { expect, test, type Page, type BrowserContext } from "@playwright/test";
import type { OrderDetail } from "@/modules/orders/types";
import { controlContrast, noPageOverflow } from "./production-review";
const origin = "http://127.0.0.1:3100";
async function persona(
  page: Page,
  context: BrowserContext,
  name: string,
  path: string,
) {
  expect(
    (
      await context.request.post("/api/auth/demo", {
        headers: { Origin: origin },
        data: { persona: name },
      })
    ).status(),
  ).toBe(200);
  await page.goto(path);
}
test("three-persona happy path, VERIFIED-only handoff, assembly start and production UI review", async ({
  page,
  context,
}, testInfo) => {
  test.setTimeout(120000);
  await persona(page, context, "cutting-supervisor", "/supervisor/new");
  await page
    .getByLabel("Recipe (required)")
    .selectOption("10000000-0000-4000-8000-000000000002");
  await page
    .getByLabel("Target batch quantity (garments, required)")
    .fill("30");
  await page
    .getByLabel("Fabric roll ID (required)")
    .fill(`E2E-HAPPY-${crypto.randomUUID()}`);
  await page.getByLabel("Actual fabric used (yards, required)").fill("34.65");
  await expect(page.getByText("33 yards", { exact: true })).toBeVisible();
  for (const field of [
    page.getByLabel("Recipe (required)"),
    page.getByLabel("Target batch quantity (garments, required)"),
    page.getByLabel("Fabric roll ID (required)"),
    page.getByLabel("Actual fabric used (yards, required)"),
  ])
    await controlContrast(field);
  if (testInfo.project.name === "chromium")
    for (const width of [1280, 768, 375, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await noPageOverflow(page);
      await expect(
        page.getByRole("button", { name: "Create Order", exact: true }),
      ).toBeVisible();
    }
  await page.getByRole("button", { name: "Create Order", exact: true }).click();
  await expect(page).toHaveURL(/\/supervisor\/[\da-f-]+$/);
  const id = page.url().split("/").at(-1)!;
  let order: OrderDetail = (
    await (await context.request.get(`/api/orders/${id}`)).json()
  ).data;
  for (const endpoint of ["/api/sewing/queue", `/api/sewing/${id}`])
    expect((await context.request.get(endpoint)).status()).toBe(403);
  expect(
    (
      await context.request.post(`/api/verification/${id}/approve`, {
        headers: { Origin: origin },
        data: {},
      })
    ).status(),
  ).toBe(403);
  await page
    .getByRole("button", { name: "Submit for verification", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm submission", exact: true })
    .click();
  await expect(
    page.getByText("Pending verification", { exact: true }),
  ).toBeVisible();
  await persona(page, context, "sewing-supervisor", "/sewing");
  expect((await context.request.get(`/api/sewing/${id}`)).status()).toBe(404);
  const hidden = await context.request.get(
    `/api/sewing/queue?search=${order.orderNo}`,
  );
  expect(hidden.status()).toBe(200);
  expect((await hidden.json()).data.items).toEqual([]);
  for (const value of [
    "CUTTING_IN_PROGRESS",
    "PENDING_VERIFICATION",
    "REJECTED",
    "VERIFIED",
  ])
    expect(
      (await context.request.get(`/api/sewing/queue?status=${value}`)).status(),
    ).toBe(422);
  for (const endpoint of [
    "/api/orders",
    "/api/recipes",
    "/api/verification/queue",
    "/api/admin/users",
  ])
    expect((await context.request.get(endpoint)).status()).toBe(403);
  await persona(page, context, "cutting-verifier", `/verifier/${id}`);
  await expect(
    page.getByRole("heading", { name: order.orderNo }),
  ).toBeVisible();
  const first = page.getByLabel(`${order.components[0]!.name} actual pieces`, {
      exact: true,
    }),
    approve = page.getByRole("button", { name: "Approve", exact: true });
  await controlContrast(first);
  await controlContrast(approve);
  await first.fill("-1");
  await expect(first).toHaveAttribute("aria-invalid", "true");
  await controlContrast(first);
  await first.fill("0.5");
  await expect(approve).toBeDisabled();
  await first.fill("");
  for (const c of order.components)
    await page
      .getByLabel(`${c.name} actual pieces`, { exact: true })
      .fill(String(c.expectedQty));
  await first.focus();
  await first.press("Enter");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(approve).toBeDisabled();
  if (testInfo.project.name === "chromium")
    for (const width of [1280, 768, 375, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await noPageOverflow(page);
      const measured = await controlContrast(first);
      expect(measured.font).toBeGreaterThanOrEqual(16);
      expect(measured.height).toBeGreaterThanOrEqual(width <= 480 ? 44 : 40);
      await first.focus();
      expect((await controlContrast(first)).outline).toBe("2px");
      if (width === 1280 || width === 375)
        await page.screenshot({
          path: testInfo.outputPath(`verification-${width}.png`),
          fullPage: true,
        });
    }
  if (testInfo.project.name === "chromium") {
    await page.setViewportSize({ width: 1280, height: 900 });
    // Simulate text-only 200% enlargement, including explicit pixel-size controls.
    await page.evaluate(() => {
      const elements = Array.from(
        document.querySelectorAll<HTMLElement>(
          "h1,h2,p,span,label,input,select,textarea,button,a,th,td,summary",
        ),
      );
      const sizes = elements.map((e) => getComputedStyle(e).fontSize);
      elements.forEach((e, i) => {
        e.dataset.reviewFont = e.style.fontSize;
        e.style.fontSize = `${Number.parseFloat(sizes[i]!) * 2}px`;
      });
    });
    await noPageOverflow(page);
    await expect(
      page.getByRole("button", { name: "Save Counts", exact: true }),
    ).toBeVisible();
    await first.focus();
    await page.evaluate(() =>
      document
        .querySelectorAll<HTMLElement>("[data-review-font]")
        .forEach((e) => {
          e.style.fontSize = e.dataset.reviewFont ?? "";
          delete e.dataset.reviewFont;
        }),
    );
  }
  await page.getByRole("button", { name: "Save Counts", exact: true }).click();
  await expect(approve).toBeEnabled();
  // A saved value remains intact after a competing save. Recovery keeps local entries.
  order = (await (await context.request.get(`/api/verification/${id}`)).json())
    .data;
  expect(
    (
      await context.request.patch(`/api/verification/${id}/counts`, {
        headers: { Origin: origin },
        data: {
          attemptId: order.currentAttemptId,
          expectedRevision: order.revision,
          items: [
            {
              componentId: order.components[0]!.componentId,
              actualQty: order.components[0]!.expectedQty + 1,
            },
          ],
        },
      })
    ).status(),
  ).toBe(200);
  await approve.click();
  await page
    .getByRole("button", { name: "Confirm approval", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toBeFocused();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page
    .getByRole("button", { name: "Reload saved evidence", exact: true })
    .click();
  await expect(first).toHaveValue(String(order.components[0]!.expectedQty));
  await expect(approve).toBeDisabled();
  await page.getByRole("button", { name: "Save Counts", exact: true }).click();
  await expect(approve).toBeEnabled();
  await approve.click();
  await expect(page.getByRole("dialog")).toHaveAccessibleName("Approve batch");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  expect(
    await page.evaluate(
      () => document.activeElement?.closest("dialog") !== null,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Confirm approval", exact: true })
    .click();
  await expect(
    page.getByText("Batch verified. Immutable evidence is available below.", {
      exact: true,
    }),
  ).toBeVisible();
  await persona(page, context, "sewing-supervisor", "/sewing");
  await page.getByLabel("Search order number").fill(order.orderNo);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: order.orderNo, exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: `Open batch ${order.orderNo}`, exact: true })
    .click();
  await expect(
    page.getByText("Approved pieces are ready for sewing assembly.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Side Strap Accents", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("row").filter({ hasText: "Side Strap Accents" }),
  ).toContainText("60");
  await expect(page.getByText(/Verifier: Demo Cutting Verifier/)).toBeVisible();
  if (testInfo.project.name === "chromium")
    for (const width of [1280, 768, 375, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await noPageOverflow(page);
      await expect(
        page.getByRole("button", {
          name: "Start Sewing Assembly",
          exact: true,
        }),
      ).toBeVisible();
      if (width === 1280 || width === 375)
        await page.screenshot({
          path: testInfo.outputPath(`sewing-${width}.png`),
          fullPage: true,
        });
    }
  await page
    .getByRole("button", { name: "Start Sewing Assembly", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm assembly start", exact: true })
    .click();
  await expect(
    page.getByText("Sewing assembly started.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Sewing assembly started.", { exact: true }),
  ).toBeVisible();
  const started = (
    await (await context.request.get(`/api/sewing/${id}`)).json()
  ).data;
  expect(started.status).toBe("VERIFIED");
  expect(started.startedBy).toBeTruthy();
  expect(started.sewingStartedAt).toBeTruthy();
  expect(
    (
      await context.request.post(`/api/sewing/${id}/start`, {
        headers: { Origin: origin },
        data: { expectedRevision: started.revision },
      })
    ).status(),
  ).toBe(409);
  expect(
    (
      await context.request.get(`/api/sewing/queue?search=${order.orderNo}`)
    ).status(),
  ).toBe(200);
});
