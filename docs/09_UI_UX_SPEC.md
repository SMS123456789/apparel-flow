# 09 - UI and UX specification

**DESIGN DECISION (approved by user):** Next.js/React, Tailwind CSS, shadcn/ui; explicit Save Counts, email/password SSR cookie sessions, light desktop-first responsive UI. Frontend provides usability and invokes APIs; it cannot grant authority. Screen/layout/breakpoint/accessibility-check details below realize that approved direction.

## G04 implemented screens

Login/demo, four protected role shells, /admin users and /admin/audit follow [15](15_UI_DESIGN_SYSTEM.md). The users screen is a searchable/filterable paginated table with native dialogs, explicit submission, error focus, dirty-discard confirmation and guarded pending actions. Role shells display actual identity only. Production screens below remain G05–G07.

## Navigation and authentication

| Workspace | Screens | Visible actions |
|---|---|---|
| Auth/demo | Login; visible three-persona real sign-in panel | Real sign-in/sign-out; evaluator can authenticate each production account. |
| Cutting Supervisor | Cutting dashboard; Orders; Create Order; Prepared Detail; Rejected/Re-cut Detail | Create, prepare, submit, approved re-cut actions. No counts/sign-off/sewing navigation. |
| Cutting Verifier | Verification Queue; Verification Terminal; approved history scope | Count, save, approve/reject. No create/recipe-edit/sewing navigation. |
| Sewing Supervisor | Sewing Queue; Verified Batch Detail | Inspect immutable evidence; Start Sewing. No unverified searches/routes. |
| SYSTEM_ADMIN | Users; Create User; Administrative Audit | Create with email/full name/production role/temporary password; role/activity management; no production navigation. |

**ASSESSMENT REQUIREMENT (5, p.2):** Visible Role Switcher / Demo Credential Panel with real persona authentication. **DESIGN DECISION (approved by user, UD-015):** Three distinct real email/password accounts are available for evaluator sign-in. The explicit G04 request permits server-triggered authentication; the implemented panel shows three persona buttons while credentials remain server-side. Selection authenticates a different account and never edits role metadata. Public signup is disabled. Infrastructure/admin credentials stay private; flush user-scoped view/cache state on account change.

Global header shows authenticated name/role and sign-out. Unauthorized navigation receives safe access error from backend; hiding links is only usability. Expired session returns to login; inactive profile shows app access unavailable, even if an Auth session exists.

All production lists follow the current role across the single factory, with no creator-owned filter. A reassigned verifier's own-created order is read-only for verification; disable count/approve/reject controls with a separation-of-duties explanation. Server checks independently return 403.

## Cutting preparation

**ASSESSMENT REQUIREMENT (7.2, p.3):** Required recipe selector, target garment count, fabric roll ID, actual fabric yards. Show derived component expectations immediately and obtain canonical expectations from the server. Recipe selection shows name/code/category/rate/cap and exact grouped components.

Approved numeric input: positive integer target, positive fabric with at most three decimal places, and nonnegative integer component counts including 0. Zero target/fabric, fractional counts, and overprecision get immediate field errors. Recipe catalog is read-only; required BOM/expected quantities freeze when first submitted.

**DESIGN DECISION (implementation detail under approved UD-005):** Create Order saves CUTTING_IN_PROGRESS; separate Submit sends for verification. Preview is explicitly unsaved until server success. Preparation detail permits only recipe/target/roll/fabric before first submission; recipe/target freeze thereafter. Confirm submission because counts will be based on frozen requirements. Disabled actions have readable explanations.

Order list displays order number, recipe, target, cutting state, updated time. Rejected detail shows mandatory reason and earlier attempt evidence, plus Begin Re-cut. Re-cut preserves rejection history and requires a new verification attempt; recipe/target remain frozen, and previous attempts remain immutable under approved UD-006. No client state selector.

## Verification terminal

