# 08 - HTTP API contract

**DESIGN DECISION (approved by user):** Thin Next.js Route Handlers -> Controllers -> Services -> Repositories. Stable REST-style /api routes, JSON responses, server identity/current role. Exact envelope/pagination/revision details are engineering choices within approved UD-019, not unresolved blockers.

## Common contract

HTTPS/JSON; cookie-based Supabase SSR session. Public signup disabled. Mutations apply same-origin protection; private app data no-store. Controller guards role/current activity before sensitive lookup, then strict Zod validation/service.

Command payloads cannot supply acting user/verifier/creator, role authority, production status, timestamp, expected quantity, flags, wastage, or audit. Target user/component/attempt IDs select resources; CreateUserSchema's target production role is an admin-authorized assignment, never actor authority.

Success: data plus optional meta(requestId/pagination). Error: error(code/message/optional fieldErrors or violations), meta(requestId). Times UTC ISO 8601. Count/revision outputs are safe integer numbers; fabric/percentage outputs canonical decimal strings. Numeric request strings are invalid.

Implementation list defaults: limit 20/max 100, opaque cursor, allowlisted search, stable timestamp/ID ordering. No arbitrary expressions. Sewing status/includeUnverified filters cannot widen VERIFIED-only queries.

## Session, recipe, and order routes

S = CUTTING_SUPERVISOR, V = CUTTING_VERIFIER, W = SEWING_SUPERVISOR, A = SYSTEM_ADMIN. Scope is factory-wide by role, never creator-owned.

| Method/path | Role | Request/result | Success |
|---|---|---|---|
| GET /api/session | S/V/W/A | Own safe current profile, no secrets. | 200 |
| GET /api/recipes | S/V | Exact read-only seeded catalog/components. | 200 |
| POST /api/orders | S | CreateOrderSchema -> CUTTING_IN_PROGRESS with server expectations/revision. | 201 |
| GET /api/orders | S | Factory cutting records; allowlisted state/search. | 200 |
| GET /api/orders/:id | S | Cutting detail/immutable decision summary. | 200 |
| PATCH /api/orders/:id | S | EditPreparedOrderSchema; only preparation state, recipe/target only before first submit. | 200 |
| POST /api/orders/:id/submit | S | ExpectedRevisionSchema -> pending/new attempt; first-submit frozen manifest. | 200 |
| POST /api/orders/:id/recut | S | ExpectedRevisionSchema -> preparation on same rejected order; retain frozen requirements/history. | 200 |

No generic order status setter, DELETE, recipe editor, or admin production route.

## Verification and sewing routes

V may read role-permitted factory verification history; for every count/approve/reject mutation V must not be order creator.

| Method/path | Role | Request/result | Success |
|---|---|---|---|
| GET /api/verification/queue | V | Pending factory orders. | 200 |
| GET /api/verification/:orderId | V | Attempt/manifest/saved counts/revision/history; own-created records read-only for verification. | 200 |
| PATCH /api/verification/:orderId/counts | V | Explicit VerificationCountSchema subset save, flags/new revision. | 200 |
| POST /api/verification/:orderId/approve | V | Decision schema; reread DB/full gate/immutable audit/VERIFIED atomically. | 200 |
| POST /api/verification/:orderId/reject | V | RejectBatchSchema -> REJECTED/immutable reason/closed attempt. | 200 |
| GET /api/sewing/queue | W | Fixed database VERIFIED-only projection, immutable evidence/start fields. | 200 |
| GET /api/sewing/:orderId | W | VERIFIED-only detail; nonverified -> 404. | 200 |
| POST /api/sewing/:orderId/start | W | Revision -> sewing_started_at/started_by, status still VERIFIED. | 200 |

Canonical /api/verification is singular. Wrong role or self-verification -> 403; RED/missing/uncounted -> 422; invalid state/stale/repeated decision/start -> 409. YELLOW proceeds, cap excess only warns, negative fabric variance stays signed.

## Admin routes

**DESIGN DECISION (approved UD-022):** Synchronous direct creation; temporary password, no invitation/polling operation.

| Method/path | Role | Request/result | Success |
|---|---|---|---|
| GET /api/admin/users | A | Safe user list/search/role/activity filters. | 200 |
| POST /api/admin/users | A | CreateUserSchema -> Auth create, profile+audit persist, safe created user. | 201 |
| PATCH /api/admin/users/:id/role | A | Target revision/production role; protected self/promotion guards, audit. | 200 |
| PATCH /api/admin/users/:id/status | A | Target revision/isActive; no self-deactivation; audit. | 200 |
| GET /api/admin/audit | A | Safe immutable administrative events. | 200 |

No /api/admin/operations, async 202, invite, password-in-response, normal SYSTEM_ADMIN create/promotion, impersonation, or hard-delete endpoint.

## Zod schema inventory

