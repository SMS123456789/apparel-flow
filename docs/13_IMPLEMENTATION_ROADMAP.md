# 13 - Chunked implementation roadmap

**DESIGN DECISION (autonomous continuation request):** Finalize existing G04, then execute G05–G08 sequentially without intermediate approval. Each chunk must pass its required checks before commit/push/PR/merge and main synchronization. G08 prepares submission and DEPLOYMENT_GUIDE.md; production deployment is manual user action. No deployment has occurred.

## Current execution plan

| Chunk | Scope | Exit evidence |
|---|---|---|
| G00 | Requirements and architecture documentation | Approved 26 UD directions, empty unresolved register, documentation commit 9b9a7a3 and local main merge. |
| G01 | Next.js/TypeScript scaffold | Complete; commit 8bc0103, PR #1, main merge c8ec89b. Exact pins/tooling checks recorded in 14. |
| G02 | Supabase infrastructure | Complete; commit fff5167, PR #2, main merge 0ec4879. Factories/environment/CLI/read-only connectivity verified. |
| G03 | Domain schema, constraints and recipe seed | Complete; commit 1788109 including UI design documents, PR #3, main merge 97da2e7. Three migrations, ten tables/six enums, immutable evidence/default-deny grants, exact recipes, generated types and isolated/remote verification. |
| G04 | Identity, Access & Admin | Complete; 112 Vitest tests, 17 Playwright passes (one deliberate duplicate viewport skip), five-migration SQL suite/75 expected-error assertions and all required quality checks passed. Real email/password Auth, SSR cookies/Proxy, active profiles/exact RBAC, strict APIs/errors, three real demo personas, four role shells, synchronous admin creation/compensation, role/activity/audit, operator bootstrap and narrow forward identity grants. Final results in 14; no manufacturing workflow. |
| G05 | Cutting Supervisor Workflow | Supervisor-only order creation/preparation, bounded input validation, exact BOM multiplier/manifest, first-submit freezing, atomic submission and same-order re-cut preparation. Persistence, role/direct-API/RLS and transaction tests accompany implementation. |
| G06 | Verification & Gatekeeper | Verifier queue/terminal, explicit Save Counts, null versus zero, GREEN/YELLOW/RED, RED/missing/uncounted hard stop, reasoned rejection, immutable attempts/sign-off, creator separation and locked transactions. All gate/race/rollback/security tests. |
| G07 | Sewing & Full-System Hardening | Fixed VERIFIED-only queue/detail and Start Sewing fields retaining VERIFIED. End-to-end handoffs, re-cut, five assessment cases, direct database attacks, role/RLS review, responsive/contrast/accessibility audit and final system testing. |
| G08 | Deployment & Submission | Manual DEPLOYMENT_GUIDE.md, README/setup/schema/evaluator access, honest four-section AI_OPTIMIZATION_REPORT with two real flawed-code examples, atomic public history and local evaluator simulation. LIVE DEPLOYMENT remains pending human action. |

Admin was explicitly included in the user's G04 chunk; it does not acquire production authority. G05–G07 retain the approved manufacturing rules: integer counts, positive fabric with at most three decimals, YELLOW allowed, warning-only cap, signed fabric variance, same-order/new immutable re-cut attempts and VERIFIED-preserving sewing start. There is no generic status override.

## Historical milestone inventory

The original G00 plan used G00–G28 identifiers. That schedule remains historical evidence below, not the active execution queue. Its original G04 seed follow-up was already folded into G03; the later explicit G04 request consolidates original authentication/profile/RBAC/admin/shell/testing work. References in old completion records retain their original meaning.

<details>
<summary>Original G00–G28 milestone table (historical)</summary>

