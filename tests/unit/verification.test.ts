import { describe, expect, it, vi } from "vitest";
import {
  approvalViolations,
  componentResult,
  wastagePercentage,
} from "@/modules/verification/rules";
import {
  countSchema,
  decisionSchema,
  rejectSchema,
  saveCountsSchema,
} from "@/modules/verification/schemas";
import { VerificationService } from "@/server/services/verification-service";
import { translateVerificationError } from "@/server/repositories/verification-repository";
import type { OrderRepository } from "@/server/repositories/order-repository";
import { order, verifier, supervisor } from "../fixtures/production";
import { pending, decision } from "../fixtures/verification";
vi.mock("server-only", () => ({}));
function setup(data = pending()) {
  const orders = {
    find: vi.fn().mockResolvedValue(data),
    list: vi.fn(),
  } as unknown as OrderRepository;
  const commands = { save: vi.fn(), approve: vi.fn(), reject: vi.fn() };
  return {
    orders,
    commands,
    service: new VerificationService(orders, commands),
  };
}
describe("explicit component and signed fabric rules", () => {
  it("distinguishes uncounted from zero and excess from a match", () => {
    expect(componentResult(100, null)).toBe(null);
    expect(componentResult(100, 0)).toBe("RED");
    expect(componentResult(100, 100)).toBe("GREEN");
    expect(componentResult(100, 101)).toBe("YELLOW");
    expect(
      approvalViolations(order.components, pending(null).attempts[0]!.items),
    ).toHaveLength(5);
  });
  it("recomputes counts rather than trusting stored flags", () => {
    const data = pending();
    data.attempts[0]!.items[0]!.actualQty = 0;
    expect(
      approvalViolations(data.components, data.attempts[0]!.items),
    ).toEqual([
      { componentId: data.components[0]!.componentId, reason: "SHORTAGE" },
    ]);
  });
  it("fails closed on missing, duplicate, foreign, empty or mismatched components", () => {
    const data = pending();
    const items = data.attempts[0]!.items;
    for (const rows of [
      items.slice(1),
      [...items, items[0]!],
      [{ ...items[0]!, componentId: verifier.id }, ...items.slice(1)],
      [{ ...items[0]!, expectedQty: 999 }, ...items.slice(1)],
    ])
      expect(approvalViolations(data.components, rows).length).toBeGreaterThan(
        0,
      );
    expect(approvalViolations([], [])).toEqual([
      { reason: "MISSING_COMPONENT" },
    ]);
  });
  it.each([
    ["94.5", "90", "5"],
    ["81", "90", "-10"],
    ["90", "90", "0"],
    ["0.002", "0.003", "-33.333333333333"],
    ["100", "90", "11.111111111111"],
  ])("calculates %s against %s exactly as %s", (a, e, percent) =>
    expect(wastagePercentage(a!, e!)).toBe(percent),
  );
  it.each([-1, 0.5, "100", null, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid count %s",
    (value) => expect(countSchema.safeParse(value).success).toBe(false),
  );
  it("accepts zero, forbids empty/duplicate save payloads and forged authority", () => {
    const item = {
      componentId: order.components[0]!.componentId,
      actualQty: 0,
    };
    expect(
      saveCountsSchema.safeParse({ ...decision, items: [item] }).success,
    ).toBe(true);
    expect(saveCountsSchema.safeParse({ ...decision, items: [] }).success).toBe(
      false,
    );
    expect(
      saveCountsSchema.safeParse({ ...decision, items: [item, item] }).success,
    ).toBe(false);
    for (const key of [
      "verifierId",
      "verifiedBy",
      "status",
      "decisionTimestamp",
      "items",
    ])
      expect(
        decisionSchema.safeParse({ ...decision, [key]: "forged" }).success,
      ).toBe(false);
  });
  it.each(["", " \t\n", "\u00a0\ufeff", "x".repeat(1001)])(
    "rejects invalid reason",
    (reason) =>
      expect(rejectSchema.safeParse({ ...decision, reason }).success).toBe(
        false,
      ),
  );
});
describe("verifier service", () => {
  it.each(["GREEN", "YELLOW"] as const)(
    "permits saved %s counts, including fabric above cap",
    async (color) => {
      const { service, commands } = setup(pending(color));
      await service.approve(verifier, order.id, decision);
      expect(commands.approve).toHaveBeenCalledWith(
        verifier.id,
        order.id,
        decision,
      );
    },
  );
  it.each(["RED", null] as const)(
    "blocks %s with 422 before command",
    async (color) => {
      const { service, commands } = setup(pending(color));
      await expect(
        service.approve(verifier, order.id, decision),
      ).rejects.toMatchObject({ status: 422, code: "APPROVAL_BLOCKED" });
      expect(commands.approve).not.toHaveBeenCalled();
    },
  );
  it("forbids an order creator even after role reassignment", async () => {
    const { service, commands } = setup();
    await expect(
      service.approve(
        { ...supervisor, role: "CUTTING_VERIFIER" },
        order.id,
        decision,
      ),
    ).rejects.toMatchObject({ status: 403 });
    expect(commands.approve).not.toHaveBeenCalled();
  });
  it.each(["CUTTING_SUPERVISOR", "SEWING_SUPERVISOR", "SYSTEM_ADMIN"] as const)(
    "denies %s before data reads",
    async (role) => {
      const { service, orders } = setup();
      await expect(
        service.approve({ ...verifier, role }, order.id, decision),
      ).rejects.toMatchObject({ status: 403 });
      expect(orders.find).not.toHaveBeenCalled();
    },
  );
  it("denies inactive actors, stale revisions and finalized attempts", async () => {
    await expect(
      setup().service.approve(
        { ...verifier, isActive: false },
        order.id,
        decision,
      ),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      setup().service.approve(verifier, order.id, {
        ...decision,
        expectedRevision: 1,
      }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      setup({ ...pending(), status: "VERIFIED" }).service.approve(
        verifier,
        order.id,
        decision,
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("permits physical rejection of GREEN counts and trims its reason", async () => {
    const { service, commands } = setup();
    await service.reject(verifier, order.id, {
      ...decision,
      reason: "  Torn cuff  ",
    });
    expect(commands.reject).toHaveBeenCalledWith(verifier.id, order.id, {
      ...decision,
      reason: "Torn cuff",
    });
    await expect(
      service.reject(verifier, order.id, { ...decision, reason: " \n" }),
    ).rejects.toMatchObject({ status: 422 });
  });
  it("passes only frozen component counts and forces queue pending status", async () => {
    const { service, commands, orders } = setup();
    await expect(
      service.save(verifier, order.id, {
        ...decision,
        items: [{ componentId: verifier.id, actualQty: 100 }],
      }),
    ).rejects.toMatchObject({ status: 422 });
    expect(commands.save).not.toHaveBeenCalled();
    service.queue(verifier, { limit: 25 });
    expect(orders.list).toHaveBeenCalledWith({
      limit: 25,
      status: "PENDING_VERIFICATION",
    });
  });
  it("safely translates structured SQL violations without provider details", () => {
    expect(() =>
      translateVerificationError({
        code: "P0422",
        details: JSON.stringify([
          { componentId: order.components[0]!.componentId, reason: "SHORTAGE" },
        ]),
      }),
    ).toThrow(
      expect.objectContaining({
        status: 422,
        violations: [
          { componentId: order.components[0]!.componentId, reason: "SHORTAGE" },
        ],
      }),
    );
    expect(() =>
      translateVerificationError({ code: "40001", details: "provider secret" }),
    ).toThrow(expect.objectContaining({ status: 409 }));
  });
});
