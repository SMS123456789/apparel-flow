import type { Recipe, RequiredComponent } from "./types";
// Integer thousandths preserve approved fabric precision without float rounding.
export function fabricThousandths(value: string): bigint {
  if (!/^\d+(?:\.\d{1,3})?$/.test(value))
    throw new Error("Invalid fabric precision");
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole!) * BigInt(1000) + BigInt(fraction.padEnd(3, "0"));
}
export function decimalThousandths(value: bigint): string {
  const whole = value / BigInt(1000);
  const fraction = (value % BigInt(1000))
    .toString()
    .padStart(3, "0")
    .replace(/0+$/, "");
  return `${whole}${fraction ? `.${fraction}` : ""}`;
}
export function expectedFabric(
  targetQty: number,
  standardYards: string,
): string {
  return decimalThousandths(
    BigInt(targetQty) * fabricThousandths(standardYards),
  );
}
export function requirements(
  recipe: Recipe,
  targetQty: number,
): RequiredComponent[] {
  if (
    !Number.isInteger(targetQty) ||
    targetQty <= 0 ||
    targetQty > 2147483647 ||
    !recipe.components.length
  )
    throw new Error("Invalid requirements");
  return recipe.components.map((component) => {
    const expected = BigInt(targetQty) * BigInt(component.piecesPerGarment);
    if (expected > BigInt(Number.MAX_SAFE_INTEGER) || expected <= BigInt(0))
      throw new Error("Quantity exceeds safe bounds");
    return {
      componentId: component.id,
      name: component.name,
      piecesPerGarment: component.piecesPerGarment,
      expectedQty: Number(expected),
      sortOrder: component.sortOrder,
    };
  });
}
