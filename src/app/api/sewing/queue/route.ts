import { SewingController } from "@/server/controllers/sewing-controller";
import { createAuthService } from "@/server/auth/context";
import { createSewingService } from "@/server/production-context";
import { apiResponse } from "@/server/http/request";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return apiResponse(async (headers) => {
    const controller = new SewingController(
      await createAuthService(headers),
      await createSewingService(headers),
    );
    return { data: await controller.queue(request) };
  });
}
