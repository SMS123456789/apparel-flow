import type { GateViolation } from "@/modules/verification/rules";
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fieldErrors?: Record<string, string[]>,
    public readonly violations?: GateViolation[],
  ) {
    super(message);
    this.name = new.target.name;
  }
}
export class AuthenticationError extends AppError {
  constructor() {
    super(401, "UNAUTHENTICATED", "Sign in with a valid account.");
  }
}
export class AuthorizationError extends AppError {
  constructor(message = "This account cannot access this operation.") {
    super(403, "FORBIDDEN", message);
  }
}
export class ValidationError extends AppError {
  constructor(fieldErrors?: Record<string, string[]>) {
    super(422, "INVALID_REQUEST", "Check the highlighted fields.", fieldErrors);
  }
}
export class RequestFormatError extends AppError {
  constructor() {
    super(
      400,
      "MALFORMED_REQUEST",
      "Send a valid JSON request or supported query.",
    );
  }
}
export class NotFoundError extends AppError {
  constructor() {
    super(404, "NOT_FOUND", "The requested record was not found.");
  }
}
export class ConflictError extends AppError {
  constructor(
    message = "The record changed or already exists. Reload before trying again.",
  ) {
    super(409, "CONFLICT", message);
  }
}
export class BusinessRuleError extends AppError {
  constructor(message: string) {
    super(422, "BUSINESS_RULE", message);
  }
}
export class ExternalServiceError extends AppError {
  constructor() {
    super(
      503,
      "DEPENDENCY_UNAVAILABLE",
      "Authentication or data service is unavailable. Try again shortly.",
    );
  }
}
export class UserProvisioningError extends AppError {
  constructor(
    code:
      | "PROFILE_CREATION_FAILED"
      | "USER_CLEANUP_FAILED"
      | "PROVISIONING_OUTCOME_UNCERTAIN",
  ) {
    super(
      500,
      code,
      "User creation did not complete reliably. Ask the operator to check the account before retrying.",
    );
  }
}

export class ApprovalBlockedError extends AppError {
  constructor(violations: GateViolation[] = []) {
    super(
      422,
      "APPROVAL_BLOCKED",
      "Every required component must be counted without shortages.",
      undefined,
      violations,
    );
  }
}
