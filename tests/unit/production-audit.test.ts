import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.generated";
import {
  compareProductionEvents,
  productionAuditCursorSchema,
  productionAuditListSchema,
  productionCursorFilter,
  type ProductionAuditCursor,
} from "@/modules/admin/production-audit";
import { SupabaseProductionAuditRepository } from "@/server/repositories/production-audit-repository";
import { ProductionAuditService } from "@/server/services/production-audit-service";
import { sewingActor } from "../fixtures/sewing";
vi.mock("server-only", () => ({}));
const id = "93000000-0000-4000-8000-000000000003";
const time = "2026-10-07T03:00:00.123456+00:00";
const cursor: ProductionAuditCursor = { time, source: "SUBMISSION", id };
describe("production audit pagination", () => {
  it("orders microseconds, source ties, UUID ties and timezone equivalents consistently", () => {
    const sameInstant = { ...cursor, time: "2026-10-07T08:30:00.123456+05:30" };
    expect(compareProductionEvents(cursor, sameInstant)).toBe(0);
    const entries: ProductionAuditCursor[] = [
      {
        ...cursor,
        time: "2026-10-07T03:00:00.123455Z",
        source: "VERIFICATION",
      },
      { ...cursor, source: "ORDER" },
      cursor,
      { ...cursor, source: "VERIFICATION" },
      { ...cursor, id: "93000000-0000-4000-8000-000000000004" },
    ];
    const sorted = entries.sort(compareProductionEvents);
    expect(sorted.map((e) => `${e.source}:${e.id.slice(-1)}`)).toEqual([
      "VERIFICATION:3",
      "SUBMISSION:4",
      "SUBMISSION:3",
      "ORDER:3",
      "VERIFICATION:3",
    ]);
    expect(productionCursorFilter("VERIFICATION", "created_at", cursor)).toBe(
      `created_at.lt.${time}`,
    );
    expect(productionCursorFilter("SEWING", "sewing_started_at", cursor)).toBe(
      `sewing_started_at.lte.${time}`,
    );
    expect(
      productionCursorFilter("SUBMISSION", "submitted_at", cursor),
    ).toContain(`and(submitted_at.eq.${time},id.lt.${id})`);
  });
  it("accepts only bounded audit queries and exact cursor fields", () => {
    expect(productionAuditListSchema.parse({})).toEqual({ limit: 20 });
    for (const value of [
      { limit: "101" },
      { actorId: id },
      { status: "VERIFIED" },
      { cursor: "x,y" },
    ])
      expect(productionAuditListSchema.safeParse(value).success).toBe(false);
    for (const value of [
      { ...cursor, time: "2026-10-07T03:00:00.1234567Z" },
      { ...cursor, id: "forged" },
      { ...cursor, source: "EDIT" },
      { ...cursor, actorId: id },
    ])
      expect(productionAuditCursorSchema.safeParse(value).success).toBe(false);
  });
});
describe("read-only production audit authority", () => {
  it.each([
    "CUTTING_SUPERVISOR",
    "CUTTING_VERIFIER",
    "SEWING_SUPERVISOR",
  ] as const)("denies %s before reading", async (role) => {
    const repository = { list: vi.fn() };
    const service = new ProductionAuditService(repository);
    await expect(async () =>
      service.list({ ...sewingActor, role }, { limit: 20 }),
    ).rejects.toMatchObject({ status: 403 });
    expect(repository.list).not.toHaveBeenCalled();
  });
  it("denies inactive admins and passes only the authenticated admin ID", async () => {
    const repository = {
      list: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    };
    const service = new ProductionAuditService(repository);
    const admin = { ...sewingActor, role: "SYSTEM_ADMIN" as const };
    await expect(async () =>
      service.list({ ...admin, isActive: false }, { limit: 20 }),
    ).rejects.toMatchObject({ status: 403 });
    await service.list(admin, { limit: 20 });
    expect(repository.list).toHaveBeenCalledExactlyOnceWith(admin.id, {
      limit: 20,
    });
  });
  it("rechecks current admin activity before elevated reads, fails closed and never writes", async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    const read = { from: vi.fn().mockReturnValue(query) };
    const repository = new SupabaseProductionAuditRepository(
      read as unknown as SupabaseClient<Database>,
    );
    await expect(repository.list(id, { limit: 20 })).rejects.toMatchObject({
      status: 403,
    });
    expect(read.from).toHaveBeenCalledExactlyOnceWith("profiles");
    expect(query.eq.mock.calls).toContainEqual(["role", "system_admin"]);
    expect(query.eq.mock.calls).toContainEqual(["is_active", true]);
    query.maybeSingle.mockResolvedValue({
      data: null,
      error: { message: "private provider detail" },
    } as never);
    await expect(repository.list(id, { limit: 20 })).rejects.toMatchObject({
      status: 503,
    });
  });
});
