import "server-only";
import { idSchema } from "@/modules/orders/schemas";
import {
  decisionSchema,
  saveCountsSchema,
  rejectSchema,
  verificationListSchema,
} from "@/modules/verification/schemas";
import type { AuthService } from "@/server/services/auth-service";
import type { VerificationService } from "@/server/services/verification-service";
import { requireRole } from "@/server/auth/guards";
import {
  validate,
  readJson,
  requireOrigin,
  queryObject,
} from "@/server/http/request";
export class VerificationController {
  constructor(
    private readonly auth: AuthService,
    private readonly verification: VerificationService,
  ) {}
  private async actor() {
    return requireRole(await this.auth.currentUser(), "CUTTING_VERIFIER");
  }
  async queue(request: Request) {
    const actor = await this.actor();
    return this.verification.queue(
      actor,
      validate(verificationListSchema, queryObject(request)),
    );
  }
  async history(request: Request) {
    const actor = await this.actor();
    return this.verification.history(
      actor,
      validate(verificationListSchema, queryObject(request)),
    );
  }
  async detail(id: string) {
    return this.verification.detail(await this.actor(), validate(idSchema, id));
  }
  async counts(request: Request, id: string) {
    const actor = await this.actor();
    requireOrigin(request);
    return this.verification.save(
      actor,
      validate(idSchema, id),
      validate(saveCountsSchema, await readJson(request)),
    );
  }
  async approve(request: Request, id: string) {
    const actor = await this.actor();
    requireOrigin(request);
    return this.verification.approve(
      actor,
      validate(idSchema, id),
      validate(decisionSchema, await readJson(request)),
    );
  }
  async reject(request: Request, id: string) {
    const actor = await this.actor();
    requireOrigin(request);
    return this.verification.reject(
      actor,
      validate(idSchema, id),
      validate(rejectSchema, await readJson(request)),
    );
  }
}
