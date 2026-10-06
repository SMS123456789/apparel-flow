import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "@/modules/identity/types";
import { AuthenticationError, AuthorizationError } from "@/server/http/errors";
import { apiResponse } from "@/server/http/request";
import { GET as list, POST as create } from "@/app/api/admin/users/route";
import { PATCH as role } from "@/app/api/admin/users/[id]/role/route";
import { PATCH as status } from "@/app/api/admin/users/[id]/status/route";
import { GET as audit } from "@/app/api/admin/audit/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { GET as me } from "@/app/api/auth/me/route";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  changeRole: vi.fn(),
  changeStatus: vi.fn(),
  audit: vi.fn(),
}));
vi.mock("@/server/auth/context", () => ({
  createAuthService: async () => ({
    currentUser: mocks.currentUser,
    login: mocks.login,
    logout: mocks.logout,
  }),
  createAdminUserService: () => ({
    list: mocks.list,
    create: mocks.create,
    changeRole: mocks.changeRole,
    changeStatus: mocks.changeStatus,
    audit: mocks.audit,
  }),
}));
const actor: AuthenticatedUser = {
  id: "a3000000-0000-4000-8000-000000000001",
  email: "admin@unit.test",
  fullName: "API Admin",
  role: "SYSTEM_ADMIN",
  isActive: true,
};
function request(method = "GET", body?: unknown, origin = "http://unit.test") {
  return new Request("http://unit.test/api/admin/users", {
    method,
    headers: { origin, "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("APP_ORIGIN", "http://unit.test");
  mocks.currentUser.mockResolvedValue(actor);
  mocks.login.mockResolvedValue(actor);
  mocks.logout.mockResolvedValue(undefined);
  mocks.list.mockResolvedValue({ items: [], nextCursor: null });
  mocks.create.mockResolvedValue(actor);
  mocks.audit.mockResolvedValue({ items: [], nextCursor: null });
});
describe("HTTP authorization independently of page redirects", () => {
  it("denies unauthenticated API requests with 401", async () => {
    mocks.currentUser.mockRejectedValue(new AuthenticationError());
    expect((await list(request())).status).toBe(401);
    expect(mocks.list).not.toHaveBeenCalled();
  });
  it.each([
    "CUTTING_SUPERVISOR",
    "CUTTING_VERIFIER",
    "SEWING_SUPERVISOR",
  ] as const)(
    "denies all admin endpoints for %s before payload validation",
    async (roleName) => {
      mocks.currentUser.mockResolvedValue({ ...actor, role: roleName });
      const context = { params: Promise.resolve({ id: actor.id }) };
      const responses = await Promise.all([
        list(request()),
        create(request("POST", {})),
        role(request("PATCH", {}), context),
        status(request("PATCH", {}), context),
        audit(request()),
      ]);
      expect(responses.map((response) => response.status)).toEqual([
        403, 403, 403, 403, 403,
      ]);
      expect(mocks.create).not.toHaveBeenCalled();
      expect(mocks.list).not.toHaveBeenCalled();
      expect(mocks.changeRole).not.toHaveBeenCalled();
    },
  );
  it("denies inactive admin identity", async () => {
    mocks.currentUser.mockResolvedValue({ ...actor, isActive: false });
    expect((await list(request())).status).toBe(403);
  });
  it("allows admin listing with private cache headers", async () => {
    const response = await list(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toMatchObject({
      data: { items: [], nextCursor: null },
      meta: { requestId: expect.any(String) },
    });
    expect(mocks.list).toHaveBeenCalledWith(actor, { limit: 20 });
  });
  it("rejects invalid role or injected actor fields with 422", async () => {
    const body = {
      email: "user@unit.test",
      fullName: "User",
      role: "SYSTEM_ADMIN",
      temporaryPassword: "unit-password",
    };
    expect((await create(request("POST", body))).status).toBe(422);
    expect(
      (
        await create(
          request("POST", {
            ...body,
            role: "CUTTING_VERIFIER",
            actorId: actor.id,
          }),
        )
      ).status,
    ).toBe(422);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("creates only through the service with a server-generated audit identity", async () => {
    const response = await create(
      request("POST", {
        email: "user@unit.test",
        fullName: "User",
        role: "CUTTING_VERIFIER",
        temporaryPassword: "unit-password",
      }),
    );
    expect(response.status).toBe(201);
    expect(mocks.create.mock.calls[0]?.[0]).toEqual(actor);
    expect(mocks.create.mock.calls[0]?.[2]).toMatch(/^[\da-f-]{36}$/);
  });
  it("rejects cross-origin and missing-origin mutations", async () => {
    const body = {
      email: "user@unit.test",
      fullName: "User",
      role: "CUTTING_VERIFIER",
      temporaryPassword: "unit-password",
    };
    expect(
      (await create(request("POST", body, "https://attacker.test"))).status,
    ).toBe(403);
    const missing = request("POST", body);
    missing.headers.delete("origin");
    expect((await create(missing)).status).toBe(403);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("sanitizes unexpected failures and their logs", async () => {
    const logger = vi.spyOn(console, "error").mockImplementation(() => {});
    const secret = "unit-provider-credential-must-not-leak";
    const response = await apiResponse(async () => {
      throw new Error(secret);
    });
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain(secret);
    expect(JSON.stringify(logger.mock.calls)).not.toContain(secret);
    expect(logger).toHaveBeenCalled();
  });
  it("preserves controlled 403 errors without stack traces", async () => {
    const response = await apiResponse(async () => {
      throw new AuthorizationError();
    });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: { code: "FORBIDDEN" },
    });
  });
});
describe("auth HTTP contract", () => {
  it("accepts only credentials on login and returns the canonical role destination", async () => {
    const response = await login(
      request("POST", { email: "ADMIN@unit.test", password: "unit-password" }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: { user: actor, redirectTo: "/admin" },
    });
    expect(mocks.login).toHaveBeenCalledWith({
      email: "admin@unit.test",
      password: "unit-password",
    });
  });
  it("rejects login authority injection", async () => {
    expect(
      (
        await login(
          request("POST", {
            email: actor.email,
            password: "unit-password",
            role: "SYSTEM_ADMIN",
          }),
        )
      ).status,
    ).toBe(422);
    expect(mocks.login).not.toHaveBeenCalled();
  });
  it("maps invalid credentials to 401", async () => {
    mocks.login.mockRejectedValue(new AuthenticationError());
    expect(
      (await login(request("POST", { email: actor.email, password: "wrong" })))
        .status,
    ).toBe(401);
  });
  it("returns the fresh current identity", async () => {
    const response = await me();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: actor });
  });
  it("returns 401 for no identity", async () => {
    mocks.currentUser.mockRejectedValue(new AuthenticationError());
    expect((await me()).status).toBe(401);
  });
  it("signs out through the service", async () => {
    expect((await logout(request("POST"))).status).toBe(200);
    expect(mocks.logout).toHaveBeenCalledOnce();
  });
  it("rejects malformed JSON with a controlled 400", async () => {
    const bad = new Request("http://unit.test/api/auth/login", {
      method: "POST",
      headers: {
        origin: "http://unit.test",
        "content-type": "application/json",
      },
      body: "{",
    });
    expect((await login(bad)).status).toBe(400);
    expect(mocks.login).not.toHaveBeenCalled();
  });
});
