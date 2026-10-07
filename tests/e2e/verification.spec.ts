import { expect, test, type Page, type BrowserContext } from "@playwright/test";
import type { OrderDetail } from "@/modules/orders/types";
const origin = "http://127.0.0.1:3100";
async function persona(
  page: Page,
  context: BrowserContext,
  role: string,
  path: string,
) {
  const response = await context.request.post("/api/auth/demo", {
    headers: { Origin: origin },
    data: { persona: role.toLowerCase().replaceAll("_", "-") },
  });
  expect(response.status()).toBe(200);
  await page.goto(path);
}
test("verifier persists zero, rejects shortage, recounts re-cut and signs immutable evidence", async ({
  page,
  context,
}, testInfo) => {
  test.setTimeout(90000);
  await persona(page, context, "CUTTING_SUPERVISOR", "/supervisor");
  const result = await context.request.post("/api/orders", {
    headers: { Origin: origin },
    data: {
      recipeId: "10000000-0000-4000-8000-000000000001",
      targetQty: 50,
      fabricRollId: `E2E-VERIFICATION-${crypto.randomUUID()}`,
      actualFabricYards: 81,
    },
  });
  expect(result.status()).toBe(201);
  let order: OrderDetail = (await result.json()).data;
  expect(
    (
      await context.request.post(`/api/orders/${order.id}/submit`, {
        headers: { Origin: origin },
        data: { expectedRevision: order.revision },
      })
    ).status(),
  ).toBe(200);
  await persona(page, context, "CUTTING_VERIFIER", `/verifier/${order.id}`);
  await expect(
    page.getByRole("heading", { name: order.orderNo }),
  ).toBeVisible();
  const approve = page.getByRole("button", { name: "Approve", exact: true });
  await expect(approve).toBeDisabled();
  for (const c of order.components)
    await expect(
      page.getByLabel(`${c.name} actual pieces`, { exact: true }),
    ).toHaveValue("");
  await page
    .getByLabel("Front Body Panel actual pieces", { exact: true })
    .fill("0");
  await expect(
    page.getByRole("row").filter({ hasText: "Front Body Panel" }),
  ).toContainText("Shortage 50");
  await page.getByRole("button", { name: "Save Counts", exact: true }).click();
  await expect(page.getByText("Saved counts.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page.getByLabel("Front Body Panel actual pieces", { exact: true }),
  ).toHaveValue("0");
  order = (
    await (await context.request.get(`/api/verification/${order.id}`)).json()
  ).data;
  const body = {
    attemptId: order.currentAttemptId,
    expectedRevision: order.revision,
  };
  expect(
    (
      await context.request.post(`/api/verification/${order.id}/approve`, {
        headers: { Origin: origin },
        data: body,
      })
    ).status(),
  ).toBe(422);
  expect(
    (
      await context.request.post(`/api/verification/${order.id}/reject`, {
        headers: { Origin: origin },
        data: { ...body, reason: " \n" },
      })
    ).status(),
  ).toBe(422);
  expect(
    (
      await context.request.post(`/api/verification/${order.id}/approve`, {
        headers: { Origin: origin },
        data: { ...body, verifierId: order.createdBy },
      })
    ).status(),
  ).toBe(422);
  await page.getByRole("button", { name: "Reject", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirm rejection", exact: true })
    .click();
  await expect(
    page.getByLabel("Rejection reason (required, maximum 1000 characters)"),
  ).toBeFocused();
  await page
    .getByLabel("Rejection reason (required, maximum 1000 characters)")
    .fill("  Front panel missing; re-cut required.  ");
  await page
    .getByRole("button", { name: "Confirm rejection", exact: true })
    .click();
  await expect(
    page.getByText("Reason: Front panel missing; re-cut required.", {
      exact: true,
    }),
  ).toBeVisible();
  const rejected = (
    await (await context.request.get(`/api/verification/${order.id}`)).json()
  ).data as OrderDetail;
  expect(
    rejected.evidence[0]!.items.find((item) => item.name === "Front Body Panel")
      ?.actualQty,
  ).toBe(0);
  expect(rejected.evidence[0]!.wastagePct).toBe("-10.000000000000");
  await persona(page, context, "SEWING_SUPERVISOR", "/sewing");
  expect((await context.request.get(`/api/sewing/${order.id}`)).status()).toBe(
    404,
  );
  const hidden = await context.request.get(
    `/api/sewing/queue?search=${order.orderNo}`,
  );
  expect((await hidden.json()).data.items).toEqual([]);
  await persona(page, context, "CUTTING_SUPERVISOR", `/supervisor/${order.id}`);
  await expect(
    page.getByRole("heading", { name: "Re-cut required", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Begin Re-cut", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Begin Re-cut", exact: true })
    .click();
  await expect(
    page.getByLabel("Actual fabric used (yards, required)"),
  ).toBeEditable();
  await page
    .getByLabel("Fabric roll ID (required)")
    .fill(`E2E-RECUT-${crypto.randomUUID()}`);
  await page.getByLabel("Actual fabric used (yards, required)").fill("94.5");
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
  await expect(page.getByText("Waiting for QC", { exact: true })).toBeVisible();
  await persona(page, context, "CUTTING_VERIFIER", `/verifier/${order.id}`);
  for (const c of order.components) {
    const field = page.getByLabel(`${c.name} actual pieces`, { exact: true });
    await expect(field).toHaveValue("");
    await field.fill(
      String(c.expectedQty + (c.name === "Sleeve Cuffs" ? 1 : 0)),
    );
  }
  await expect(approve).toBeDisabled();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("verifier-counts.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Save Counts", exact: true }).click();
  await expect(approve).toBeEnabled();
  await page.reload();
  await expect(approve).toBeEnabled();
  await approve.click();
  await page
    .getByRole("button", { name: "Confirm approval", exact: true })
    .click();
  await expect(
    page.getByText("Batch verified. Immutable evidence is available below.", {
      exact: true,
    }),
  ).toBeVisible();
  order = (
    await (await context.request.get(`/api/verification/${order.id}`)).json()
  ).data;
  expect(order.status).toBe("VERIFIED");
  expect(order.evidence).toHaveLength(2);
  expect(order.evidence[0]).toEqual(rejected.evidence[0]);
  expect(order.evidence[1]!.wastagePct).toBe("5.000000000000");
  expect(
    (
      await context.request.post(`/api/verification/${order.id}/approve`, {
        headers: { Origin: origin },
        data: {
          attemptId: order.currentAttemptId,
          expectedRevision: order.revision,
        },
      })
    ).status(),
  ).toBe(409);
  await persona(page, context, "SEWING_SUPERVISOR", "/sewing");
  await page.getByLabel("Search order number").fill(order.orderNo);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page
    .getByRole("link", { name: `Open batch ${order.orderNo}`, exact: true })
    .click();
  await expect(
    page.getByText("Reason: Front panel missing; re-cut required.", {
      exact: true,
    }),
  ).not.toBeVisible();
  const ready = (
    await (await context.request.get(`/api/sewing/${order.id}`)).json()
  ).data;
  expect(ready.evidence.decision).toBe("APPROVED");
  expect(ready.evidence.id).toBe(order.approvedLogId);
  expect(ready).not.toHaveProperty("attempts");
  await page
    .getByRole("button", { name: "Start Sewing Assembly", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm assembly start", exact: true })
    .click();
  await expect(
    page.getByText("Assembly started", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Assembly started", { exact: true }),
  ).toBeVisible();
});
