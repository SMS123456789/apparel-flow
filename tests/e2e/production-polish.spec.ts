import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import type { OrderDetail } from "@/modules/orders/types";
import {
  compareProductionEvents,
  type ProductionAuditEvent,
  type ProductionAuditPage,
} from "@/modules/admin/production-audit";
import { noPageOverflow } from "./production-review";
const origin = "http://127.0.0.1:3100";
async function change(
  context: BrowserContext,
  url: string,
  method: string,
  data: unknown,
) {
  try {
    return await context.request.fetch(url, {
      method,
      data,
      headers: { Origin: origin },
    });
  } catch {
    throw new Error("Private test request failed; credentials withheld.");
  }
}
async function signIn(context: BrowserContext, persona: string) {
  const response = await change(
    context,
    persona === "admin" ? "/api/auth/login" : "/api/auth/demo",
    "POST",
    persona === "admin"
      ? {
          email: process.env.BOOTSTRAP_ADMIN_EMAIL,
          password: process.env.BOOTSTRAP_ADMIN_PASSWORD,
        }
      : { persona },
  );
  expect(response.status()).toBe(200);
  return (await response.json()).data.user;
}
async function command(
  context: BrowserContext,
  url: string,
  method: string,
  body: unknown,
): Promise<OrderDetail> {
  const response = await change(context, url, method, body);
  expect(response.status()).toBe(url === "/api/orders" ? 201 : 200);
  return (await response.json()).data;
}
async function hold(page: Page, pattern: string) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    pattern,
    async (route) => {
      const response = await route.fetch();
      await gate;
      await route.fulfill({ response });
    },
    { times: 1 },
  );
  return release;
}
test("production audit proves recorded workflow events without granting manufacturing authority", async ({
  page,
  context,
}) => {
  test.setTimeout(120_000);
  expect(
    (await context.request.get("/api/admin/production-audit")).status(),
  ).toBe(401);
  const creator = await signIn(context, "cutting-supervisor");
  let order = await command(context, "/api/orders", "POST", {
    recipeId: "10000000-0000-4000-8000-000000000001",
    targetQty: 2,
    fabricRollId: `E2E-AUDIT-${crypto.randomUUID()}`,
    actualFabricYards: 3.78,
  });
  const createdAt = order.createdAt;
  order = await command(context, `/api/orders/${order.id}/submit`, "POST", {
    expectedRevision: order.revision,
  });
  const verifier = await signIn(context, "cutting-verifier");
  order = await command(
    context,
    `/api/verification/${order.id}/reject`,
    "POST",
    {
      expectedRevision: order.revision,
      attemptId: order.currentAttemptId,
      reason: "Front Body Panel shortage; recorded audit test evidence.",
    },
  );
  const rejected = {
    ...order.evidence[0]!,
    items: order.evidence[0]!.items.toSorted((a, b) =>
      a.name.localeCompare(b.name),
    ),
  };
  await signIn(context, "cutting-supervisor");
  order = await command(context, `/api/orders/${order.id}/recut`, "POST", {
    expectedRevision: order.revision,
  });
  order = await command(context, `/api/orders/${order.id}/submit`, "POST", {
    expectedRevision: order.revision,
  });
  await signIn(context, "cutting-verifier");
  order = await command(
    context,
    `/api/verification/${order.id}/counts`,
    "PATCH",
    {
      expectedRevision: order.revision,
      attemptId: order.currentAttemptId,
      items: order.components.map((c) => ({
        componentId: c.componentId,
        actualQty: c.expectedQty,
      })),
    },
  );
  order = await command(
    context,
    `/api/verification/${order.id}/approve`,
    "POST",
    { expectedRevision: order.revision, attemptId: order.currentAttemptId },
  );
  const approval = order.evidence.at(-1)!;
  const approved = {
    ...approval,
    items: approval.items.toSorted((a, b) => a.name.localeCompare(b.name)),
  };
  const sewingActor = await signIn(context, "sewing-supervisor");
  const started = await command(
    context,
    `/api/sewing/${order.id}/start`,
    "POST",
    { expectedRevision: order.revision },
  );
  for (const persona of [
    "cutting-supervisor",
    "cutting-verifier",
    "sewing-supervisor",
  ]) {
    await signIn(context, persona);
    expect(
      (await context.request.get("/api/admin/production-audit")).status(),
    ).toBe(403);
    await page.goto("/admin/production-audit");
    await expect(page).not.toHaveURL(/\/admin/);
  }
  await signIn(context, "admin");
  for (const path of [
    "/api/orders",
    "/api/recipes",
    "/api/verification/queue",
    `/api/verification/${order.id}`,
    "/api/sewing/queue",
    `/api/sewing/${order.id}`,
  ])
    expect((await context.request.get(path)).status()).toBe(403);
  for (const path of [
    `/api/orders/${order.id}/submit`,
    `/api/verification/${order.id}/approve`,
    `/api/sewing/${order.id}/start`,
  ])
    expect((await change(context, path, "POST", {})).status()).toBe(403);
  for (const method of ["POST", "PATCH", "DELETE"])
    expect(
      (
        await change(context, "/api/admin/production-audit", method, {})
      ).status(),
    ).toBe(405);
  expect(
    (
      await context.request.get("/api/admin/production-audit?cursor=broken")
    ).status(),
  ).toBe(422);
  const entries: ProductionAuditEvent[] = [];
  let cursor: string | null = null;
  for (let i = 0; i < 4; i++) {
    const response = await context.request.get(
      `/api/admin/production-audit?limit=3${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
    );
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toContain("no-store");
    const audit: ProductionAuditPage = (await response.json()).data;
    expect(audit.items.length).toBeLessThanOrEqual(3);
    entries.push(...audit.items);
    cursor = audit.nextCursor;
    if (!cursor) break;
  }
  expect(new Set(entries.map((e) => `${e.source}:${e.id}`)).size).toBe(
    entries.length,
  );
  for (let i = 1; i < entries.length; i++)
    expect(
      compareProductionEvents(entries[i - 1]!, entries[i]!),
    ).toBeLessThanOrEqual(0);
  const events = entries.filter((e) => e.orderId === order.id);
  expect(events.map((e) => e.action)).toEqual([
    "SEWING_STARTED",
    "APPROVED",
    "SUBMITTED",
    "REJECTED",
    "SUBMITTED",
    "ORDER_CREATED",
  ]);
  expect(events.find((e) => e.action === "ORDER_CREATED")).toMatchObject({
    time: createdAt,
    actorId: creator.id,
    actorNameBasis: "current account name",
  });
  expect(
    events.find((e) => e.action === "ORDER_CREATED")?.targetQty,
  ).toBeUndefined();
  expect(events.find((e) => e.action === "REJECTED")).toMatchObject({
    actorId: verifier.id,
    time: rejected.createdAt,
    actorNameBasis: "decision snapshot",
    evidence: rejected,
  });
  expect(events.find((e) => e.action === "APPROVED")?.evidence).toEqual(
    approved,
  );
  expect(events[0]).toMatchObject({
    actorId: sewingActor.id,
    time: started.sewingStartedAt,
    evidence: approved,
  });
  await page.goto("/admin/production-audit");
  await expect(page).toHaveTitle("Production audit · ApparelFlow");
  const row = page
    .getByRole("row")
    .filter({ hasText: order.orderNo })
    .filter({ hasText: "Sewing started" });
  await row.getByRole("button", { name: /View batch/ }).click();
  await expect(
    page.getByRole("heading", { name: "Approved batch evidence" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Immutable component evidence" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: /Start Sewing|Approve|Reject|Submit|Save/,
    }),
  ).toHaveCount(0);
  for (const width of [1280, 768, 375, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await noPageOverflow(page);
  }
});
test("workspace skeletons resolve and refresh retains rows through empty and safe-error results", async ({
  page,
  context,
}) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const cases = [
    ["cutting-supervisor", "/supervisor", "**/api/orders?*"],
    ["cutting-verifier", "/verifier", "**/api/verification/queue?*"],
    ["sewing-supervisor", "/sewing", "**/api/sewing/queue?*"],
    ["admin", "/admin", "**/api/admin/users?*"],
    ["admin", "/admin/audit", "**/api/admin/audit"],
    ["admin", "/admin/production-audit", "**/api/admin/production-audit"],
  ];
  for (const [persona, path, pattern] of cases) {
    await signIn(context, persona!);
    const release = await hold(page, pattern!);
    try {
      await page.goto(path!);
      await expect(page.locator(".skeleton-row").first()).toBeVisible();
      await expect(page.locator(".table-region").first()).toHaveAttribute(
        "aria-busy",
        "true",
      );
      expect(
        await page
          .locator(".skeleton-bar")
          .first()
          .evaluate((e) => getComputedStyle(e).animationName),
      ).toBe("none");
    } finally {
      release();
    }
    await expect(page.locator(".skeleton-row")).toHaveCount(0);
    await expect(page.locator(".table-region").first()).toHaveAttribute(
      "aria-busy",
      "false",
    );
    await expect(page.locator(".alert.error")).toHaveCount(0);
  }
  await signIn(context, "cutting-supervisor");
  await page.goto("/supervisor");
  const first = page.locator("tbody tr:not(.skeleton-row)").first();
  await expect(first).toBeVisible();
  const oldOrder = await first.locator("td").first().innerText();
  const release = await hold(page, "**/api/orders?*");
  try {
    await page.getByLabel("Search order number").fill("NO-MATCH-POLISH-TEST");
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(
      page.getByRole("button", { name: "Applying…" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("cell", { name: oldOrder, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Cutting orders" }),
    ).toHaveAttribute("aria-busy", "true");
  } finally {
    release();
  }
  await expect(page.locator(".empty-state")).toBeVisible();
  await page.route(
    "**/api/orders?*",
    (route) =>
      route.fulfill({
        status: 503,
        json: {
          error: { message: "Data service unavailable. Try again shortly." },
        },
      }),
    { times: 1 },
  );
  await page.getByLabel("Search order number").fill("");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.locator('.alert.error[role="alert"]')).toHaveText(
    "Data service unavailable. Try again shortly.",
  );
  await expect(
    page.getByRole("region", { name: "Cutting orders" }),
  ).toHaveAttribute("aria-busy", "false");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(first).toBeVisible();
  await expect(page.locator(".alert.error")).toHaveCount(0);
  const icon = await context.request.get("/icon.svg");
  expect(icon.status()).toBe(200);
  expect(icon.headers()["content-type"]).toContain("image/svg+xml");
  expect(await page.locator('link[rel="icon"]').getAttribute("href")).toContain(
    "/icon.svg",
  );
});
test("demo sign-in and creation expose precise guarded pending labels with stable width", async ({
  page,
}) => {
  await page.goto("/login");
  const releaseLogin = await hold(page, "**/api/auth/demo");
  try {
    await page
      .getByRole("button", { name: "Cutting Supervisor", exact: true })
      .click();
    await expect(page.getByRole("status")).toHaveText(
      "Signing in as Cutting Supervisor…",
    );
    await expect(
      page.locator('[data-role="CUTTING_SUPERVISOR"]'),
    ).toHaveAttribute("aria-busy", "true");
    await expect(
      page.getByRole("button", { name: "Cutting Verifier", exact: true }),
    ).toBeDisabled();
  } finally {
    releaseLogin();
  }
  await expect(page).toHaveURL(/\/supervisor$/);
  await page.goto("/supervisor/new");
  await page.getByLabel("Target batch quantity (garments, required)").fill("2");
  await page
    .getByLabel("Fabric roll ID (required)")
    .fill(`E2E-PENDING-${crypto.randomUUID()}`);
  await page.getByLabel("Actual fabric used (yards, required)").fill("3.78");
  const create = page.getByRole("button", {
    name: "Create Order",
    exact: true,
  });
  const width = (await create.boundingBox())!.width;
  const releaseCreate = await hold(page, "**/api/orders");
  try {
    await create.click();
    const pending = page.getByRole("button", {
      name: "Creating…",
      exact: true,
    });
    await expect(pending).toBeDisabled();
    await expect(pending).toHaveAttribute("aria-busy", "true");
    expect((await pending.boundingBox())!.width).toBe(width);
    await expect(page.getByLabel("Fabric roll ID (required)")).toBeDisabled();
  } finally {
    releaseCreate();
  }
  await expect(page).toHaveURL(/\/supervisor\/[\da-f-]+$/);
  await expect(page.getByRole("status")).toContainText("Saved preparation");
});
