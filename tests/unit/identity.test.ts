import { beforeEach, describe, expect, it, vi } from "vitest";
import { loginSchema, demoLoginSchema } from "@/modules/identity/schemas";
import { roles, type AuthenticatedUser } from "@/modules/identity/types";
import { requireRole, requireUser } from "@/server/auth/guards";
import { AuthService } from "@/server/services/auth-service";
import { AuthenticationError, AuthorizationError } from "@/server/http/errors";
import type { AuthRepository } from "@/server/repositories/auth-repository";
import type { ProfileRepository } from "@/server/repositories/profile-repository";
vi.mock("server-only", () => ({}));
const user: AuthenticatedUser = {
  id: "a1000000-0000-4000-8000-000000000001",
  email: "identity@unit.test",
  fullName: "Identity Test",
  role: "CUTTING_SUPERVISOR",
  isActive: true,
};
function setup() {
  const auth = {
    signIn: vi
      .fn<AuthRepository["signIn"]>()
      .mockResolvedValue({ id: user.id, email: user.email }),
    currentIdentity: vi
      .fn<AuthRepository["currentIdentity"]>()
      .mockResolvedValue({ id: user.id, email: user.email }),
    signOut: vi.fn<AuthRepository["signOut"]>().mockResolvedValue(undefined),
  };
  const profiles = {
    findOwn: vi.fn<ProfileRepository["findOwn"]>().mockResolvedValue(user),
  };
  return { auth, profiles, service: new AuthService(auth, profiles) };
}
beforeEach(() => vi.stubEnv("DEMO_ACCOUNTS_ENABLED", "false"));
describe("login validation", () => {
  it.each([
    {},
    null,
    { email: "bad", password: "password" },
    { email: "unit@unit.test", password: "" },
    { email: "unit@unit.test", password: "a".repeat(129) },
    { email: "unit@unit.test", password: "password", role: "SYSTEM_ADMIN" },
    { email: "unit@unit.test", password: "password", userId: user.id },
    { email: "unit@unit.test", password: "password", isActive: true },
  ])("rejects invalid or authoritative fields", (input) => {
    expect(loginSchema.safeParse(input).success).toBe(false);
  });
  it("normalizes email without transforming passwords", () => {
    expect(
      loginSchema.parse({
        email: "IDENTITY@unit.test",
        password: " untouched ",
      }),
    ).toEqual({ email: "identity@unit.test", password: " untouched " });
  });
  it("limits demo selection to three real-account identifiers", () => {
    expect(demoLoginSchema.safeParse({ persona: "system-admin" }).success).toBe(
      false,
    );
    expect(
      demoLoginSchema.safeParse({
        persona: "cutting-verifier",
        role: "SYSTEM_ADMIN",
      }).success,
    ).toBe(false);
  });
});
describe("nonhierarchical authorization", () => {
  for (const role of roles)
    for (const allowed of roles)
      it(`${role} ${role === allowed ? "can" : "cannot"} act as ${allowed}`, () => {
        const actor = { ...user, role };
        if (role === allowed) expect(requireRole(actor, allowed)).toBe(actor);
        else
          expect(() => requireRole(actor, allowed)).toThrow(AuthorizationError);
      });
  it("returns 401 for no identity and 403 for inactive identity", () => {
    expect(() => requireUser(null)).toThrow(AuthenticationError);
    expect(() => requireRole({ ...user, isActive: false }, user.role)).toThrow(
      AuthorizationError,
    );
  });
});
describe("canonical application identity", () => {
  it("combines confirmed Auth identity with the fresh profile role", async () => {
    const { service, profiles } = setup();
    profiles.findOwn.mockResolvedValue({ ...user, role: "CUTTING_VERIFIER" });
    expect(await service.currentUser()).toEqual({
      ...user,
      role: "CUTTING_VERIFIER",
    });
    expect(profiles.findOwn).toHaveBeenCalledWith(user.id);
  });
  it("requires a confirmed identity", async () => {
    const { service, auth, profiles } = setup();
    auth.currentIdentity.mockResolvedValue(null);
    await expect(service.currentUser()).rejects.toMatchObject({ status: 401 });
    expect(profiles.findOwn).not.toHaveBeenCalled();
  });
  it.each([
    null,
    { ...user, isActive: false },
    { ...user, id: "wrong-subject" },
  ])(
    "fails closed for missing, inactive or mismatched profiles",
    async (profile) => {
      const { service, profiles } = setup();
      profiles.findOwn.mockResolvedValue(profile);
      await expect(service.currentUser()).rejects.toMatchObject({
        status: 403,
      });
    },
  );
  it("authenticates credentials and replaces the prior local session", async () => {
    const { service, auth } = setup();
    const input = { email: user.email, password: "unit-password" };
    expect(await service.login(input)).toEqual(user);
    expect(auth.signIn).toHaveBeenCalledWith(input);
    expect(auth.signOut).toHaveBeenCalledOnce();
  });
  it("does not query a profile after invalid credentials", async () => {
    const { service, auth, profiles } = setup();
    auth.signIn.mockRejectedValue(new AuthenticationError());
    await expect(
      service.login({ email: user.email, password: "wrong" }),
    ).rejects.toMatchObject({ status: 401 });
    expect(profiles.findOwn).not.toHaveBeenCalled();
  });
  it("removes a newly signed-in session when application access fails", async () => {
    const { service, auth, profiles } = setup();
    profiles.findOwn.mockResolvedValue(null);
    await expect(
      service.login({ email: user.email, password: "unit-password" }),
    ).rejects.toMatchObject({ status: 403 });
    expect(auth.signOut).toHaveBeenCalledTimes(2);
  });
  it("logs out through Supabase Auth", async () => {
    const { service, auth } = setup();
    await service.logout();
    expect(auth.signOut).toHaveBeenCalledOnce();
  });
  it("selects private demo credentials and authenticates instead of changing a role", async () => {
    vi.stubEnv("DEMO_ACCOUNTS_ENABLED", "true");
    vi.stubEnv("DEMO_CUTTING_SUPERVISOR_EMAIL", user.email);
    vi.stubEnv(
      "DEMO_CUTTING_SUPERVISOR_PASSWORD",
      "private-unit-demo-password",
    );
    const { service, auth } = setup();
    expect(await service.demoLogin("cutting-supervisor")).toEqual(user);
    expect(auth.signIn).toHaveBeenCalledWith({
      email: user.email,
      password: "private-unit-demo-password",
    });
  });
  it("rejects a demo account whose real profile no longer has its expected role", async () => {
    vi.stubEnv("DEMO_ACCOUNTS_ENABLED", "true");
    vi.stubEnv("DEMO_CUTTING_SUPERVISOR_EMAIL", user.email);
    vi.stubEnv(
      "DEMO_CUTTING_SUPERVISOR_PASSWORD",
      "private-unit-demo-password",
    );
    const { service, auth, profiles } = setup();
    profiles.findOwn.mockResolvedValue({ ...user, role: "SYSTEM_ADMIN" });
    await expect(service.demoLogin("cutting-supervisor")).rejects.toMatchObject(
      { status: 403 },
    );
    expect(auth.signOut).toHaveBeenCalledTimes(2);
  });
  it("hides demo login when disabled", async () => {
    const { service, auth } = setup();
    await expect(service.demoLogin("cutting-supervisor")).rejects.toMatchObject(
      { status: 404 },
    );
    expect(auth.signIn).not.toHaveBeenCalled();
  });
});
