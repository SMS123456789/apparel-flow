# 00 - Project charter

**Status:** G00–G07 are merged into main. G08 submission artifacts and final evaluator checks are complete before its merge. Cutting, verification, re-cut and verified-only sewing are implemented. **LIVE DEPLOYMENT: PENDING MANUAL USER DEPLOYMENT.** See [16 Submission checklist](16_SUBMISSION_CHECKLIST.md) and [the deployment guide](../DEPLOYMENT_GUIDE.md).
**Reviewed/approved:** 2026-10-06, Asia/Colombo.
**Sources:** *ApparelFlow ERP - Software Engineering Practical Challenge*, Webtezza (Pvt) Ltd, all six pages/sections 1-16; original G00 request; user's decision-approval table; subsequent synchronous admin-creation clarification.

## Objective and scope

**ASSESSMENT REQUIREMENT:** A persistent authenticated Cutting Operations & Gatekeeper Verification Terminal prevents unverified/shortage batches from reaching sewing. Scope includes seeded recipes, cutting orders, component multiplication/counting, approval/rejection/re-cut, immutable sign-off, fabric variance, and a VERIFIED-only Sewing Queue.

**APPROVED EXTENSION:** SYSTEM_ADMIN manages production users/roles/account activity and administrative audit only. It cannot manufacture, impersonate, force production state, or inject queue entries.

**DESIGN DECISION (approved by user):** Next.js, TypeScript, Supabase PostgreSQL/Auth/RLS, server RBAC, Zod, Tailwind CSS, shadcn/ui, Vitest, Playwright, Vercel, Next.js Route Handlers, layered modular monolith. No Prisma/Auth.js.

**DESIGN DECISION (approved by user):** G00 updated exactly the fifteen Markdown documents and recorded the first commit on a new branch merged locally into main. Its documentation-only restriction remains the historical G00 boundary. The subsequent explicit G01 request authorizes application/tooling scaffolding on a new branch, with no Supabase connection, migrations, authentication, production features, or G02.

**DESIGN DECISION (approved by user):** The subsequent explicit G02 request authorizes merging the previous G01 PR, then Supabase infrastructure, environment validation, client factories, CLI conventions, and non-mutating connectivity checks. G02 stops before G03: no business tables, seeds, authentication flows, RBAC/RLS policies, admin features, or production APIs.

**DESIGN DECISION (approved by user):** The subsequent explicit G03 request authorizes version-controlled schema/constraints, default-deny RLS/grants, immutable evidence foundations, exact assessment recipe seeds, remote application, generated types, and database verification. It stops before G04 and does not authorize authentication flows, role policies/services, production APIs/UI, admin features, or approval/rejection RPCs.

**ASSESSMENT REQUIREMENT:** The full 23-module ERP is outside scope. **DESIGN DECISION (implementation scope):** Inventory accounting, payroll, purchasing, shipping, sewing execution beyond Start Sewing, recipe editing, and unrequested reporting/real-time systems are excluded. Single factory, no tenancy. Admin remains secondary to core assessment work.

**DESIGN DECISION (explicit G04 request):** Implement real Supabase authentication, SSR cookies/Next.js Proxy, current-profile RBAC, three real demo personas, protected role shells and the synchronous admin extension. The user authorized generating private bootstrap credentials in ignored .env.local and confirmed disabling cloud public signup; the setting was verified through Auth settings. G04 stops before production workflows. Its controlled operator bootstrap creates the initial admin through Supabase Admin Auth; no normal UI/API can create another admin.

## Evidence and classification

A classification on a paragraph/table/section applies to its entries unless overridden.

| Label | Meaning |
|---|---|
| ASSESSMENT REQUIREMENT | Explicit in the PDF, cited by section/page. |
| DESIGN DECISION (approved by user) | Approved in original request, decision table, or admin-creation clarification. |
| APPROVED EXTENSION | User-added SYSTEM_ADMIN scope, not an assessment production persona. |
| DESIGN DECISION (implementation detail/process/scope) | Technical realization within approved direction; not a new manufacturing rule or architecture blocker. |
| PROPOSED ASSUMPTION | Explicit implementation interpretation, not an assessment requirement. |
| UNRESOLVED | Requires human approval; only the canonical register may record open decisions. |