**ASSESSMENT REQUIREMENT (7.3-7.4, p.3):** Component-by-component actual counts, live GREEN/YELLOW/RED feedback, disabled Approve on RED, Reject with mandatory note.

**DESIGN DECISION (implementation detail):** Header shows order/recipe/target/fabric basis/current attempt. Table columns: component, expected, actual input, variance, status label. Null actual displays Not counted, never a default 0. Zero is explicitly counted and produces shortage when expected > 0.

| Status | Text shown | Presentation/approval consequence |
|---|---|---|
| GREEN | MATCH | Green indicator + text/icon; counted exact match. |
| YELLOW | EXCESS | Amber indicator + text/icon and signed surplus; may proceed if no other blocker. |
| RED | SHORTAGE | Red indicator + explicit missing quantity; Approve blocked. |
| Uncounted | NOT COUNTED | Neutral indicator; Approve blocked; not one of three assessed traffic lights. |
| Missing manifest item | INCOMPLETE DATA | Blocking integrity message; never silently omit row. |

**DESIGN DECISION (approved by user, UD-016):** Explicit Save Counts persists a nonempty subset through API. Show Unsaved/Saving/Saved/Error; approval disabled while any local changes are unsaved, save is pending, or revision is stale. Saving is not approval. Reload restores last saved counts; warn before discarding unsaved local edits. Autosave is outside the approved initial scope.

Approve uses saved server counts and current revision. UI enabled state means only local eligibility; server recomputes full gate. A backend 422 highlights affected components. A 409 prompts refetch and preserves local input for review without silently overwriting another verifier.

Reject dialog labels reason, trims it, requires 1-1000 characters, keeps note on failed request, displays 422 field errors, and submits once. Verifier may reject physical defects even with GREEN counts (UD-017). No extra defect percentages or override buttons.

## Sewing handoff

**ASSESSMENT REQUIREMENT (7.5, p.3):** Only VERIFIED orders, approved counts, verifier attribution, immutable time/variances/fabric wastage, Start Sewing Assembly.

Detail displays original signed-off values, including surplus and warning-only cap analytics. **DESIGN DECISION (approved by user, UD-007):** Start records sewing_started_at/started_by on the existing order; row remains VERIFIED with Started badge, repeat Start disabled/read-only. Empty queue says no verified batches available, not that hidden pending records exist. Search/pagination never enables unverified filters.

## Accessibility and contrast

**ASSESSMENT REQUIREMENT (11, p.5; 16, p.6):** Dark, legible input/dropdown text on light backgrounds across all states; no white-on-white defects; responsive layout and immediate inline errors.

**DESIGN DECISION (implementation detail under approved UD-026):** Light theme for initial evaluation; WCAG 2.2 AA as review target. Normal text target at least 4.5:1 and large text 3:1; apply contrast checks to actual input/search/dropdown/placeholder/error surfaces. [W3C contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum). Final conformity is not claimed by G00.

Use persistent labels, units in labels, keyboard navigation, visible focus, logical tab order, table headers, dialog focus/return, error associations, and polite save-status announcements. Status is always words plus color. Disabled/loading inputs remain legible even where standards permit exceptions. Do not use placeholder text as the only label.

Review layouts: desktop 1280px, tablet 768px, narrow mobile 375px; collapse nav, stack forms, preserve table labels/actions through accessible scroll/cards. These are implementation review sizes within approved desktop-first responsive scope; no dark mode is required. Optional images have component names as meaningful context and accessible fallbacks (UD-021).

## Loading, failures, and refresh

Every view includes loading, empty, validation, forbidden, expired-session, conflict, dependency failure, and unexpected-error states. Disable repeated submission while in flight. Do not optimistically announce VERIFIED or user activation before committed response. Retain user-entered fields after recoverable errors; use server request ID for support without exposing technical internals.

Refresh reads persistent data through API. Demo switch clears old account content. Table filtering/page changes preserve authorized scope; public/shared caches cannot hold role-specific results (UD-023).
