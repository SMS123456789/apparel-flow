import "server-only";
import type { AuthenticatedUser } from "@/modules/identity/types";
import type { SewingListInput } from "@/modules/sewing/schemas";
import type { SewingRepository } from "@/server/repositories/sewing-repository";
import { requireRole } from "@/server/auth/guards";
import { ConflictError, NotFoundError } from "@/server/http/errors";
export class SewingService {
  constructor(private readonly sewing: SewingRepository) {}
  queue(actor: AuthenticatedUser, input: SewingListInput) {
    requireRole(actor, "SEWING_SUPERVISOR");
    return this.sewing.list(input);
  }
  async detail(actor: AuthenticatedUser, id: string) {
    requireRole(actor, "SEWING_SUPERVISOR");
    const batch = await this.sewing.find(id);
    if (!batch || batch.status !== "VERIFIED") throw new NotFoundError();
    return batch;
  }
  async start(actor: AuthenticatedUser, id: string, revision: number) {
    const batch = await this.detail(actor, id);
    if (batch.sewingStartedAt || batch.revision !== revision)
      throw new ConflictError(
        "This batch changed or sewing has already started. Reload the batch.",
      );
    await this.sewing.start(actor.id, id, revision);
    return this.detail(actor, id);
  }
}
