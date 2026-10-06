import "server-only";
import type { AuthService } from "@/server/services/auth-service";
import type { RecipeService } from "@/server/services/recipe-service";
import { requireRole } from "@/server/auth/guards";
export class RecipeController {
  constructor(
    private readonly auth: AuthService,
    private readonly recipes: RecipeService,
  ) {}
  async list() {
    const actor = requireRole(
      await this.auth.currentUser(),
      "CUTTING_SUPERVISOR",
      "CUTTING_VERIFIER",
    );
    return this.recipes.list(actor);
  }
}
