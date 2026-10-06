import { expect, test, type Locator } from "@playwright/test";

test("responsive layouts, measured control contrast and keyboard dialogs", async ({
  page,
  context,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "Explicit review viewports use the desktop browser.",
  );
  async function contrast(locator: Locator, placeholder = false) {
    const measured = await locator.evaluate((element, usePlaceholder) => {
      const style = getComputedStyle(element);
      const foreground = usePlaceholder
        ? getComputedStyle(element, "::placeholder").color
        : style.color;
      function rgb(value: string) {
        return (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
      }
      function luminance(value: string) {
        const values = rgb(value).map((channel) => {
          const fraction = channel / 255;
          return fraction <= 0.04045
            ? fraction / 12.92
            : ((fraction + 0.055) / 1.055) ** 2.4;
        });
        return values[0]! * 0.2126 + values[1]! * 0.7152 + values[2]! * 0.0722;
      }
      function ratio(first: string, second: string) {
        const a = luminance(first),
          b = luminance(second);
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      }
      return {
        text: ratio(foreground, style.backgroundColor),
        border: ratio(style.borderTopColor, "rgb(255, 255, 255)"),
      };
    }, placeholder);
    expect(measured.text).toBeGreaterThanOrEqual(4.5);
    expect(measured.border).toBeGreaterThanOrEqual(3);
  }
  await page.goto("/login");
  for (const width of [1280, 768, 375, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(
      page.getByRole("heading", { name: "Sign in", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    if (width === 1280 || width === 375)
      await page.screenshot({
        path: testInfo.outputPath(`login-${width}.png`),
        fullPage: true,
      });
  }
  const email = page.getByLabel("Email (required)");
  const signIn = page.getByRole("button", { name: "Sign in", exact: true });
  await contrast(email);
  await email.focus();
  await contrast(email);
  await page.keyboard.press("Tab");
  expect(
    await page
      .getByLabel("Password (required)")
      .evaluate((element) => getComputedStyle(element).outlineWidth),
  ).toBe("2px");
  await signIn.click();
  await expect(
    page.getByText("Check the highlighted fields.", { exact: true }),
  ).toBeFocused();
  await expect(email).toHaveAttribute("aria-invalid", "true");
  await contrast(email);
  await contrast(signIn);
  await signIn.hover();
  await contrast(signIn);
  // Measure transient disabled/readonly presentation independently of request timing.
  await email.evaluate((element: HTMLInputElement) => {
    element.disabled = true;
  });
  await contrast(email);
  await email.evaluate((element: HTMLInputElement) => {
    element.disabled = false;
    element.readOnly = true;
  });
  await contrast(email);
  await signIn.evaluate((element: HTMLButtonElement) => {
    element.disabled = true;
  });
  await signIn.hover({ force: true });
  await contrast(signIn);
  const privateEmail = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const privatePassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!privateEmail || !privatePassword)
    throw new Error("Private admin configuration required for UI review.");
  let response;
  try {
    response = await context.request.post("/api/auth/login", {
      data: { email: privateEmail, password: privatePassword },
      headers: { Origin: "http://127.0.0.1:3100" },
    });
  } catch {
    throw new Error("Private sign-in transport failed; details withheld.");
  }
  expect(response.status()).toBe(200);
  await page.goto("/admin");
  await expect(
    page.getByRole("cell", { name: "Demo Cutting Supervisor", exact: true }),
  ).toBeVisible();
  for (const width of [1280, 768, 375, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await expect(
      page.getByRole("button", { name: "Add User", exact: true }),
    ).toBeVisible();
    if (width === 1280 || width === 375)
      await page.screenshot({
        path: testInfo.outputPath(`admin-${width}.png`),
        fullPage: true,
      });
  }
  await contrast(page.getByLabel("Search users"), true);
  await contrast(page.getByLabel("Role", { exact: true }));
  await contrast(page.getByLabel("Status", { exact: true }));
  const add = page.getByRole("button", { name: "Add User", exact: true });
  await add.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Full name (required)")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    dialog.getByRole("button", { name: "Create User", exact: true }),
  ).toBeFocused();
  for (let index = 0; index < 10; index++) {
    await page.keyboard.press("Tab");
    expect(
      await dialog.evaluate((element) =>
        element.contains(document.activeElement),
      ),
    ).toBe(true);
  }
  await page.screenshot({
    path: testInfo.outputPath("admin-dialog-320.png"),
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(add).toBeFocused();
});
