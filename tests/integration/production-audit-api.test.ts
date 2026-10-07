import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/admin/production-audit/route";
import { ProductionAuditService } from "@/server/services/production-audit-service";
import { sewingActor } from "../fixtures/sewing";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ currentUser: vi.fn(), list: vi.fn() }));
vi.mock("@/server/auth/context", () => ({
  createAuthService: async () => ({ currentUser: mocks.currentUser }),
}));
vi.mock("@/server/production-audit-context", () => ({
  createProductionAuditService: () => new ProductionAuditService(mocks),
}));
beforeEach(() => {
  vi.resetAllMocks();
  mocks.currentUser.mockResolvedValue({ ...sewingActor, role: "SYSTEM_ADMIN" });
  mocks.list.mockResolvedValue({ items: [], nextCursor: null });
});
describe("production audit API", () => {
  it("returns a private, no-store read projection", async () => {
    const response = await GET(
      new Request("http://unit.test/api/admin/production-audit"),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect((await response.json()).data).toEqual({
      items: [],
      nextCursor: null,
    });
    expect(mocks.list).toHaveBeenCalledExactlyOnceWith(sewingActor.id, {
      limit: 20,
    });
  });
  it.each([
    null,
    { ...sewingActor, role: "SYSTEM_ADMIN", isActive: false },
    sewingActor,
  ])("rejects missing/inactive/wrong-role identity", async (actor) => {
    mocks.currentUser.mockResolvedValue(actor);
    expect((await GET(new Request("http://unit.test"))).status).toBe(
      actor ? 403 : 401,
    );
    expect(mocks.list).not.toHaveBeenCalled();
  });
  it("rejects duplicate, unbounded and protected query parameters", async () => {
    for (const query of [
      "cursor=x&cursor=y",
      "actorId=forged",
      "limit=101",
      "status=VERIFIED",
      "cursor=x,y",
    ])
      expect((await GET(new Request(`http://unit.test?${query}`))).status).toBe(
        query.includes("&") ? 400 : 422,
      );
    expect(mocks.list).not.toHaveBeenCalled();
  });
});
