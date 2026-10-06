import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as queue } from "@/app/api/sewing/queue/route";
import { GET as detail } from "@/app/api/sewing/[id]/route";
import { POST as start } from "@/app/api/sewing/[id]/start/route";
import { SewingService } from "@/server/services/sewing-service";
import { sewing, sewingActor } from "../fixtures/sewing";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  find: vi.fn(),
  list: vi.fn(),
  start: vi.fn(),
}));
vi.mock("@/server/auth/context", () => ({
  createAuthService: async () => ({ currentUser: mocks.currentUser }),
}));
vi.mock("@/server/production-context", () => ({
  createSewingService: async () => new SewingService(mocks),
}));
const context = { params: Promise.resolve({ id: sewing.id }) };
function request(body: unknown, origin = "http://unit.test") {
  return new Request("http://unit.test/api/sewing", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("APP_ORIGIN", "http://unit.test");
  mocks.currentUser.mockResolvedValue(sewingActor);
  mocks.find.mockResolvedValue(sewing);
  mocks.list.mockResolvedValue({ items: [sewing], nextCursor: null });
});
describe("sewing API boundary", () => {
  it("ASMT-05: only VERIFIED queue and strict filters", async () => {
    const response = await queue(
      new Request("http://unit.test/api/sewing/queue"),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).data.items[0].status).toBe("VERIFIED");
    expect(response.headers.get("cache-control")).toContain("no-store");
    for (const param of [
      "status=PENDING_VERIFICATION",
      "status=REJECTED",
      "includeUnapproved=true",
      "limit=0",
      "cursor=x&cursor=y",
    ])
      expect(
        (await queue(new Request(`http://unit.test/api/sewing/queue?${param}`)))
          .status,
      ).toBe(param.startsWith("cursor") ? 400 : 422);
  });
  it.each(["CUTTING_SUPERVISOR", "CUTTING_VERIFIER", "SYSTEM_ADMIN"] as const)(
    "%s has no queue/detail/start authority",
    async (role) => {
      mocks.currentUser.mockResolvedValue({ ...sewingActor, role });
      expect((await queue(new Request("http://unit.test"))).status).toBe(403);
      expect(
        (await detail(new Request("http://unit.test"), context)).status,
      ).toBe(403);
      expect((await start(request({}), context)).status).toBe(403);
      expect(mocks.find).not.toHaveBeenCalled();
    },
  );
  it("never accepts actor, status or timestamp; origin is required", async () => {
    for (const key of [
      "role",
      "status",
      "startedBy",
      "actorId",
      "sewingStartedAt",
    ])
      expect(
        (
          await start(
            request({ expectedRevision: 3, [key]: "forged" }),
            context,
          )
        ).status,
      ).toBe(422);
    expect(
      (
        await start(
          request({ expectedRevision: 3 }, "https://attacker.test"),
          context,
        )
      ).status,
    ).toBe(403);
    expect(mocks.start).not.toHaveBeenCalled();
  });
  it("records authoritative actor and conflicts on repeated/stale start", async () => {
    expect(
      (await start(request({ expectedRevision: 3 }), context)).status,
    ).toBe(200);
    expect(mocks.start).toHaveBeenCalledWith(sewingActor.id, sewing.id, 3);
    expect(
      (await start(request({ expectedRevision: 2 }), context)).status,
    ).toBe(409);
    mocks.find.mockResolvedValue({
      ...sewing,
      sewingStartedAt: sewing.createdAt,
    });
    expect(
      (await start(request({ expectedRevision: 3 }), context)).status,
    ).toBe(409);
  });
  it("invisible/unapproved IDs return 404, inactive current users fail closed", async () => {
    mocks.find.mockResolvedValue(null);
    expect(
      (await detail(new Request("http://unit.test"), context)).status,
    ).toBe(404);
    mocks.currentUser.mockResolvedValue({ ...sewingActor, isActive: false });
    expect(
      (await start(request({ expectedRevision: 3 }), context)).status,
    ).toBe(403);
  });
});
