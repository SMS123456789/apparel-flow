# AI Optimization Report

This report describes recorded ApparelFlow work, rather than invented failures.
The specification, approved decisions and milestone reviews are preserved in
[docs/14_ARCHITECTURE_DECISIONS.md](docs/14_ARCHITECTURE_DECISIONS.md).
G04–G07 implementation commits are `5cc1472`, `ca17f9d`, `380afce`, `6a94ea6`;
the G03 schema/forward whitespace fix is in `1788109`. Corrections made within a
chunk appear together in its final commit; they are not fabricated separate
historical commits.

## 1. Tools & Prompting

Codex was used as a repository coding agent with shell/Git, TypeScript, Supabase
CLI, PostgreSQL, Docker, Vitest and Playwright. Official Supabase/PostgreSQL/Next.js
references supported integration choices; official Vercel/Supabase documentation
was checked for the manual deployment guide. No Vercel deployment was executed by this implementation workflow; the user later supplied an existing production URL for verification.

The user supplied a concrete vertical implementation order and acceptance gates:
finish existing G04 rather than rebuild it, then Cutting Supervisor, Verification,
Sewing/hardening and submission readiness. Prompts established the architecture
`UI → Route → Controller → Service → Repository → Supabase`, strict server
identity, five assessment cases, immutable re-cut evidence, independent roles and
an explicit manual-deployment boundary. Root AGENTS.md requires the industrial
UI contract before frontend work. Approved business/security decisions outrank
existing generated code.

Work proceeded in bounded feature branches and PRs. Each chunk passed checks
before merge; evidence included actual cloud persona sessions and disposable
PostgreSQL transactions, not just mocked unit results. Schema/type generation
used CLI output. Environment credentials were read privately when needed, kept
ignored and excluded from logs/source/browser bundles. Browser Auth traces were
disabled. No parallel coding agents were used in this continuation.

The final assessment explicitly authorizes the three evaluator account pairs in
README. The credential scan allows those passwords only inside that marked
section; admin/infrastructure values remain excluded everywhere. A temporary live
inspection cleanup error emitted a demo-session cookie in tool output. The script's
asynchronous error handling was corrected, the inspection rerun, and demo Supervisor
refresh sessions revoked; no token was saved in repository artifacts.

### Subscription-cost estimate

The user estimates this project used approximately **15–20% of one weekly Codex allowance**. This is not measured token usage or metered billing. If a $100 subscription is conceptually divided across four weekly allowances, the approximate subscription-cost allocation is:

- `15 / 400 × $100 = $3.75`
- `20 / 400 × $100 = $5.00`

This $3.75–$5.00 estimate attributes part of a subscription to the project; it does not establish the actual marginal/API cost.

## 2. Flawed / Broken AI Code

### A. Rejection whitespace escaped the initial database constraint

The initial G03 schema used PostgreSQL's default `btrim` for rejection text.
Default trimming removes ordinary spaces, so tab/newline-only or Unicode-padded
reasons could satisfy the SQL guard despite the approved meaningful trimmed
reason rule. An actual isolated rejection regression failed before correction.

**Correction:** forward migration
[20261006155500_rejection_reason_whitespace.sql](supabase/migrations/20261006155500_rejection_reason_whitespace.sql)
uses the full ECMAScript `String.trim` whitespace set. The already applied base
migration was preserved. Tests cover tab/newline-only reasons, nonbreaking-space
padding and a trailing byte-order mark. G06's command and Zod schema repeat the
same trimmed 1–1000 character contract. This closes a database entry-path defect,
not merely a browser validation omission.

