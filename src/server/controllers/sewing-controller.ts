import "server-only";
import { idSchema } from "@/modules/orders/schemas";
import { sewingListSchema, startSewingSchema } from "@/modules/sewing/schemas";
import type { AuthService } from "@/server/services/auth-service";
import type { SewingService } from "@/server/services/sewing-service";
import { requireRole } from "@/server/auth/guards";
import {
  validate,
  readJson,
  requireOrigin,
  queryObject,
} from "@/server/http/request";
export class SewingController {
  constructor(
    private readonly auth: AuthService,
    private readonly sewing: SewingService,
  ) {}
  private async actor() {
    return requireRole(await this.auth.currentUser(), "SEWING_SUPERVISOR");
  }
  async queue(request: Request) {
    return this.sewing.queue(
      await this.actor(),
      validate(sewingListSchema, queryObject(request)),
    );
  }
  async detail(id: string) {
    return this.sewing.detail(await this.actor(), validate(idSchema, id));
  }
  async start(request: Request, id: string) {
    const actor = await this.actor();
    requireOrigin(request);
    const input = validate(startSewingSchema, await readJson(request));
    return this.sewing.start(
      actor,
      validate(idSchema, id),
      input.expectedRevision,
    );
  }
}
