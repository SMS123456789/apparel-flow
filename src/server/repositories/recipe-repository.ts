import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database.generated";
import type { Recipe } from "@/modules/orders/types";
import { ExternalServiceError } from "@/server/http/errors";
type RecipeRow = Tables<"recipes"> & {
  recipe_components: Tables<"recipe_components">[];
};
export function recipeOutput(row: RecipeRow): Recipe {
  return {
    id: row.id,
    code: row.recipe_code,
    name: row.name,
    category: row.category,
    standardFabricYards: String(row.std_fabric_yards),
    wastageCapPct: String(row.wastage_cap_pct),
    components: row.recipe_components
      .toSorted((a, b) => a.sort_order - b.sort_order)
      .map((c) => ({
        id: c.id,
        name: c.component_name,
        piecesPerGarment: c.pieces_per_garment,
        sortOrder: c.sort_order,
        imageUrl: c.image_url,
      })),
  };
}
export interface RecipeRepository {
  list(): Promise<Recipe[]>;
  find(id: string): Promise<Recipe | null>;
}
export class SupabaseRecipeRepository implements RecipeRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}
  async list() {
    const { data, error } = await this.client
      .from("recipes")
      .select("*,recipe_components(*)")
      .order("recipe_code");
    if (error) throw new ExternalServiceError();
    return data.map(recipeOutput);
  }
  async find(id: string) {
    const { data, error } = await this.client
      .from("recipes")
      .select("*,recipe_components(*)")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new ExternalServiceError();
    return data ? recipeOutput(data) : null;
  }
}
