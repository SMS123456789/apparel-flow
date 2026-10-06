import { AuthController } from "@/server/controllers/auth-controller";
import { createAuthService } from "@/server/auth/context";
import { apiResponse } from "@/server/http/request";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return apiResponse(async (headers) => {
    const controller = new AuthController(await createAuthService(headers));
    return { data: await controller.demoLogin(request) };
  });
}
