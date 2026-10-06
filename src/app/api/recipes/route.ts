import { RecipeController } from "@/server/controllers/recipe-controller";
import { createAuthService } from "@/server/auth/context";
import { createRecipeService } from "@/server/production-context";
import { apiResponse } from "@/server/http/request";
export const dynamic = "force-dynamic";
export async function GET() {
  return apiResponse(async (headers) => {
    const controller = new RecipeController(
      await createAuthService(headers),
      await createRecipeService(headers),
    );
    return { data: await controller.list() };
  });
}