Shape/basic validation in Zod; state, creator separation, authorization, gate in services. Reject unknown keys; no string-to-number coercion.

| Schema | Allowed fields/basic constraints |
|---|---|
| CreateOrderSchema | recipeId UUID; targetQty positive safe integer in column bounds; fabricRollId trimmed nonempty; actualFabricYards positive number with at most three decimals/column bounds. |
| EditPreparedOrderSchema | expectedRevision; nonempty allowed fields. Recipe/target cannot change after first submission, even during re-cut. |
| ExpectedRevisionSchema | expectedRevision nonnegative safe integer; no actor/state/time. |
| VerificationCountSchema | attemptId UUID; expectedRevision; nonempty unique items(componentId UUID, actualQty nonnegative safe integer). Zero allowed; omitted items unchanged; null/fraction/string invalid. |
| VerificationDecisionSchema | attemptId UUID; expectedRevision; no counts/flags/audit/bypass. |
| RejectBatchSchema | attemptId, expectedRevision, reason trimmed 1-1000 chars. |
| CreateUserSchema | email valid normalized email; fullName trimmed nonempty; role exactly one production role; temporaryPassword string meeting configured Auth password policy. |
| ChangeUserRoleSchema | expectedRevision; target role one production role; reject actor's self-production/self-demotion and SYSTEM_ADMIN assignment. |
| ChangeUserStatusSchema | expectedRevision; isActive boolean; reject actor self-deactivation. |

Numeric storage/input conventions are [06](06_DATABASE_DESIGN.md). HTML clients may parse valid input for JSON, but server independently rejects invalid numeric types/scale. Empty commands fail required revision/attempt validation.

## Example payloads

Order request:

```json
{
  "recipeId": "d07b8d24-e2aa-460e-a14c-3f3e849bad40",
  "targetQty": 50,
  "fabricRollId": "FAB-ROLL-882",
  "actualFabricYards": 94.5
}
```

Explicit count subset:

```json
{
  "attemptId": "9c807609-4c40-465d-b86b-54067a531953",
  "expectedRevision": 3,
  "items": [
    {"componentId": "2ec956d4-e765-44c5-a197-f74f90d35c9b", "actualQty": 100}
  ]
}
```

Admin request (password placeholder is not an actual credential):

```json
{
  "email": "cutting.supervisor@example.com",
  "fullName": "Demo Cutting Supervisor",
  "role": "CUTTING_SUPERVISOR",
  "temporaryPassword": "<admin-entered temporary password>"
}
```

CreateUser success data: id, email, fullName, role, isActive, createdAt. Never include password/hash/provider secrets. If Auth create fails, no profile; if profile/audit write fails after new Auth creation, attempt cleanup of only that new identity and return error. Cleanup success is not creation success. Failed cleanup also returns error and leaves missing-profile access denied.

Hard-stop response:

```json
{
  "error": {
    "code": "APPROVAL_BLOCKED",
    "message": "Every required component must be counted without shortages.",
    "violations": [
      {"componentId": "2ec956d4-e765-44c5-a197-f74f90d35c9b", "reason": "SHORTAGE"}
    ]
  },
  "meta": {"requestId": "server-generated-correlation-id"}
}
```

Missing/uncounted violations explicit. No internal SQL, stack, provider exception, or credentials.

## Error model

| Application error | HTTP | Meaning |
|---|---:|---|
| AuthenticationError | 401 | Invalid/absent validated session. |
| AuthorizationError | 403 | Wrong/inactive role, creator verification, admin self/promotion restriction. |
| NotFoundError | 404 | Missing or role-invisible resource. |
| RequestFormatError | 400 | Malformed JSON/path/query or unsupported filter. |
| ValidationError | 422 | Invalid shape/basic fields, reason, count/fabric precision, or temporary password. |
| BusinessRuleError | 422 | RED/missing/uncounted approval; no cap gate. |
| InvalidStateTransitionError | 409 | Action illegal for current state. |
| ConflictError | 409 | Stale revision/attempt, repeated decision/start, duplicate account. |
| UserProvisioningError | 500 | PROFILE_CREATION_FAILED/USER_CLEANUP_FAILED; compensation attempted, no false success. |
| UnexpectedError | 500 | Sanitized server failure; transaction rollback. |
| ExternalServiceError | 503 | Auth dependency unavailable; no created profile. |

Invalid method -> 405. No elaborate MVP RateLimitError subsystem. Guards precede resource/business data so wrong-role callers receive 403 without component leakage. Route serializes controller results; service owns rules.

## Retry and uncertainty

Decision commands require current revision; on 409 refetch. After timeout, inspect committed order state before retrying decisions. Admin creation is synchronous; never blindly retry if an Auth/profile outcome is uncertain. Check whether the new user/profile already exists before cleanup or recreation; do not delete a valid existing account. No idempotency ledger/background reconciliation system is required.
