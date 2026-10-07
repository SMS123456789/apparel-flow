import {
  expect,
  test,
  type APIRequestContext,
  type APIResponse,
  type BrowserContext,
} from "@playwright/test";
import type {
  AdminUser,
  PageResult,
  AdminAuditEvent,
} from "@/modules/admin/types";
import type { AuthenticatedUser } from "@/modules/identity/types";
const origin = "http://127.0.0.1:3100";
// Wrap private requests so a transport failure cannot print headers/passwords.
async function change(
  request: APIRequestContext,
  url: string,
  method: string,
  data: unknown,
): Promise<APIResponse> {
  try {
    return await request.fetch(url, {
      method,
      data,
      headers: { Origin: origin },
    });
  } catch {
    throw new Error("Private integration request failed; details withheld.");
  }
}
async function privateAdmin(context: BrowserContext) {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!email || !password)
    throw new Error("Configure private bootstrap admin credentials for E2E.");
  const response = await change(context.request, "/api/auth/login", "POST", {
    email,
    password,
  });
  expect(response.status()).toBe(200);
}
async function me(request: APIRequestContext) {
  const response = await request.get("/api/auth/me");
  expect(response.status()).toBe(200);
  return ((await response.json()) as { data: AuthenticatedUser }).data;
}
function storage(cookies: Awaited<ReturnType<BrowserContext["cookies"]>>) {
  const pieces = cookies
    .filter((cookie) => /-auth-token(?:\.\d+)?$/.test(cookie.name))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (!pieces.length) throw new Error("Real Auth session cookie missing.");
  const value = pieces.map((piece) => piece.value).join("");
  const raw = value.startsWith("base64-")
    ? Buffer.from(value.slice(7), "base64url").toString("utf8")
    : value;
  return {
    pieces,
    session: safeSession(raw),
  };
}
function safeSession(raw: string) {
  try {
    return JSON.parse(raw) as {
      access_token: string;
      expires_at: number;
      refresh_token: string;
    };
  } catch {
    throw new Error("Auth cookie parse failed; session content withheld.");
  }
}
test("supervisor real session, role isolation, persona replacement and logout", async ({
  page,
  context,
}) => {
  await page.goto("/login");
  await page
    .getByRole("button", { name: "Cutting Supervisor", exact: true })
    .click();
  await expect(page).toHaveURL(/\/supervisor$/);
  const supervisor = await me(context.request);
  expect(supervisor.role).toBe("CUTTING_SUPERVISOR");
  const cookies = await context.cookies();
  expect(
    cookies
      .filter((cookie) => /-auth-token/.test(cookie.name))
      .every((cookie) => cookie.httpOnly && cookie.sameSite === "Lax"),
  ).toBe(true);
  for (const destination of ["/verifier", "/sewing", "/admin"]) {
    await page.goto(destination);
    await expect(page).toHaveURL(/\/supervisor$/);
  }
  expect((await context.request.get("/api/admin/users")).status()).toBe(403);
  expect(
    (await change(context.request, "/api/admin/users", "POST", {})).status(),
  ).toBe(403);
  expect(
    (
      await change(
        context.request,
        `/api/admin/users/${supervisor.id}/role`,
        "PATCH",
        {},
      )
    ).status(),
  ).toBe(403);
  expect(
    (
      await change(
        context.request,
        `/api/admin/users/${supervisor.id}/status`,
        "PATCH",
        {},
      )
    ).status(),
  ).toBe(403);
  expect((await context.request.get("/api/admin/audit")).status()).toBe(403);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect((await context.request.get("/api/auth/me")).status()).toBe(401);
  await page
    .getByRole("button", { name: "Cutting Verifier", exact: true })
    .click();
  await expect(page).toHaveURL(/\/verifier$/);
  const verifier = await me(context.request);
  expect(verifier.role).toBe("CUTTING_VERIFIER");
  expect(verifier.id === supervisor.id).toBe(false);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
});
test("verifier real login and isolated workspace", async ({
  page,
  context,
}) => {
  await page.goto("/login");
  await page
    .getByRole("button", { name: "Cutting Verifier", exact: true })
    .click();
  await expect(page).toHaveURL(/\/verifier$/);
  expect((await me(context.request)).role).toBe("CUTTING_VERIFIER");
  await page.goto("/supervisor");
  await expect(page).toHaveURL(/\/verifier$/);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
});
test("sewing real login and isolated workspace", async ({ page, context }) => {
  await page.goto("/login");
  await page
    .getByRole("button", { name: "Sewing Supervisor", exact: true })
    .click();
  await expect(page).toHaveURL(/\/sewing$/);
  expect((await me(context.request)).role).toBe("SEWING_SUPERVISOR");
  await page.goto("/verifier");
  await expect(page).toHaveURL(/\/sewing$/);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
});
test("SSR Proxy really refreshes cookies and preserves private response headers", async ({
  context,
}) => {
  expect(
    (
      await change(context.request, "/api/auth/demo", "POST", {
        persona: "cutting-supervisor",
      })
    ).status(),
  ).toBe(200);
  const original = storage(await context.cookies());
  original.session.expires_at = Math.floor(Date.now() / 1000) - 60;
  const value = `base64-${Buffer.from(JSON.stringify(original.session)).toString("base64url")}`;
  await context.clearCookies();
  const chunks = value.match(/.{1,3000}/g)!;
  const baseName = original.pieces[0]!.name.replace(/\.\d+$/, "");
  await context.addCookies(
    chunks.map((chunk, index) => ({
      name: chunks.length === 1 ? baseName : `${baseName}.${index}`,
      value: chunk,
      url: origin,
      httpOnly: true,
      sameSite: "Lax" as const,
    })),
  );
  const response = await context.request.get("/api/auth/me");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  const refreshed = storage(await context.cookies());
  expect(refreshed.session.expires_at > Math.floor(Date.now() / 1000)).toBe(
    true,
  );
  expect(
    refreshed.session.refresh_token === original.session.refresh_token,
  ).toBe(false);
});
test("unauthenticated APIs, invalid credentials and mutation origins fail safely", async ({
  page,
  context,
}) => {
  expect((await context.request.get("/api/admin/users")).status()).toBe(401);
  expect((await context.request.get("/api/auth/me")).status()).toBe(401);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login$/);
  const invalid = await change(context.request, "/api/auth/login", "POST", {
    email: process.env.DEMO_CUTTING_SUPERVISOR_EMAIL,
    password: "invalid-unit-style-password",
  });
  expect(invalid.status()).toBe(401);
  expect(
    (
      await change(context.request, "/api/auth/login", "POST", {
        email: "bad",
        password: "",
      })
    ).status(),
  ).toBe(422);
  const cross = await context.request.post("/api/auth/demo", {
    data: { persona: "cutting-verifier" },
    headers: { Origin: "https://attacker.test" },
  });
  expect(cross.status()).toBe(403);
  const settings = await context.request.get(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`,
    { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! } },
  );
  expect(
    ((await settings.json()) as { disable_signup: boolean }).disable_signup,
  ).toBe(true);
  expect(
    (await context.request.post("/api/auth/signup", { data: {} })).status(),
  ).toBe(404);
});
test("private admin users, guarded dialogs and audit screen", async ({
  page,
  context,
}) => {
  await privateAdmin(context);
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Users", exact: true }),
  ).toBeVisible();
  for (const name of [
    "Demo Cutting Supervisor",
    "Demo Cutting Verifier",
    "Demo Sewing Supervisor",
  ])
    await expect(page.getByRole("cell", { name, exact: true })).toBeVisible();
  await page.goto("/supervisor");
  await expect(page).toHaveURL(/\/admin$/);
  const add = page.getByRole("button", { name: "Add User", exact: true });
  await add.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Full name (required)")).toBeFocused();
  await dialog
    .getByRole("button", { name: "Create User", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toBeFocused();
  await expect(dialog.getByLabel("Temporary password (required)")).toHaveValue(
    "",
  );
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(add).toBeFocused();
  await add.click();
  await dialog.getByLabel("Full name (required)").fill("Unsaved name");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    dialog.getByRole("heading", { name: "Discard changes?" }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Keep editing" }),
  ).toBeFocused();
  await dialog.getByRole("button", { name: "Discard changes" }).click();
  await expect(add).toBeFocused();
  await page
    .getByRole("link", { name: "Administrative audit", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Administrative audit", exact: true }),
  ).toBeVisible();
  const details = page.getByText("View changes", { exact: true }).first();
  await expect(details).toBeVisible();
  const next = page.getByRole("button", { name: "Next", exact: true });
  if (await next.isEnabled()) {
    await next.click();
    await expect(page.getByText("Page 2", { exact: true })).toBeVisible();
    await expect(details).toBeVisible();
    await page.getByRole("button", { name: "Previous", exact: true }).click();
    await expect(page.getByText("Page 1", { exact: true })).toBeVisible();
    await expect(details).toBeVisible();
  }
  await details.click();
  await page
    .getByText("Technical audit details", { exact: true })
    .first()
    .click();
  await expect(
    page.getByText("Request ID", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.locator(".audit-details").first()).toContainText("Before:");
});
test("real admin updates immediately change profile authority and append audit", async ({
  context,
  browser,
}) => {
  await privateAdmin(context);
  const admin = await me(context.request);
  let listing = (
    (await (await context.request.get("/api/admin/users")).json()) as {
      data: PageResult<AdminUser>;
    }
  ).data;
  const target = listing.items.find(
    (user) =>
      user.role === "CUTTING_SUPERVISOR" &&
      user.email === process.env.DEMO_CUTTING_SUPERVISOR_EMAIL,
  )!;
  expect(Boolean(target)).toBe(true);
  const production = await browser.newContext({ baseURL: origin });
  try {
    expect(
      (
        await change(production.request, "/api/auth/demo", "POST", {
          persona: "cutting-supervisor",
        })
      ).status(),
    ).toBe(200);
    const token = storage(await production.cookies()).session.access_token;
    const publicHeaders = {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      Authorization: `Bearer ${token}`,
    };
    const rest = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1`;
    const rawRpc = await production.request.post(
      `${rest}/rpc/admin_list_users`,
      { headers: publicHeaders, data: { p_actor_id: admin.id } },
    );
    expect(rawRpc.status()).toBe(403);
    const rawProduction = await production.request.get(
      `${rest}/cutting_orders?select=id`,
      { headers: publicHeaders },
    );
    expect(rawProduction.status()).toBe(200);
    const rawWrite = await production.request.patch(
      `${rest}/cutting_orders?id=eq.00000000-0000-4000-8000-000000000000`,
      { headers: publicHeaders, data: { status: "VERIFIED" } },
    );
    expect(rawWrite.status()).toBe(403);
    expect(
      (
        await change(
          context.request,
          `/api/admin/users/${admin.id}/status`,
          "PATCH",
          { expectedRevision: 0, isActive: false },
        )
      ).status(),
    ).toBe(403);
    expect(
      (
        await change(
          context.request,
          `/api/admin/users/${admin.id}/role`,
          "PATCH",
          { expectedRevision: 0, role: "CUTTING_SUPERVISOR" },
        )
      ).status(),
    ).toBe(403);
    expect(
      (
        await change(context.request, "/api/admin/users", "POST", {
          email: "unused@apparelflow.test",
          fullName: "Invalid Admin",
          role: "SYSTEM_ADMIN",
          temporaryPassword: "unit-password",
        })
      ).status(),
    ).toBe(422);
    const duplicate = await change(
      context.request,
      "/api/admin/users",
      "POST",
      {
        email: target.email,
        fullName: target.fullName,
        role: target.role,
        temporaryPassword: "unit-password",
      },
    );
    expect(duplicate.status()).toBe(409);
    const roleChange = await change(
      context.request,
      `/api/admin/users/${target.id}/role`,
      "PATCH",
      { expectedRevision: target.revision, role: "CUTTING_VERIFIER" },
    );
    expect(roleChange.status()).toBe(200);
    const changed = ((await roleChange.json()) as { data: AdminUser }).data;
    expect((await me(production.request)).role).toBe("CUTTING_VERIFIER");
    expect(
      (
        await change(
          context.request,
          `/api/admin/users/${target.id}/status`,
          "PATCH",
          { expectedRevision: changed.revision, isActive: false },
        )
      ).status(),
    ).toBe(200);
    expect((await production.request.get("/api/auth/me")).status()).toBe(403);
    const own = await production.request.get(`${rest}/profiles?select=id`, {
      headers: publicHeaders,
    });
    expect(own.status()).toBe(200);
    expect(((await own.json()) as unknown[]).length).toBe(0);
    const audit = (
      (await (await context.request.get("/api/admin/audit")).json()) as {
        data: PageResult<AdminAuditEvent>;
      }
    ).data.items.filter((event) => event.targetUserId === target.id);
    expect(audit.some((event) => event.action === "USER_ROLE_CHANGED")).toBe(
      true,
    );
    expect(audit.some((event) => event.action === "USER_DEACTIVATED")).toBe(
      true,
    );
  } finally {
    listing = (
      (await (await context.request.get("/api/admin/users")).json()) as {
        data: PageResult<AdminUser>;
      }
    ).data;
    let current = listing.items.find((user) => user.id === target.id)!;
    if (current.role !== "CUTTING_SUPERVISOR") {
      const response = await change(
        context.request,
        `/api/admin/users/${current.id}/role`,
        "PATCH",
        { expectedRevision: current.revision, role: "CUTTING_SUPERVISOR" },
      );
      expect(response.status()).toBe(200);
      current = ((await response.json()) as { data: AdminUser }).data;
    }
    if (!current.isActive)
      expect(
        (
          await change(
            context.request,
            `/api/admin/users/${current.id}/status`,
            "PATCH",
            { expectedRevision: current.revision, isActive: true },
          )
        ).status(),
      ).toBe(200);
    await production.close();
  }
});
