import { describe, expect, it, vi } from "vitest";
import { createOrderSchema, editOrderSchema } from "@/modules/orders/schemas";
import { expectedFabric, requirements } from "@/modules/orders/calculations";
import { OrderService } from "@/server/services/order-service";
import type { OrderRepository } from "@/server/repositories/order-repository";
import { supervisor, recipe, order } from "../fixtures/production";
vi.mock("server-only", () => ({}));
const input = {
  recipeId: recipe.id,
  targetQty: 50,
  fabricRollId: "ROLL",
  actualFabricYards: 94.5,
};
function setup() {
  const orders = {
    list: vi
      .fn<OrderRepository["list"]>()
      .mockResolvedValue({ items: [order], nextCursor: null }),
    find: vi.fn<OrderRepository["find"]>().mockResolvedValue(order),
    create: vi.fn<OrderRepository["create"]>().mockResolvedValue(order.id),
    edit: vi.fn<OrderRepository["edit"]>(),
    submit: vi.fn<OrderRepository["submit"]>(),
    recut: vi.fn<OrderRepository["recut"]>(),
  };
  const recipes = {
    find: vi.fn().mockResolvedValue(recipe),
    list: vi.fn().mockResolvedValue([recipe]),
  };
  return { orders, recipes, service: new OrderService(orders, recipes) };
}
describe("authoritative expectations", () => {
  it("50 blouses require 100 cuffs and 90 yards", () => {
    expect(
      requirements(recipe, 50).find((c) => c.name === "Sleeve Cuffs")
        ?.expectedQty,
    ).toBe(100);
    expect(expectedFabric(50, "1.8")).toBe("90");
  });
  it("preserves exact thousandths at extreme supported target", () => {
    expect(expectedFabric(2147483647, "999999999.999")).toBe(
      "2147483646997852516.353",
    );
    expect(expectedFabric(3, "0.001")).toBe("0.003");
  });
  it("rejects empty BOM and unsafe multiplication", () => {
    expect(() => requirements({ ...recipe, components: [] }, 50)).toThrow();
    expect(() =>
      requirements(
        {
          ...recipe,
          components: [
            { ...recipe.components[0]!, piecesPerGarment: 2147483647 },
          ],
        },
        2147483647,
      ),
    ).toThrow();
  });
});
describe("strict preparation inputs", () => {
  it.each([0, -1, 1.5, "50", null, NaN, Infinity, 2147483648])(
    "rejects invalid target %s",
    (targetQty) => {
      expect(createOrderSchema.safeParse({ ...input, targetQty }).success).toBe(
        false,
      );
    },
  );
  it.each([0, -1, "94.5", null, NaN, Infinity, 1.1234, 1e9, 0.0001])(
    "rejects invalid fabric %s",
    (actualFabricYards) => {
      expect(
        createOrderSchema.safeParse({ ...input, actualFabricYards }).success,
      ).toBe(false);
    },
  );
  it("accepts positive decimal and trimmed nonempty roll", () => {
    expect(
      createOrderSchema.parse({
        ...input,
        fabricRollId: " ROLL ",
        actualFabricYards: 0.001,
      }),
    ).toMatchObject({ fabricRollId: "ROLL", actualFabricYards: 0.001 });
    expect(
      createOrderSchema.safeParse({ ...input, fabricRollId: " \t\n" }).success,
    ).toBe(false);
  });
  it.each(["expectedQty", "createdBy", "status", "verifiedBy", "submittedAt"])(
    "rejects protected %s",
    (key) => {
      expect(
        createOrderSchema.safeParse({ ...input, [key]: "forged" }).success,
      ).toBe(false);
    },
  );
  it("rejects empty preparation changes", () => {
    expect(editOrderSchema.safeParse({ expectedRevision: 0 }).success).toBe(
      false,
    );
  });
});
describe("cutting service", () => {
  it("creates with authenticated actor and server recipe checks", async () => {
    const { service, orders } = setup();
    expect(await service.create(supervisor, input)).toEqual(order);
    expect(orders.create).toHaveBeenCalledWith(supervisor.id, input);
  });
  it.each(["CUTTING_VERIFIER", "SEWING_SUPERVISOR", "SYSTEM_ADMIN"] as const)(
    "denies all cutting mutations for %s",
    async (role) => {
      const { service, orders } = setup();
      const actor = { ...supervisor, role };
      for (const action of [
        () => service.create(actor, input),
        () =>
          service.edit(actor, order.id, {
            expectedRevision: 0,
            fabricRollId: "NEW",
          }),
        () => service.submit(actor, order.id, 0),
        () => service.recut(actor, order.id, 0),
      ])
        await expect(action()).rejects.toMatchObject({ status: 403 });
      expect(orders.find).not.toHaveBeenCalled();
      expect(orders.create).not.toHaveBeenCalled();
    },
  );
  it("denies inactive supervisor", async () => {
    await expect(
      setup().service.create({ ...supervisor, isActive: false }, input),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("rejects stale submission before command", async () => {
    const { service, orders } = setup();
    await expect(service.submit(supervisor, order.id, 2)).rejects.toMatchObject(
      { status: 409 },
    );
    expect(orders.submit).not.toHaveBeenCalled();
  });
  it("does not change frozen recipe/target in recut preparation", async () => {
    const { service, orders } = setup();
    orders.find.mockResolvedValue({
      ...order,
      firstSubmittedAt: order.createdAt,
    });
    await expect(
      service.edit(supervisor, order.id, {
        expectedRevision: 0,
        targetQty: 60,
      }),
    ).rejects.toMatchObject({ status: 422 });
    expect(orders.edit).not.toHaveBeenCalled();
  });
  it("allows replacement fabric without changing frozen basis", async () => {
    const { service, orders } = setup();
    orders.find.mockResolvedValue({
      ...order,
      firstSubmittedAt: order.createdAt,
    });
    await service.edit(supervisor, order.id, {
      expectedRevision: 0,
      actualFabricYards: 95,
    });
    expect(orders.edit).toHaveBeenCalledWith(supervisor.id, order.id, {
      expectedRevision: 0,
      actualFabricYards: 95,
    });
  });
  it("allows factory supervisor recut only from rejected state", async () => {
    const { service, orders } = setup();
    orders.find.mockResolvedValue({ ...order, status: "REJECTED" });
    await service.recut(
      { ...supervisor, id: "93000000-0000-4000-8000-000000000003" },
      order.id,
      0,
    );
    expect(orders.recut).toHaveBeenCalled();
  });
});
