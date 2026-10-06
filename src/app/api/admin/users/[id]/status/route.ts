import { AdminUserController } from "@/server/controllers/admin-user-controller";
import {
  createAuthService,
  createAdminUserService,
} from "@/server/auth/context";
import { apiResponse } from "@/server/http/request";
export const dynamic = "force-dynamic";
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return apiResponse(async (headers, requestId) => {
    const { id } = await context.params;
    const controller = new AdminUserController(
      await createAuthService(headers),
      createAdminUserService(),
    );
    return { data: await controller.changeStatus(request, id, requestId) };
  });
}
