import { describe, expect, it, vi } from "vitest";
import { AdminUserService } from "@/server/services/admin-user-service";
import {
  createUserSchema,
  changeRoleSchema,
  changeStatusSchema,
} from "@/modules/admin/schemas";
import { translateDatabaseError } from "@/server/repositories/admin-user-repository";
import type { AuthAdminRepository } from "@/server/repositories/auth-repository";
import type { AdminUserRepository } from "@/server/repositories/admin-user-repository";
import type { AuthenticatedUser } from "@/modules/identity/types";
import { ConflictError, ExternalServiceError } from "@/server/http/errors";
vi.mock("server-only", () => ({}));
const actor: AuthenticatedUser = {
  id: "a2000000-0000-4000-8000-000000000001",
  email: "admin@unit.test",
  fullName: "Unit Admin",
  role: "SYSTEM_ADMIN",
  isActive: true,
};
const target = {
  ...actor,
  id: "a2000000-0000-4000-8000-000000000002",
  email: "production@unit.test",
  fullName: "Unit Production",
  role: "CUTTING_SUPERVISOR" as const,
  revision: 0,
  createdAt: "2026-10-06T00:00:00Z",
  updatedAt: "2026-10-06T00:00:00Z",
};
const input = {
  email: target.email,
  fullName: target.fullName,
  role: target.role,
  temporaryPassword: "private-unit-only-password",
};
const requestId = "a2000000-0000-4000-8000-000000000003";
function setup() {
  const auth = {
    createUser: vi
      .fn<AuthAdminRepository["createUser"]>()
      .mockResolvedValue({ id: target.id, email: target.email }),
    deleteIncompleteUser: vi
      .fn<AuthAdminRepository["deleteIncompleteUser"]>()
      .mockResolvedValue(undefined),
  };
  const users = {
    list: vi
      .fn<AdminUserRepository["list"]>()
      .mockResolvedValue({ items: [target], nextCursor: null }),
    audit: vi
      .fn<AdminUserRepository["audit"]>()
      .mockResolvedValue({ items: [], nextCursor: null }),
    createProfile: vi
      .fn<AdminUserRepository["createProfile"]>()
      .mockResolvedValue(target),
    findProfile: vi
      .fn<AdminUserRepository["findProfile"]>()
      .mockResolvedValue(target),
    update: vi
      .fn<AdminUserRepository["update"]>()
      .mockResolvedValue({ ...target, revision: 1 }),
  };
  return { auth, users, service: new AdminUserService(auth, users) };
}
describe("admin input boundaries", () => {
  it.each(["SYSTEM_ADMIN", "OWNER", "cutting_supervisor", null])(
    "does not accept an unapproved target role",
    (role) => {
      expect(createUserSchema.safeParse({ ...input, role }).success).toBe(
        false,
      );
      expect(
        changeRoleSchema.safeParse({ expectedRevision: 0, role }).success,
      ).toBe(false);
    },
  );
  it("rejects actor identity, malformed revisions and nonboolean activity", () => {
    expect(
      createUserSchema.safeParse({ ...input, actorId: actor.id }).success,
    ).toBe(false);
    expect(
      changeRoleSchema.safeParse({ expectedRevision: "0", role: target.role })
        .success,
    ).toBe(false);
    expect(
      changeStatusSchema.safeParse({ expectedRevision: 0, isActive: "false" })
        .success,
    ).toBe(false);
  });
  it("trims names and normalizes emails", () => {
    expect(
      createUserSchema.parse({
        ...input,
        fullName: "  Name  ",
        email: "USER@unit.test",
      }),
    ).toMatchObject({ fullName: "Name", email: "user@unit.test" });
  });
});
describe("admin operations", () => {
  it("lists users only as an active admin", async () => {
    const { service, users } = setup();
    expect(await service.list(actor, { limit: 20 })).toEqual({
      items: [target],
      nextCursor: null,
    });
    expect(users.list).toHaveBeenCalledWith(actor.id, { limit: 20 });
  });
  it.each([
    "CUTTING_SUPERVISOR",
    "CUTTING_VERIFIER",
    "SEWING_SUPERVISOR",
  ] as const)("denies every admin operation for %s", async (role) => {
    const { service, auth, users } = setup();
    const wrong = { ...actor, role };
    await expect(service.create(wrong, input, requestId)).rejects.toMatchObject(
      { status: 403 },
    );
    expect(() => service.list(wrong, { limit: 20 })).toThrow();
    expect(() => service.audit(wrong, { limit: 20 })).toThrow();
    await expect(
      service.changeRole(
        wrong,
        target.id,
        { expectedRevision: 0, role: "CUTTING_VERIFIER" },
        requestId,
      ),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.changeStatus(
        wrong,
        target.id,
        { expectedRevision: 0, isActive: false },
        requestId,
      ),
    ).rejects.toMatchObject({ status: 403 });
    expect(auth.createUser).not.toHaveBeenCalled();
    expect(users.findProfile).not.toHaveBeenCalled();
  });
  it("denies inactive admin", async () => {
    const { service, auth } = setup();
    await expect(
      service.create({ ...actor, isActive: false }, input, requestId),
    ).rejects.toMatchObject({ status: 403 });
    expect(auth.createUser).not.toHaveBeenCalled();
  });
  it("creates Auth before atomic profile/audit persistence and returns no password", async () => {
    const { service, auth, users } = setup();
    const result = await service.create(actor, input, requestId);
    expect(auth.createUser).toHaveBeenCalledWith(
      target.email,
      input.temporaryPassword,
    );
    expect(users.createProfile).toHaveBeenCalledWith(
      actor.id,
      target.id,
      target.fullName,
      target.role,
      requestId,
    );
    expect(auth.createUser.mock.invocationCallOrder[0]).toBeLessThan(
      users.createProfile.mock.invocationCallOrder[0]!,
    );
    expect(JSON.stringify(result)).not.toContain(input.temporaryPassword);
    expect(auth.deleteIncompleteUser).not.toHaveBeenCalled();
  });
  it("attempts cleanup of only the newly created incomplete identity", async () => {
    const { service, auth, users } = setup();
    users.createProfile.mockRejectedValue(new ExternalServiceError());
    users.findProfile.mockResolvedValue(null);
    await expect(service.create(actor, input, requestId)).rejects.toMatchObject(
      { status: 500, code: "PROFILE_CREATION_FAILED" },
    );
    expect(auth.deleteIncompleteUser).toHaveBeenCalledWith(target.id);
  });
  it("reports cleanup failure without false success", async () => {
    const { service, auth, users } = setup();
    users.createProfile.mockRejectedValue(new ExternalServiceError());
    users.findProfile.mockResolvedValue(null);
    auth.deleteIncompleteUser.mockRejectedValue(new ExternalServiceError());
    await expect(service.create(actor, input, requestId)).rejects.toMatchObject(
      { code: "USER_CLEANUP_FAILED" },
    );
  });
  it("never removes a persisted profile after an uncertain response", async () => {
    const { service, auth, users } = setup();
    users.createProfile.mockRejectedValue(new ExternalServiceError());
    await expect(service.create(actor, input, requestId)).rejects.toMatchObject(
      { code: "PROVISIONING_OUTCOME_UNCERTAIN" },
    );
    expect(auth.deleteIncompleteUser).not.toHaveBeenCalled();
  });
  it("does not clean up when persistence cannot be determined", async () => {
    const { service, auth, users } = setup();
    users.createProfile.mockRejectedValue(new ExternalServiceError());
    users.findProfile.mockRejectedValue(new ExternalServiceError());
    await expect(service.create(actor, input, requestId)).rejects.toMatchObject(
      { code: "PROVISIONING_OUTCOME_UNCERTAIN" },
    );
    expect(auth.deleteIncompleteUser).not.toHaveBeenCalled();
  });
  it("does not clean up an existing duplicate email", async () => {
    const { service, auth, users } = setup();
    auth.createUser.mockRejectedValue(new ConflictError());
    await expect(service.create(actor, input, requestId)).rejects.toMatchObject(
      { status: 409 },
    );
    expect(users.createProfile).not.toHaveBeenCalled();
    expect(auth.deleteIncompleteUser).not.toHaveBeenCalled();
  });
  it("blocks admin self-status and self-role changes before lookup", async () => {
    const { service, users } = setup();
    await expect(
      service.changeStatus(
        actor,
        actor.id,
        { expectedRevision: 0, isActive: false },
        requestId,
      ),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.changeRole(
        actor,
        actor.id,
        { expectedRevision: 0, role: target.role },
        requestId,
      ),
    ).rejects.toMatchObject({ status: 403 });
    expect(users.update).not.toHaveBeenCalled();
    expect(users.findProfile).not.toHaveBeenCalled();
  });
  it("prevents demoting another protected administrator", async () => {
    const { service, users } = setup();
    users.findProfile.mockResolvedValue({ ...target, role: "SYSTEM_ADMIN" });
    await expect(
      service.changeRole(
        actor,
        target.id,
        { expectedRevision: 0, role: target.role },
        requestId,
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("passes the server actor, revision, change and audit request ID to one command", async () => {
    const { service, users } = setup();
    await service.changeRole(
      actor,
      target.id,
      { expectedRevision: 0, role: "CUTTING_VERIFIER" },
      requestId,
    );
    expect(users.update).toHaveBeenCalledWith(
      actor.id,
      target.id,
      0,
      { role: "CUTTING_VERIFIER" },
      requestId,
    );
    await service.changeStatus(
      actor,
      target.id,
      { expectedRevision: 0, isActive: false },
      requestId,
    );
    expect(users.update).toHaveBeenLastCalledWith(
      actor.id,
      target.id,
      0,
      { isActive: false },
      requestId,
    );
  });
  it.each([
    ["42501", 403],
    ["P0002", 404],
    ["40001", 409],
    ["23505", 409],
    ["23514", 422],
    ["22023", 422],
    ["unknown", 503],
  ])("maps DB status %s without raw SQL details", (code, status) => {
    try {
      translateDatabaseError({ code: String(code) });
    } catch (error) {
      expect(error).toMatchObject({ status });
    }
  });
});