All 26 historical UD IDs now have approved directions in [APPROVED_DECISIONS](14_ARCHITECTURE_DECISIONS.md#approved_decisions). [UNRESOLVED_DECISIONS](14_ARCHITECTURE_DECISIONS.md#unresolved_decisions) is empty. Exact G01 package/configuration choices are recorded in [G01 scaffold decisions](14_ARCHITECTURE_DECISIONS.md#g01-scaffold-decisions), and infrastructure choices in [G02 Supabase foundation decisions](14_ARCHITECTURE_DECISIONS.md#g02-supabase-foundation-decisions). G03 schema, G04 identity/admin and G05–G07 manufacturing transactions/read policies are implemented; their locked commands preserve the approved architecture. Each milestone's authorization comes from its explicit user request.

## Deliverables and reading map

| Document | Purpose |
|---|---|
| [01 Requirements](01_REQUIREMENTS.md) | Assessment traceability, acceptance criteria, seeds, submission obligations. |
| [02 Business rules](02_BUSINESS_RULES.md) | Quantity gate, fabric analytics, protected values, sign-off. |
| [03 Roles and permissions](03_ROLES_AND_PERMISSIONS.md) | Factory role permissions and creator/verifier separation. |
| [04 State machine](04_STATE_MACHINE.md) | Cutting/submission/decision/re-cut/sewing-start transitions. |
| [05 Domain model](05_DOMAIN_MODEL.md) | Aggregates, immutable evidence, layer responsibilities. |
| [06 Database design](06_DATABASE_DESIGN.md) | Auth/profile mapping, relational model, bounds, atomic RPC. |
| [07 Auth/security/RBAC/RLS](07_AUTH_SECURITY_RBAC_RLS.md) | Cookies, identity, policies, origin protection, elevated contexts. |
| [08 API contract](08_API_CONTRACT.md) | Stable routes, payloads, synchronous admin creation, errors. |
| [09 UI/UX](09_UI_UX_SPEC.md) | Production screens, explicit saves, light accessible UI. |
| [10 Admin panel](10_ADMIN_PANEL_SPEC.md) | Temporary-password creation, cleanup/error behavior, audit. |
| [11 Test plan](11_TEST_PLAN.md) | Required tests plus security/transaction/creation-failure checks. |
| [12 Engineering rules](12_CODEX_ENGINEERING_RULES.md) | Architecture/approval boundaries and engineering discipline. |
| [13 Roadmap](13_IMPLEMENTATION_ROADMAP.md) | Completed chunk sequence and historical milestone inventory. |
| [14 Architecture decisions](14_ARCHITECTURE_DECISIONS.md) | Approved register, interpretations, logical diagram. |

## Success measures and constraints

**ASSESSMENT REQUIREMENT:** Evaluator can sign in as each production persona, create/submit, observe UI/API shortage blocking, approve valid counts, see the batch in sewing, and refresh without loss (16, p.6). Rubric: domain 15%, hard stop 20%, roles 15%, database/architecture 15%, UI 15%, tests 10%, AI candor 10% (15, p.6).

**ASSESSMENT REQUIREMENT:** Final submission needs live public cloud URL, public GitHub with atomic commits, root README architecture/schema/three demo credentials, runnable passing tests, and four-section AI_OPTIMIZATION_REPORT.md with two actual flawed AI-code examples (12/14, pp.5-6). G00 records these obligations without claiming an application exists.

**DESIGN DECISION (G04 evaluator access, ADR-040):** README documents the three real demo persona buttons. Each authenticates its distinct Supabase account using private server configuration; passwords remain in ignored local/Vercel configuration. The assessment credential wording above remains recorded; implemented evaluator access follows the approved G04 real-account flow. SYSTEM_ADMIN credentials are never public.

**ASSESSMENT REQUIREMENT:** Four calendar days from issue date, 28-32 focused hours (p.1; 13, p.5). **DESIGN DECISION (approved by user, UD-024):** This schedule is not an architecture blocker; admin is secondary. Use relative milestone days without inventing a calendar deadline.

## Assessment interpretations resolved

The user's approvals settle integer quantities/positive three-decimal fabric, allowed YELLOW, warning-only wastage caps, preserved negative variance, Auth-managed credentials, same-order re-cut/new attempts, role-based factory visibility, and VERIFIED-preserving sewing start. Manual admin bootstrap and permanent creator/verifier separation preserve manufacturing isolation. Document 14 retains the original wording and approved interpretations for traceability.