**Evidence:** [G03 actual fix](docs/14_ARCHITECTURE_DECISIONS.md#g03-completion-evidence),
[domain SQL tests](supabase/tests/domain_constraints.sql),
[verification SQL tests](supabase/tests/verification_gatekeeper.sql).

### B. The cutting command owner could not acquire a required row lock

The initial G05 restricted production role had SELECT/INSERT on attempts but
lacked the UPDATE privilege PostgreSQL requires for an existing trigger's
`SELECT ... FOR UPDATE`. Real first-submission SQL tests failed. A permissive
service-role write grant would have weakened the intended command boundary.

**Correction:** the reviewed G05 migration grants only `UPDATE(id)` on profiles
and attempts to the restricted NOLOGIN command owner. Existing identity/history
triggers reject changing those IDs; raw API roles still have no DML permission.
The row lock is available without profile-role/activity authority. The full SQL
suite then passed submission and injected-failure rollback.

**Evidence:** [cutting migration](supabase/migrations/20261006180000_cutting_supervisor_workflow.sql),
[cutting SQL tests](supabase/tests/cutting_workflow.sql),
[G05 review](docs/14_ARCHITECTURE_DECISIONS.md#g05-cutting-workflow-decisions).

### C. A BOM table expanded the mobile form grid

The generated G05 grid/form initially retained the table's intrinsic minimum
width. On mobile the page expanded, and pointer coordinates became unreliable.
A `window.innerWidth` comparison could miss that expansion. Real mobile browser
review exposed the defect.

**Correction:** shared grid columns use `minmax(0, 1fr)`, children use
`min-width: 0`, and horizontal scroll is confined to a labeled table region.
Overflow tests compare document `scrollWidth` with `clientWidth`. No force-click
or test suppression was used. Desktop/mobile create/edit/submit/reload journeys
then passed, followed by 1280/768/375/320 and 200% text-enlargement checks.

**Evidence:** [shared CSS](src/app/globals.css),
[cutting browser journey](tests/e2e/cutting.spec.ts),
[production UI review](tests/e2e/sewing.spec.ts), G05 review above.

Other recorded corrections include a nonexistent direct order-to-log foreign-key
projection (replaced with the real order → attempt → log relationship), unsupported
BigInt literal syntax under the existing ES2017 target (constructors retain exact
arithmetic), and G07's unqualified correlated policy columns (qualified before
cloud application and tested for approved-only re-cut children). Test helpers
also had real contract/assertion mistakes; those were corrected without weakening
authorization, database grants or UI requirements.

## 3. Human Refactoring

Human direction established the business constraints and review standard:
independent manufacturing/admin roles, no creator self-verification after role
change, explicit submit and Save Counts, same-order re-cut with new attempts,
immutable evidence, signed fabric variance, no cap gate and VERIFIED-preserving
sewing start. The user also made the industrial UI design document mandatory and
authorized sequential implementation/merges while reserving deployment.

Those decisions determine how generated work is refactored. Validation stays in
controllers, business rules in services, queries in repositories, and critical
writes in a single locked PostgreSQL command. A failing grant test is resolved
with a narrow lock permission rather than broader client writes. A failed mobile
interaction is resolved in shared layout rather than bypassing real input. A
schema correction uses forward history rather than rewriting an applied version.

The corrections described here were implemented by the coding agent under that
human direction. Repository evidence does not establish that a human manually
typed each patch. Human review can inspect the linked source, SQL and tests; the
report attributes requirements and implementation separately.

## 4. Defensive Architecture

- **Identity and separation:** server-confirmed Auth identity plus a fresh active
  profile; exact role checks in controllers/services and again under transaction
  locks. Client roles/IDs/timestamps/flags cannot grant authority. Admin has no
  production bypass and creators cannot verify their own order after reassignment.
- **Independent approval gate:** the service checks the full frozen manifest and
  saved count set; SQL repeats it under locks. Zero is a count, null is uncounted,
  YELLOW may proceed and RED/missing/uncounted returns 422. Cap excess does not
  gate approval. Strict schemas reject protected/unknown fields.
- **Atomic evidence:** approve/reject insert sign-off/count snapshots, close the
  attempt and change order state in one transaction. Audit failure rolls back the
  entire action. Re-cut preserves finalized evidence and creates fresh counts.
- **Restricted persistence:** user JWT/RLS reads, no anonymous business reads or
  raw client writes, named service-only invoker gateways, private restricted
  NOLOGIN owners and pinned empty search paths. Invoker views retain RLS and
  decimal precision. Sewing query/RLS hide unapproved orders and rejected history.
- **Conflict recovery:** shared profile/order locks and revisions serialize writes;
  repeated decisions/start return 409. The UI retains recoverable count entries
  for deliberate reread/Save Counts, without optimistic sign-off.
- **Evidence of behavior:** 227 Vitest cases cover domain/API layers; actual SQL
  tests cover all eight migrations, grants/RLS/rollback/immutability and four
  two-connection races. Real Playwright journeys have 29 passes plus one explicit
  duplicate viewport skip. Contrast, keyboard, responsive and persistence checks
  accompany a successful production build. Configured private values are absent
  from source/generated JS; the production dependency audit has zero findings.

Known limits are explicit: the full dev-tool audit retains nine high transitive
findings with no patched version listed in the [braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) checked on 2026-10-07, and ESLint 9 is EOL. Controlled
browser fixtures/audit remain under the no-hard-delete contract. Infrastructure
operators can act beyond application grants. The user subsequently supplied https://apparel-flow.vercel.app/ for live verification. The final report distinguishes that deployed version from this branch; local validation alone is not a live-release claim.
