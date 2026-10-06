import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as approve } from "@/app/api/verification/[orderId]/approve/route";
import { POST as reject } from "@/app/api/verification/[orderId]/reject/route";
import { PATCH as counts } from "@/app/api/verification/[orderId]/counts/route";
import { GET as queue } from "@/app/api/verification/queue/route";
import { VerificationService } from "@/server/services/verification-service";
import { verifier, order } from "../fixtures/production";
import { pending, decision } from "../fixtures/verification";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  find: vi.fn(),
  list: vi.fn(),
  save: vi.fn(),
  approve: vi.fn(),
  reject: vi.fn(),
}));
vi.mock("@/server/auth/context", () => ({
  createAuthService: async () => ({ currentUser: mocks.currentUser }),
}));
vi.mock("@/server/production-context", () => ({
  createVerificationService: async () =>
    new VerificationService(mocks as never, mocks),
}));
const context = { params: Promise.resolve({ orderId: order.id }) };
function request(body: unknown, origin = "http://unit.test") {
  return new Request("http://unit.test/api/verification", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("APP_ORIGIN", "http://unit.test");
  mocks.currentUser.mockResolvedValue(verifier);
  mocks.find.mockResolvedValue(pending());
});
describe("assessment verification cases through route/controller/service", () => {
  it("ASMT-01: authenticated verifier approves all GREEN", async () => {
    const response = await approve(request(decision), context);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.approve).toHaveBeenCalledWith(verifier.id, order.id, decision);
  });
  it("ASMT-02: RED blocks approval with affected components", async () => {
    mocks.find.mockResolvedValue(pending("RED"));
    const response = await approve(request(decision), context);
    expect(response.status).toBe(422);
    expect((await response.json()).error.violations[0].reason).toBe("SHORTAGE");
    expect(mocks.approve).not.toHaveBeenCalled();
  });
  it("ASMT-03: rejection without meaningful reason returns 422", async () => {
    for (const reason of [undefined, "", " \n\t"])
      expect(
        (await reject(request({ ...decision, reason }), context)).status,
      ).toBe(422);
    expect(mocks.reject).not.toHaveBeenCalled();
  });
  it.each(["CUTTING_SUPERVISOR", "SEWING_SUPERVISOR", "SYSTEM_ADMIN"] as const)(
    "ASMT-04: %s receives 403 even for malformed approval",
    async (role) => {
      mocks.currentUser.mockResolvedValue({ ...verifier, role });
      expect((await approve(request({}), context)).status).toBe(403);
      expect(mocks.find).not.toHaveBeenCalled();
    },
  );
  it("permits YELLOW and rejects null or missing count", async () => {
    mocks.find.mockResolvedValue(pending("YELLOW"));
    expect((await approve(request(decision), context)).status).toBe(200);
    mocks.find.mockResolvedValue(pending(null));
    expect((await approve(request(decision), context)).status).toBe(422);
    const data = pending();
    data.attempts[0]!.items.pop();
    mocks.find.mockResolvedValue(data);
    expect((await approve(request(decision), context)).status).toBe(422);
  });
  it("rejects authority, counts and timestamp injections on decision", async () => {
    for (const key of [
      "verifierId",
      "verifiedBy",
      "decisionTimestamp",
      "status",
      "items",
    ])
      expect(
        (await approve(request({ ...decision, [key]: "forged" }), context))
          .status,
      ).toBe(422);
    expect(mocks.approve).not.toHaveBeenCalled();
  });
  it("rejects cross-origin decisions and stale values", async () => {
    expect(
      (await approve(request(decision, "https://attacker.test"), context))
        .status,
    ).toBe(403);
    expect(
      (await approve(request({ ...decision, expectedRevision: 1 }), context))
        .status,
    ).toBe(409);
  });
  it("saves explicit zero but rejects null/fraction/duplicates and unknown list filters", async () => {
    const item = {
      componentId: order.components[0]!.componentId,
      actualQty: 0,
    };
    expect(
      (await counts(request({ ...decision, items: [item] }), context)).status,
    ).toBe(200);
    for (const actualQty of [null, "0", -1, 0.5])
      expect(
        (
          await counts(
            request({ ...decision, items: [{ ...item, actualQty }] }),
            context,
          )
        ).status,
      ).toBe(422);
    expect(
      (await counts(request({ ...decision, items: [item, item] }), context))
        .status,
    ).toBe(422);
    expect(
      (
        await queue(
          new Request(
            "http://unit.test/api/verification/queue?status=VERIFIED",
          ),
        )
      ).status,
    ).toBe(422);
  });
});
