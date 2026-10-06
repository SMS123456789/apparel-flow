import { AdminUserController } from "@/server/controllers/admin-user-controller";
import {
  createAuthService,
  createAdminUserService,
} from "@/server/auth/context";
import { apiResponse } from "@/server/http/request";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return apiResponse(async (headers) => {
    const controller = new AdminUserController(
      await createAuthService(headers),
      createAdminUserService(),
    );
    return { data: await controller.list(request) };
  });
}
export async function POST(request: Request) {
  return apiResponse(async (headers, requestId) => {
    const controller = new AdminUserController(
      await createAuthService(headers),
      createAdminUserService(),
    );
    return { data: await controller.create(request, requestId), status: 201 };
  });
}
