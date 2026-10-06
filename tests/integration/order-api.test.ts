import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/orders/route";
import { PATCH } from "@/app/api/orders/[id]/route";
import { POST as submit } from "@/app/api/orders/[id]/submit/route";
import { supervisor, order, recipe } from "../fixtures/production";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  edit: vi.fn(),
  submit: vi.fn(),
  recut: vi.fn(),
}));
vi.mock("@/server/auth/context", () => ({
  createAuthService: async () => ({ currentUser: mocks.currentUser }),
}));
vi.mock("@/server/production-context", () => ({
  createOrderService: async () => mocks,
}));
function request(body?: unknown, query = "") {
  return new Request(`http://unit.test/api/orders${query}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { origin: "http://unit.test", "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("APP_ORIGIN", "http://unit.test");
  mocks.currentUser.mockResolvedValue(supervisor);
  mocks.create.mockResolvedValue(order);
  mocks.list.mockResolvedValue({ items: [order], nextCursor: null });
});
describe("cutting API boundary", () => {
  it.each(["CUTTING_VERIFIER", "SEWING_SUPERVISOR", "SYSTEM_ADMIN"] as const)(
    "returns 403 for %s before malformed input",
    async (role) => {
      mocks.currentUser.mockResolvedValue({ ...supervisor, role });
      expect((await POST(request({}))).status).toBe(403);
      expect((await GET(request())).status).toBe(403);
      expect(
        (
          await PATCH(request({}), {
            params: Promise.resolve({ id: order.id }),
          })
        ).status,
      ).toBe(403);
      expect(
        (
          await submit(request({}), {
            params: Promise.resolve({ id: order.id }),
          })
        ).status,
      ).toBe(403);
    },
  );
  it("returns created order with private headers", async () => {
    const response = await POST(
      request({
        recipeId: recipe.id,
        targetQty: 50,
        fabricRollId: " ROLL ",
        actualFabricYards: 94.5,
      }),
    );
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.create).toHaveBeenCalledWith(supervisor, {
      recipeId: recipe.id,
      targetQty: 50,
      fabricRollId: "ROLL",
      actualFabricYards: 94.5,
    });
  });
  it("rejects derived counts/actor injection and invalid fabric", async () => {
    for (const extra of [
      { expectedQty: 100 },
      { creatorId: supervisor.id },
      { status: "VERIFIED" },
      { actualFabricYards: 1.1234 },
    ])
      expect(
        (
          await POST(
            request({
              recipeId: recipe.id,
              targetQty: 50,
              fabricRollId: "ROLL",
              actualFabricYards: 94.5,
              ...extra,
            }),
          )
        ).status,
      ).toBe(422);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("rejects arbitrary status mutation and unknown list filters", async () => {
    expect(
      (
        await PATCH(request({ expectedRevision: 0, status: "VERIFIED" }), {
          params: Promise.resolve({ id: order.id }),
        })
      ).status,
    ).toBe(422);
    expect(
      (await GET(request(undefined, "?includeUnverified=true"))).status,
    ).toBe(422);
  });
});
