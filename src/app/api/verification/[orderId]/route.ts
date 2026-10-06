import { VerificationController } from "@/server/controllers/verification-controller";
import { createAuthService } from "@/server/auth/context";
import { createVerificationService } from "@/server/production-context";
import { apiResponse } from "@/server/http/request";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  return apiResponse(async (headers) => {
    const { orderId } = await context.params;
    const controller = new VerificationController(
      await createAuthService(headers),
      await createVerificationService(headers),
    );
    return { data: await controller.detail(orderId) };
  });
}
