import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.generated";
import { sewingListSchema, startSewingSchema } from "@/modules/sewing/schemas";
import { SewingService } from "@/server/services/sewing-service";
import { SupabaseSewingRepository } from "@/server/repositories/sewing-repository";
import { sewing, sewingActor } from "../fixtures/sewing";
vi.mock("server-only", () => ({}));
function setup() {
  const repository = {
    list: vi.fn().mockResolvedValue({ items: [sewing], nextCursor: null }),
    find: vi.fn().mockResolvedValue(sewing),
    start: vi.fn(),
  };
  return { repository, service: new SewingService(repository) };
}
describe("verified-only sewing", () => {
  it.each(["CUTTING_SUPERVISOR", "CUTTING_VERIFIER", "SYSTEM_ADMIN"] as const)(
    "denies %s before reads/commands",
    async (role) => {
      const { service, repository } = setup();
      for (const action of [
        () => service.queue({ ...sewingActor, role }, { limit: 20 }),
        () => service.detail({ ...sewingActor, role }, sewing.id),
        () => service.start({ ...sewingActor, role }, sewing.id, 3),
      ])
        await expect(async () => action()).rejects.toMatchObject({
          status: 403,
        });
      expect(repository.find).not.toHaveBeenCalled();
      expect(repository.list).not.toHaveBeenCalled();
      expect(repository.start).not.toHaveBeenCalled();
    },
  );
  it("denies inactive user and unapproved resource", async () => {
    const { service, repository } = setup();
    await expect(
      service.detail({ ...sewingActor, isActive: false }, sewing.id),
    ).rejects.toMatchObject({ status: 403 });
    repository.find.mockResolvedValue(null);
    await expect(service.detail(sewingActor, sewing.id)).rejects.toMatchObject({
      status: 404,
    });
  });
  it("passes server actor with revision and returns committed start", async () => {
    const { service, repository } = setup();
    repository.find.mockResolvedValueOnce(sewing).mockResolvedValue({
      ...sewing,
      sewingStartedAt: sewing.createdAt,
      startedBy: sewingActor.id,
      revision: 4,
    });
    expect(await service.start(sewingActor, sewing.id, 3)).toMatchObject({
      status: "VERIFIED",
      startedBy: sewingActor.id,
      revision: 4,
    });
    expect(repository.start).toHaveBeenCalledWith(sewingActor.id, sewing.id, 3);
  });
  it("conflicts on stale/repeated start", async () => {
    const { service, repository } = setup();
    await expect(
      service.start(sewingActor, sewing.id, 2),
    ).rejects.toMatchObject({ status: 409 });
    repository.find.mockResolvedValue({
      ...sewing,
      sewingStartedAt: sewing.createdAt,
    });
    await expect(
      service.start(sewingActor, sewing.id, 3),
    ).rejects.toMatchObject({ status: 409 });
    expect(repository.start).not.toHaveBeenCalled();
  });
  it.each([
    "status",
    "includeUnapproved",
    "actorId",
    "startedBy",
    "sewingStartedAt",
  ])("rejects protected %s", (key) => {
    expect(sewingListSchema.safeParse({ [key]: "forged" }).success).toBe(false);
    expect(
      startSewingSchema.safeParse({ expectedRevision: 3, [key]: "forged" })
        .success,
    ).toBe(false);
  });
  it("ASMT-05: repository always fixes VERIFIED despite injected status", async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    const read = { from: vi.fn().mockReturnValue(query) };
    await new SupabaseSewingRepository(
      read as unknown as SupabaseClient<Database>,
      {} as SupabaseClient<Database>,
    ).list({ limit: 20, status: "PENDING_VERIFICATION" } as never);
    expect(read.from).toHaveBeenCalledWith("sewing_batches");
    expect(query.eq).toHaveBeenCalledExactlyOnceWith("status", "VERIFIED");
  });
});
