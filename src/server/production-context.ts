import "server-only";
import { SewingService } from "@/server/services/sewing-service";
import { SupabaseSewingRepository } from "@/server/repositories/sewing-repository";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { SupabaseRecipeRepository } from "@/server/repositories/recipe-repository";
import { SupabaseOrderRepository } from "@/server/repositories/order-repository";
import { OrderService } from "@/server/services/order-service";
import { RecipeService } from "@/server/services/recipe-service";
import { VerificationService } from "@/server/services/verification-service";
import { SupabaseVerificationRepository } from "@/server/repositories/verification-repository";
export async function createOrderService(headers: Headers) {
  const read = await createServerSupabaseClient(headers);
  return new OrderService(
    new SupabaseOrderRepository(read, createAdminSupabaseClient()),
    new SupabaseRecipeRepository(read),
  );
}
export async function createRecipeService(headers: Headers) {
  return new RecipeService(
    new SupabaseRecipeRepository(await createServerSupabaseClient(headers)),
  );
}

export async function createVerificationService(headers: Headers) {
  const read = await createServerSupabaseClient(headers),
    command = createAdminSupabaseClient();
  return new VerificationService(
    new SupabaseOrderRepository(read, command),
    new SupabaseVerificationRepository(command),
  );
}

export async function createSewingService(headers: Headers) {
  return new SewingService(
    new SupabaseSewingRepository(
      await createServerSupabaseClient(headers),
      createAdminSupabaseClient(),
    ),
  );
}
