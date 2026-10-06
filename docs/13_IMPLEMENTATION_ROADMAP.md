# 13 - Gated implementation roadmap

**DESIGN DECISION (approved by user):** G00 ended at documentation and local Git work. Explicit G01/G02 requests authorized scaffolding/infrastructure; both are now merged. The subsequent G03 request authorizes schema, exact recipe seeds, remote migration application, generated types, and verification on a new branch. G04 and later work, user provisioning, application features, and deployment await separate instructions.

## G00 exit and implementation entry

G00 output is all fifteen documents, traceable assessment rules, approved architecture/interpretations, all 26 approved UD directions, an empty [UNRESOLVED_DECISIONS](14_ARCHITECTURE_DECISIONS.md#unresolved_decisions) register, and the authorized initial branch commit/local main merge.

**DESIGN DECISION (approved by user):** Decisions are approved; schedule is not an architecture blocker. Separate G01/G02/G03 instructions have been received. Actual implementation evidence is recorded in [14](14_ARCHITECTURE_DECISIONS.md#g03-database-foundation-decisions). No approved item remains gated by the old proposal register. G03 stops before G04.

## Future goals and acceptance gates

Goal numbering preserves identifiers, not mandatory execution priority. Admin G08 is secondary and follows validation of core production/gate/handoff work. Contents/sequencing are **DESIGN DECISION (implementation plan)**; tests/security are integrated early instead of postponed to the end.

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

G18 audit is designed/implemented with G16 transaction, not added after a status-only approval. G22/G23 complete tests developed throughout earlier goals. G03 introduces default-deny RLS/grants, not premature role policies or approval RPCs. G21 revisits security introduced with the earlier schema/features.

## Assessment's four-day schedule

**ASSESSMENT REQUIREMENT (section 13, p.5):**

| Relative day | Assessment milestone | Roadmap alignment |
|---|---|---|
| Day 1 | Architecture, database, repository, recipe seed, cloud skeleton | G00-G07/G04 and early deployment preparation; approved architecture used; package versions chosen/pinned during setup. |
| Day 2 | Role switcher, order modal, multiplier, validation | G09-G12; continue integration checks. |
| Day 3 | Verifier workspace, lights, server hard stop, rejection | G13-G18 with atomic/audit tests. |
| Day 4 | Sewing, automated tests, contrast, AI report | G19-G28, submission and evaluator audit. |

**DESIGN DECISION (approved by user, UD-024):** Four days/28-32 focused hours are the known assessment schedule. Scheduling is not an architecture blocker; admin work stays secondary to production/gate/RBAC/tests/contrast. Relative days do not invent a calendar deadline.

## Risk-driven gates and evidence

**DESIGN DECISION (implementation detail):** Implement the approved transactional/RLS/creator-separation safeguards before exposing mutations. Match approved numeric/fabric/reason semantics in forms/server schemas. Test same-order immutable re-cut and VERIFIED-preserving start. Test synchronous admin creation/cleanup after core work.

Release requires proved gate/security/data integrity and all mandatory submission items; there are no remaining UD architecture blockers. Each milestone records actual changes and test evidence, not only a status label. No tests, migrations, setup, deployment, or G01 actions were performed by this G00 plan.
