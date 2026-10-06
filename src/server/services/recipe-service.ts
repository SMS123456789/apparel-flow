import "server-only";
import type { AuthenticatedUser } from "@/modules/identity/types";
import type { RecipeRepository } from "@/server/repositories/recipe-repository";
import { requireRole } from "@/server/auth/guards";
export class RecipeService {
  constructor(private readonly recipes: RecipeRepository) {}
  list(actor: AuthenticatedUser) {
    requireRole(actor, "CUTTING_SUPERVISOR", "CUTTING_VERIFIER");
    return this.recipes.list();
  }
}
