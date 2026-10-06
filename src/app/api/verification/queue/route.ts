import { VerificationController } from "@/server/controllers/verification-controller";
import { createAuthService } from "@/server/auth/context";
import { createVerificationService } from "@/server/production-context";
import { apiResponse } from "@/server/http/request";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return apiResponse(async (headers) => {
    const controller = new VerificationController(
      await createAuthService(headers),
      await createVerificationService(headers),
    );
    return { data: await controller.queue(request) };
  });
}
