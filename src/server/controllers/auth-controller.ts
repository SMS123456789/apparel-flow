import "server-only";
import { loginSchema, demoLoginSchema } from "@/modules/identity/schemas";
import { rolePaths } from "@/modules/identity/types";
import type { AuthService } from "@/server/services/auth-service";
import { readJson, requireOrigin, validate } from "@/server/http/request";
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  async login(request: Request) {
    requireOrigin(request);
    const user = await this.auth.login(
      validate(loginSchema, await readJson(request)),
    );
    return { user, redirectTo: rolePaths[user.role] };
  }
  async demoLogin(request: Request) {
    requireOrigin(request);
    const input = validate(demoLoginSchema, await readJson(request));
    const user = await this.auth.demoLogin(input.persona);
    return { user, redirectTo: rolePaths[user.role] };
  }
  async logout(request: Request) {
    requireOrigin(request);
    await this.auth.logout();
    return { signedOut: true };
  }
  me() {
    return this.auth.currentUser();
  }
}
