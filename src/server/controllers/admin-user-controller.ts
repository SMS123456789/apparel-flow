import "server-only";
import {
  createUserSchema,
  changeRoleSchema,
  changeStatusSchema,
  listUsersSchema,
  listAuditSchema,
  userIdSchema,
} from "@/modules/admin/schemas";
import type { AuthService } from "@/server/services/auth-service";
import type { AdminUserService } from "@/server/services/admin-user-service";
import { requireRole } from "@/server/auth/guards";
import {
  validate,
  requireOrigin,
  readJson,
  queryObject,
} from "@/server/http/request";
export class AdminUserController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: AdminUserService,
  ) {}
  private async actor() {
    return requireRole(await this.auth.currentUser(), "SYSTEM_ADMIN");
  }
  async list(request: Request) {
    const actor = await this.actor();
    return this.users.list(
      actor,
      validate(listUsersSchema, queryObject(request)),
    );
  }
  async audit(request: Request) {
    const actor = await this.actor();
    return this.users.audit(
      actor,
      validate(listAuditSchema, queryObject(request)),
    );
  }
  async create(request: Request, requestId: string) {
    const actor = await this.actor();
    requireOrigin(request);
    return this.users.create(
      actor,
      validate(createUserSchema, await readJson(request)),
      requestId,
    );
  }
  async changeRole(request: Request, id: string, requestId: string) {
    const actor = await this.actor();
    requireOrigin(request);
    return this.users.changeRole(
      actor,
      validate(userIdSchema, id),
      validate(changeRoleSchema, await readJson(request)),
      requestId,
    );
  }
  async changeStatus(request: Request, id: string, requestId: string) {
    const actor = await this.actor();
    requireOrigin(request);
    return this.users.changeStatus(
      actor,
      validate(userIdSchema, id),
      validate(changeStatusSchema, await readJson(request)),
      requestId,
    );
  }
}