| Goal | Work | Exit evidence/dependencies |
|---|---|---|
| G00 | Requirements/architecture docs | Documentation review complete; no implementation. |
| G01 | Next.js/TypeScript repository scaffold | Complete; commit 8bc0103 merged into main through PR #1, merge c8ec89b. Exact versions pinned and all required scaffold checks passed; evidence in 14. |
| G02 | Supabase infrastructure foundation | Complete; commit fff5167 merged through PR #2, merge 0ec4879. Environment/client/CLI/connectivity checks passed; historical evidence in 14. |
| G03 | Database schema, constraints and recipe seed | Three migrations applied to cloud PostgreSQL 17.11; ten tables, six enums, restrictive FKs/CHECKs, default-deny RLS/grants, immutable evidence triggers, exact BOMs, CLI-generated types and isolated/remote verification. No approval/rejection RPC or application feature. Evidence in 14. |
| G04 | Exact recipe seed follow-up | The explicit G03 request includes both five-component BOM seeds, covering the original reference-data requirement here. A separate G04 request is still required before further work. |
| G05 | Supabase authentication | Verified server identity/session flow; three actual test personas. |
| G06 | Profiles/current roles | Protected role/activity, missing-profile deny, bootstrap approved. |
| G07 | Server authorization/errors/validation | Thin controllers/router, strict schemas, 401/403/404 model, no client authority. |
| G08 | Admin user management | Secondary to core work: temporary-password Auth creation then atomic profile/audit; cleanup attempt/error on profile failure; no async ledger or production authority. |
| G09 | Role shells/navigation/demo panel | Real sign-in; current server role; visible credentials panel; high contrast from start. |
| G10 | Supervisor order creation | Four required inputs; exact approved create/prepare semantics; persisted reload. |
| G11 | BOM multiplier/manifest | Server expectations complete; immutable input basis approved; unit tests. |
| G12 | Submit to verification | Atomic pending/attempt/item creation; revision checks. |
| G13 | Verification queue | Verifier-only scoped persisted query; no sewing/cutting bypass. |
| G14 | Terminal/count persistence | Null distinct from 0; save/conflict policy; strict actual counts. |
| G15 | Traffic-light engine | GREEN/YELLOW/RED correct; UI labels/disable behavior; unit coverage. |
| G16 | Hard-stop approval | Service rules plus locked atomic command; RED/missing/uncounted 422; race/rollback proof. |
| G17 | Rejection and re-cut | Mandatory reason; preserved closed attempt; fresh counts on resubmit. |
| G18 | Immutable sign-off | Exact verifier/time/component/fabric evidence; no app overwrite/delete; audit joins safe. |
| G19 | Sewing Queue | Fixed database VERIFIED filter and child/detail isolation; all nonsewing personas denied. |
| G20 | Start Sewing | Set sewing_started_at/started_by, retain VERIFIED/queue visibility; repeat/concurrent start checked. |
| G21 | RLS/grant hardening review | Review default-deny RLS/grants introduced at G03 and scoped policies/commands added with later authentication/features; direct DB/RPC attacks fail. Not the first security implementation. |
| G22 | Unit/API/database integration completion | Five assessment cases and adversarial/concurrency/rollback suite pass against real persistence. |
| G23 | Playwright journeys | Three persona handoffs, reload, errors, counts/re-cut/admin as applicable. |
| G24 | Contrast/accessibility/responsive audit | Inputs/dropdowns/all states; keyboard/focus; measured approved target. |
| G25 | Vercel deployment | Live testable URL; correct Auth redirects/secrets; cloud smoke tests pass. |
| G26 | Root README | Architecture, schema, setup/test instructions, three demo credentials, live URL. |
| G27 | Root AI Optimization Report | Four required sections with at least two evidenced real flawed AI-code/refactor examples. |
| G28 | Final evaluator simulation | Public atomic commits, tests, URL, persona demo, shortage gate, persisted handoff. |


</details>

## Assessment schedule and gates

**ASSESSMENT REQUIREMENT (section 13, p.5):** Four days / 28–32 focused hours. Day 1 establishes architecture/database/repository/cloud foundations; day 2 covers persona access and cutting creation/multiplier; day 3 covers verifier/gate/rejection; day 4 covers sewing/tests/contrast/AI report. These are relative assessment days, not an invented calendar deadline.

**DESIGN DECISION (approved UD-024):** The known schedule does not block architecture. Admin remains secondary to core assessment outcomes even though the user requested it inside G04. Release requires all five core cases, durable gate/audit/RBAC evidence, UI verification and the mandatory submission artifacts. Current G04 authentication/admin success does not imply full assessment completion.

Each chunk records actual checks/failures/fixes in [14](14_ARCHITECTURE_DECISIONS.md). [11](11_TEST_PLAN.md) preserves the full-system acceptance matrix. Applied SQL is immutable; any later database fix needs a forward migration. The continuation request explicitly authorizes the remaining chunks.
