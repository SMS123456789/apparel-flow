import "server-only";
import {
  productionRoles,
  type AuthenticatedUser,
  type ProductionRole,
} from "@/modules/identity/types";
import type {
  CreateUserInput,
  ChangeRoleInput,
  ChangeStatusInput,
  ListUsersInput,
  ListAuditInput,
} from "@/modules/admin/schemas";
import type { AuthAdminRepository } from "@/server/repositories/auth-repository";
import type { AdminUserRepository } from "@/server/repositories/admin-user-repository";
import { requireRole } from "@/server/auth/guards";
import {
  AuthorizationError,
  NotFoundError,
  UserProvisioningError,
} from "@/server/http/errors";
export class AdminUserService {
  constructor(
    private readonly auth: AuthAdminRepository,
    private readonly users: AdminUserRepository,
  ) {}
  list(actor: AuthenticatedUser, input: ListUsersInput) {
    requireRole(actor, "SYSTEM_ADMIN");
    return this.users.list(actor.id, input);
  }
  audit(actor: AuthenticatedUser, input: ListAuditInput) {
    requireRole(actor, "SYSTEM_ADMIN");
    return this.users.audit(actor.id, input);
  }
  private productionRole(role: ProductionRole) {
    if (!productionRoles.some((allowed) => allowed === role))
      throw new AuthorizationError();
  }
  async create(
    actor: AuthenticatedUser,
    input: CreateUserInput,
    requestId: string,
  ) {
    requireRole(actor, "SYSTEM_ADMIN");
    this.productionRole(input.role);
    const created = await this.auth.createUser(
      input.email,
      input.temporaryPassword,
    );
    try {
      return await this.users.createProfile(
        actor.id,
        created.id,
        input.fullName,
        input.role,
        requestId,
      );
    } catch {
      // A lost response may conceal a committed transaction. Never delete that user.
      let profile;
      try {
        profile = await this.users.findProfile(created.id);
      } catch {
        throw new UserProvisioningError("PROVISIONING_OUTCOME_UNCERTAIN");
      }
      if (profile)
        throw new UserProvisioningError("PROVISIONING_OUTCOME_UNCERTAIN");
      try {
        await this.auth.deleteIncompleteUser(created.id);
      } catch {
        throw new UserProvisioningError("USER_CLEANUP_FAILED");
      }
      throw new UserProvisioningError("PROFILE_CREATION_FAILED");
    }
  }
  private async target(actor: AuthenticatedUser, id: string) {
    requireRole(actor, "SYSTEM_ADMIN");
    if (actor.id === id)
      throw new AuthorizationError(
        "Administrators cannot change their own production role or account status.",
      );
    const profile = await this.users.findProfile(id);
    if (!profile) throw new NotFoundError();
    if (profile.role === "SYSTEM_ADMIN")
      throw new AuthorizationError(
        "Administrator accounts are managed by the private operator.",
      );
  }
  async changeRole(
    actor: AuthenticatedUser,
    id: string,
    input: ChangeRoleInput,
    requestId: string,
  ) {
    await this.target(actor, id);
    this.productionRole(input.role);
    return this.users.update(
      actor.id,
      id,
      input.expectedRevision,
      { role: input.role },
      requestId,
    );
  }
  async changeStatus(
    actor: AuthenticatedUser,
    id: string,
    input: ChangeStatusInput,
    requestId: string,
  ) {
    await this.target(actor, id);
    return this.users.update(
      actor.id,
      id,
      input.expectedRevision,
      { isActive: input.isActive },
      requestId,
    );
  }
}
