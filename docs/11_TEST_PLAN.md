# 11 - Test and verification plan

**ASSESSMENT REQUIREMENT (section 10, p.4):** Automated domain/API/database proof of five core cases. **DESIGN DECISION (approved by user):** Vitest and Playwright. The matrix below is the approved full-system test plan. G00 executed no runtime tests; G01–G08 evidence is recorded in document 14. All five manufacturing cases now pass; the final execution map is [16](16_SUBMISSION_CHECKLIST.md).

## Historical G04 verification

Vitest uses pure schemas/guards, typed service adapters and actual Route Handler/controller integration with mocked external dependencies. It covers role isolation, profile activity, strict inputs, creation success/compensation/uncertainty, audit orchestration, safe errors/origin/no-store and Proxy cookie propagation; mocks do not claim cloud Auth/RLS correctness.

Separate disposable PostgreSQL 17 tests run all actual migrations under a non-superuser operator and managed Auth namespace emulation. They verify own-active RLS, service-only gateways, restricted owner/grants, denied direct writes/production access, active-admin/self/promotion/stale guards and real audit-failure rollback. No cloud reset or manufacturing fixtures are used.

Playwright uses all four real configured Supabase accounts, desktop/mobile Chromium, real persona replacement/logout/SSR refresh, API/page isolation and private admin dialogs/audit. Reversible role/activity changes are restored in finally blocks and append real audit. Traces are disabled so credentials/tokens do not enter artifacts; private admin login uses sanitized API transport rather than a password-bearing UI assertion. Browser screenshots/contrast/keyboard checks cover implemented G04 screens only. Bootstrap is run twice to verify idempotency and actual sign-in. Exact final results appear in [14](14_ARCHITECTURE_DECISIONS.md#g04-completion-evidence).

## Test levels and fixtures

**DESIGN DECISION (implementation detail):** Vitest unit tests exercise real pure domain functions; service tests check orchestration using typed repositories; Route Handler/controller/service integration tests mock external Auth/persistence adapters; Playwright direct API tests authenticate real Supabase users and hit the production-mode local server against the configured assessment database; database/RLS tests use actual grants/policies and transactional commands; Playwright checks real user journeys and visible states. Mocks alone cannot prove RLS, locks, durable persistence, or rollback.

Fixtures use exact REC-BL01/REC-CT02 and their five components each, distinct accounts for S/V/W/A, inactive account, prepared/pending/rejected/verified orders, complete/null/missing/excess/shortage sets, and historical re-cut attempts. Exact package versions are pinned in G01; isolated test setup is implementation work and not an architecture blocker. No tests run destructive resets against an unknown cloud project.

## Mandatory assessment cases

These rows are **ASSESSMENT REQUIREMENT**; section 9 supplies exact 403/422 outcomes.

| ID | Setup/action | Required assertion |
|---|---|---|
| ASMT-01 | All GREEN, authenticated Cutting Verifier approves pending order. | Approval succeeds; persistent VERIFIED, one immutable sign-off with correct actor/time/variances/wastage, sewing sees it. |
| ASMT-02 | One component RED; verifier sends direct approve request. | HTTP 422; no VERIFIED state, approval log, sewing-start metadata, or approved queue result. UI separately disables Approve. |
| ASMT-03 | Verifier rejects without reason. | Backend validation fails; order/attempt unchanged, no rejection log. Approved UD-018/UD-019 mapping is 422. |
| ASMT-04 | Supervisor and Sewing Supervisor send direct approval. | HTTP 403; no change/log. Extend to SYSTEM_ADMIN per user invariant. |
| ASMT-05 | Seed cutting/pending/rejected/verified states; query sewing database/API. | Only VERIFIED rows. Caller filters/IDs cannot leak others; verify query predicate in real data access. |

## Domain, workflow, persistence

Additional rows are **DESIGN DECISION (implementation detail)** except explicit assessment outcomes already traced in [01](01_REQUIREMENTS.md).

| ID | Coverage and assertion |
|---|---|
| DOMAIN-01 | Both exact BOMs; target 50 -> 50/100 multipliers correctly. Server ignores/rejects supplied expected values. |
| DOMAIN-02 | Equal/greater/less actual give GREEN/YELLOW/RED; count 0 is RED, null is uncounted. |
| DOMAIN-03 | YELLOW plus GREEN can approve under approved UD-002; surplus and signed variance stored. |
| DOMAIN-04 | 50 blouses -> 90 expected yards; 94.5 -> 5%; exact/negative/extreme rounding cases according to UD-001/UD-004/UD-013. |
| GATE-01 | Missing manifest row, omitted item, null count, duplicate/foreign component, empty recipe/manifest corruption all fail safely; shortages/missing/uncounted return 422. |
| ORDER-01 | Required recipe/target/roll/actual fabric enforced; recipe exists; order number unique; full expected manifest generated. |
| INPUT-01 | Negative/fraction/string/null/empty/boolean/oversized/overflow values; blank reason; unknown protected keys. Accept positive fabric with up to three decimals; reject overprecision/zero fabric and fractional discrete counts. |
| FLOW-01 | Create/prepare/submit/pending/count/approve sequence; illegal state commands fail, never generic status PATCH. |
| FLOW-02 | Reject with reason; preserve old evidence; approved re-cut/resubmit creates distinct OPEN attempt with uncounted counts. Stale prior-attempt requests fail. |
| DATA-01 | Exact seed names/codes/category/rates/caps/grouped component multipliers. Seeding later is repeatable without duplicating rows. |
| DATA-02 | Reload/browser restart reads persisted orders/counts/logs/states; no memory-only database substitutes. |
| AUDIT-01 | Identity/time server-derived; component/fabric snapshot matches commit; log UPDATE/DELETE denied; later recipe/name/role changes leave evidence unchanged. |
| TX-01 | Inject failure at audit insert, item snapshot, or status update; entire approval rolls back. |
| TX-02 | Simultaneous approvals; exactly one wins and one log exists; second returns 409. |
| TX-03 | Approve versus count edit/reject/resubmit; serialized state, no approved shortage or mixed-attempt audit. |
| TX-04 | Admin deactivation/role change versus production decision locks; command uses authority at its defined serialization point. |
| SEW-01 | Queue/detail/child rows/search counts/cursors never reveal nonverified data; Start requires VERIFIED approval and sewing role. |
| SEW-02 | Start once persists actor/time; status remains VERIFIED; sewing_started_at/started_by persist; repeated Start returns 409 and Started badge remains visible. |

Approved scenarios explicitly cover preserved negative variance, warning-only cap excess, and GREEN-count physical-defect rejection with reason. No cap or negative-variance approval gate.

## RBAC, authentication, and RLS

| ID | Coverage and assertion |
|---|---|
| AUTH-01 | Real Supabase sign-in for distinct personas; fake client role/session payload does not authenticate. |
| AUTH-02 | Forged/expired/wrong-project token, editable metadata, actor/time spoofing, invalid session; 401/403 as appropriate, no trusted client identity. |
| AUTH-03 | Inactive/missing profile denies every app API, including with existing valid JWT; old role claim cannot preserve previous authority. |
| RBAC-01 | Supervisor cannot counts/approve/reject or Sewing Queue/detail/start. |
| RBAC-02 | Verifier cannot create/edit/submit/recut, edit recipes, or sewing APIs. |
| RBAC-03 | Sewing cannot cutting/verifier/admin APIs and cannot see pending/rejected via any relation. |
| RBAC-04 | Admin cannot any production mutations, force status, inject queue, or impersonate; no production-data grants in admin panel. |
| RBAC-05 | Creator cannot enter counts/approve/reject their own order after role change (403); admin cannot self-assign production, deactivate/demote itself, or create another SYSTEM_ADMIN; first admin manual bootstrap. |
| RBAC-06 | Two supervisors can see factory cutting records created by either user; no creator-owned query filter or tenancy gate. Verification history is role-readable, while creator verification is forbidden. |
| RLS-01 | Real anon/authenticated clients cannot raw-write production/profile role/activity, overwrite logs, or execute backend-only command gateway/helper. |
| RLS-02 | Each role sees only allowed parent/child rows; views/functions do not bypass policies; current inactive role blocks reads. |
| RLS-03 | Server service-context commands reject inactive/nonverifier internal actor; grants/default privileges documented; secret never reaches browser. |
| SEC-01 | CSRF/origin policy, unsupported filters, 405 methods, private cache isolation, sanitized logs/errors, reasonable payload validation; no elaborate MVP rate-limiting subsystem. |

## Administrative extension

| ID | Coverage and assertion |
|---|---|
| ADMIN-01 | Authorized synchronous temporary-password create/list; other roles 403; safe output excludes credentials. |
| ADMIN-02 | Role/activity mutation updates current authority and revision; invalid role/target denied; no side effects without audit. |
| ADMIN-03 | Safe immutable admin events contain actor/target/before/after/time; not production payloads or secrets. |
| ADMIN-05 | Temporary password goes only to server Auth creation; never in profile/audit/log/response; create succeeds with 201 only after profile persistence. No polling/operations API. |
| ADMIN-04 | Auth failure creates no profile; profile/audit failure triggers cleanup of only newly created Auth ID and returns error; cleanup failure still denies app access via missing profile. Existing duplicate-email account never deleted; uncertain SQL outcome checked before cleanup. |

## Playwright, contrast, and evaluator simulation

| ID | Coverage and assertion |
|---|---|
| UI-01 | Visible three-persona demo panel uses real sign-in; navigation matches active role; account switch clears prior persona content. |
| UI-02 | Live labels/variance, null distinct from zero, save persistence, disabled Approve on shortage/incomplete/unsaved counts, rejection note errors, backend conflict/error messages. |
| UI-03 | All inputs/search/dropdowns/default/focus/invalid/disabled/loading/autofill states legible; dark text on light surface; approved contrast target; keyboard/dialog/table/mobile checks. |
| DELIVERY-01 | Later live URL, public atomic commits, README with architecture/schema/three demo credentials, runnable passing suite, honest four-section AI report with two real examples. |

Manual evaluator sequence (section 16, p.6): inspect every input/dropdown; switch to verifier and confirm create hidden; switch to sewing and confirm pending absent; enter shortage and test UI/direct backend block; approve GREEN, observe sewing, refresh; inspect commits/tests/AI report. Browser screenshots supplement measured contrast and keyboard checks, not replace them.

## Future completion evidence

**DESIGN DECISION (implementation detail):** Each implementation milestone records command/result, tested commit, environment, fixture identity, and failures fixed. Passing mocked unit tests does not mean assessment complete. Release requires all five core cases plus real RBAC/RLS/transaction/persistence checks, UI audit, and submission review. Coverage percentages and numeric latency targets are not invented acceptance gates.

G00 verification consists only of source-reading and documentation consistency/link/trace checks. No runtime correctness or automated application pass is claimed.

## Final G07–G08 execution

All five mandatory assessment cases and the happy/rejection-to-recut-to-sewing
journeys are executed. Vitest has 215 passing tests across 13 files; Playwright
has 23 passes and one explicit duplicate viewport-review skip. Disposable
PostgreSQL executes eight migrations, full constraints/grants/RLS/rollback/
immutability suites and four true two-session races. Cloud catalog/history/types
and four real account sign-ins are independently verified. No cloud reset or
SQL mutation fixture was used. Browser E2E records and administrative audit are
retained; reversible demo role/activity changes are restored.

UI review covers login/admin/cutting/verifier/sewing at 1280/768/375/320,
actual field/action colors, focused/invalid/disabled states, touch/count sizing,
keyboard dialogs, error focus, Enter safety, 200% text enlargement and persistence.
This scoped evidence is not a formal independent WCAG certification.
Only live deployment/public-URL smoke testing remains manual user action.
