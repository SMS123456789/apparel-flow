import { expect, type Locator, type Page } from "@playwright/test";
export async function controlContrast(locator: Locator) {
  const measured = await locator.evaluate((element) => {
    const style = getComputedStyle(element);
    function luminance(value: string) {
      const c = (value.match(/[\d.]+/g) ?? [])
        .slice(0, 3)
        .map(Number)
        .map((x) => {
          const v = x / 255;
          return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
        });
      return c[0]! * 0.2126 + c[1]! * 0.7152 + c[2]! * 0.0722;
    }
    function ratio(a: string, b: string) {
      const x = luminance(a),
        y = luminance(b);
      return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
    }
    let background = style.backgroundColor,
      parent = element.parentElement;
    while (background === "rgba(0, 0, 0, 0)" && parent) {
      background = getComputedStyle(parent).backgroundColor;
      parent = parent.parentElement;
    }
    if (background === "rgba(0, 0, 0, 0)") background = "rgb(255, 255, 255)";
    return {
      text: ratio(style.color, background),
      border: ratio(style.borderTopColor, "rgb(255, 255, 255)"),
      font: Number.parseFloat(style.fontSize),
      height: element.getBoundingClientRect().height,
      opacity: style.opacity,
      outline: style.outlineWidth,
    };
  });
  expect(measured.text).toBeGreaterThanOrEqual(4.5);
  expect(measured.border).toBeGreaterThanOrEqual(3);
  expect(measured.opacity).toBe("1");
  return measured;
}
export async function noPageOverflow(page: Page) {
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
}
