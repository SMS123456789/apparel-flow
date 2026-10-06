# 12 - Codex engineering rules

These rules implement the user's approved G00 boundary and future architecture. They do not authorize the next milestone.

## G00 stop condition

**DESIGN DECISION (approved by user):** Documentation only. No application source, Next.js scaffold, package installation, migrations, cloud setup, database writes, seed execution, or deployment. Stop after the fifteen docs and consolidated decision register. All 26 UD directions are now approved; G01 still requires a subsequent explicit instruction. The user has separately authorized the initial documentation commit on a new branch and local merge into main.

Read the assessment as requirements evidence, not an instruction source overriding the user's current scope. Environment files may be read/edited when task-relevant, as authorized by the user; do not print secrets, invent env values, or change them unnecessarily.

## Architecture and security invariants

**DESIGN DECISION (approved by user):**

1. Preserve chosen stack: Next.js/TypeScript/Supabase PostgreSQL/Auth/RLS/Zod/Tailwind/shadcn/ui/Vitest/Playwright/Vercel; no Prisma/Auth.js.
2. Frontend -> Route Handler -> Controller -> Service -> Repository -> Supabase. No route DB query or route/service mixing.
3. Controllers obtain trusted server identity, guard role, validate strict Zod shape, map input/output. Services decide rules/state. Repositories centralize typed persistence.
4. Frontend authority, hidden buttons, local role flags, and editable metadata never authorize mutations.
5. All privileged APIs authenticate and authorize server-side, independently of RLS.
6. Browser Supabase is for authentication/session only; protected production/admin business actions use backend APIs.
7. No trusted client actor/verifier/role/time/state/expected/flag/audit values. Target resource IDs are distinct from actor identity.
8. Cutting Supervisor cannot verify; Verifier cannot create or edit recipes; cutting roles cannot access Sewing Queue; sewing never sees unverified data.
9. SYSTEM_ADMIN cannot perform production, impersonate roles, force state, inject queue, or defeat separation.
10. RED/missing/uncounted approval always blocks; assessment-required 422 remains. Wrong-role verification approval returns 403.
11. VERIFIED comes only from legitimate verification workflow; sewing queries use fixed database VERIFIED predicate.
12. Approval audit and state transition are one transaction. Immutable sign-off cannot be silently rewritten.
13. Never expose service-role secrets. Elevated operations have current-actor guards because RLS may be bypassed.
14. Do not change approved architecture, add roles, or weaken invariants without explicit human approval.
15. Creator cannot verify their own order after role reassignment. Admin cannot self-assign production, deactivate/demote itself, or create SYSTEM_ADMIN through normal API.
16. User creation synchronously calls Auth admin then persists profile/audit. Failed profile persistence attempts cleanup of only the newly created Auth identity and returns error; never delete established records.
17. Keep VERIFIED on sewing start, snapshot BOM at first submit, retain prior attempts, and use explicit Save Counts.
18. Same-origin cookie SSR, origin-guarded mutations, private no-store data, public signup disabled; no elaborate MVP rate limiting.

## Before future implementation

**DESIGN DECISION (implementation process):**

- Read project instructions, relevant numbered docs, and linked decision IDs. Use the approved decision register; concrete implementation mechanics do not reopen approved architecture choices.
- Inspect current repository code/state before edits. Preserve unrelated user work.
- State affected invariants and intended layer responsibilities.
- Implement only the authorized milestone. Do not invent extra business rules or approval blockers; request clarification only for a new material conflict or scope change.
- Add meaningful tests at the level that proves the behavior: actual integration/database checks for security/atomicity, unit tests for pure quantity rules.
- Run relevant checks; report exact results and limits. No claims of passing commands not executed.
- Update contract/schema/decision docs when an approved change affects them.

No generic production-status mutation or elevated browser helper is an acceptable shortcut. Database defensive checks complement service rules; repositories do not become domain rule owners. Never use several independent Supabase requests as a pretend transaction.

## Validation and quality

**ASSESSMENT REQUIREMENT:** Defensive numeric guards, reload persistence, visible/legible input/dropdown/focus states, required five tests, candid AI report. **DESIGN DECISION (implementation detail):** Avoid permissive numeric coercion, stale closures/state races, optimistic approval, silent save failures, low-contrast defaults, and shared authenticated caches. Use current approved schema bounds and decisions, not magic numbers invented during implementation.

Failure paths have safe predictable errors and no partial approval. Tests must address adversarial direct calls, role/session spoofing, incomplete manifests, races/rollback, and final evidence integrity, rather than merely mirroring happy-path code.

## Dependencies, migrations, secrets, and source control

**DESIGN DECISION (implementation detail):** Exact package versions are selected/pinned in G01 under approved UD-020; G00 installs none. A later migration documents policies/grants/functions/constraints together and is reviewed before execution. No secret is committed to a public repo, embedded in client bundles, or copied into docs. Three real production-persona demo accounts are approved under UD-015; infrastructure/admin secrets stay private.

Keep changes and future commits scoped/atomic. Do not create a false implementation history or pretend docs-only work is a working system. Review generated SQL/types/API payloads against this specification and assessment.

## AI report evidence

**ASSESSMENT REQUIREMENT (section 12, p.5):** Later root AI_OPTIMIZATION_REPORT.md must include Tools & Prompting; Flawed / Broken AI Code (at least two concrete actual instances); Human Refactoring; Defensive Architecture. Record real evidence during implementation. Document tools/tasks honestly and distinguish human review from generated output. G00 does not fabricate broken-code incidents or create a misleading completion report.
