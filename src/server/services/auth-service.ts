import "server-only";
import {
  demoPersonas,
  type AuthIdentity,
  type AuthenticatedUser,
  type DemoPersona,
} from "@/modules/identity/types";
import type { LoginInput } from "@/modules/identity/schemas";
import type { AuthRepository } from "@/server/repositories/auth-repository";
import type { ProfileRepository } from "@/server/repositories/profile-repository";
import {
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
} from "@/server/http/errors";
export class AuthService {
  constructor(
    private readonly auth: AuthRepository,
    private readonly profiles: ProfileRepository,
  ) {}
  private async resolve(identity: AuthIdentity): Promise<AuthenticatedUser> {
    const profile = await this.profiles.findOwn(identity.id);
    if (!profile?.isActive || profile.id !== identity.id)
      throw new AuthorizationError(
        "Application access is unavailable for this account.",
      );
    return {
      ...identity,
      fullName: profile.fullName,
      role: profile.role,
      isActive: profile.isActive,
    };
  }
  async currentUser() {
    const identity = await this.auth.currentIdentity();
    if (!identity) throw new AuthenticationError();
    return this.resolve(identity);
  }
  async login(input: LoginInput) {
    await this.auth.signOut();
    const identity = await this.auth.signIn(input);
    try {
      return await this.resolve(identity);
    } catch (error) {
      await this.auth.signOut();
      throw error;
    }
  }
  async demoLogin(persona: DemoPersona) {
    const option = demoPersonas.find((item) => item.id === persona);
    if (process.env.DEMO_ACCOUNTS_ENABLED !== "true" || !option)
      throw new NotFoundError();
    const email = process.env[`${option.env}_EMAIL`];
    const password = process.env[`${option.env}_PASSWORD`];
    if (!email || !password) throw new NotFoundError();
    const user = await this.login({ email, password });
    if (user.role !== option.role) {
      await this.auth.signOut();
      throw new AuthorizationError();
    }
    return user;
  }
  logout() {
    return this.auth.signOut();
  }
}
