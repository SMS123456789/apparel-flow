# 17 - Final assessment verification

Reviewed on **2026-10-07 (Asia/Colombo)** against the current repository and the
user-supplied authoritative application, **https://apparel-flow.vercel.app/**.
The repository branch is `feat/production-audit-loading`, based on main
`8e1f64b`; implementation commit `563ed71` contains the tested refinement. The existing production application is accessible and its manufacturing
workflow passes. The deployed version does not yet contain this branch's
Production Audit, favicon and loading refinements. Overall assessment sign-off
is therefore withheld. No Vercel deployment, project setting or DNS was changed.

## Requirement results

PASS below identifies the scope actually exercised. FAIL identifies a
required refinement that is implemented and verified locally but absent from
the deployed version. This is an existing-release version gap.

| Requirement | PASS / FAIL | Evidence |
| --- | --- | --- |
| Vercel deployment accessible | PASS | External `/` redirects to `/login`; application HTTP 200, title `ApparelFlow`, styles and scripts load without localhost. |
| Three real demo roles | PASS | Documented email/password credentials authenticate through `/api/auth/login`; each reaches its exact workspace. Fresh browser contexts avoid overlapping sessions. Demo buttons also use real Auth. |
| Cross-role denial / wrong-role approval | PASS | Live Supervisor direct approval returns 403; each persona's other-role reads return 403 and workspace navigation returns to its own workspace. Local API, SQL and browser tests include admin denial. |
| Persistence after refresh | PASS | Live order `AF-000000000062`: creation, explicit zero count, submission, rejection, re-cut, approval and sewing start survive page reload and authenticated API rereads. Separate cloud SELECTs confirm two attempts, two decisions and ten immutable component snapshots. |
| RED / shortage approval | PASS | Front Body Panel actual 0 against expected 5 renders `Shortage 5`; Approve disabled; direct live API returns 422 and state remains PENDING_VERIFICATION. |
| Uncounted approval | PASS | Direct live approval before counting returns 422. Local tests also exercise null and missing manifest items. |
| Rejection without reason | PASS | Missing, empty and whitespace-only live reasons each return 422; existing API and real SQL regressions agree. |
| GREEN and YELLOW approval | PASS | Existing all-GREEN mandatory test and real local browser/SQL handoff pass. Live second attempt uses Front actual 6 / expected 5, all other values match; YELLOW permits approval. |
| Sewing VERIFIED-only isolation | PASS | Live CUTTING_IN_PROGRESS, PENDING_VERIFICATION and REJECTED states each return empty searched queue and detail 404; after approval exactly one searched VERIFIED record returns. Injected `status` for all four states returns 422. An additional full live queue traversal checks 51 records across three pages: every status is VERIFIED. Frozen approval evidence matches field-for-field after sorting items by component ID. |
| Five mandatory automated cases | PASS | `npm test`: 227 tests / 15 files. Exact mapping below; original tests retained. |
| Numeric input guards | PASS | Existing client inline-feedback browser tests and strict schema/API/SQL tests reject negative/fraction/string/empty quantities. Live invalid target/fabric payloads return eleven 422 responses; negative/fraction/nonnumeric/empty/null count payloads return five 422 responses. Explicit component zero is valid and persisted live. Positive fabric decimals up to three places remain supported; 9.45 yards is persisted in the live second attempt. |
| UI contrast / legibility | PASS | Existing live screens: 52 computed checks / 13 screens at 1280, 768, 375 and 320px; minimum text 6.10:1, control boundary 4.39:1, no page overflow. Current local branch adds Production Audit review, for 56 checks / 14 screens. Production Audit availability is reported separately below. Existing browser tests cover options, placeholder, focus, invalid, readonly, disabled, keyboard and 200% text sizing. |
| Requested loading states | FAIL | Local static skeletons, accessible busy status, precise guarded pending labels, stable button width, retained rows and safe error recovery pass on desktop/mobile. A held real live order response shows `Loading orders…`, zero skeleton rows and no table `aria-busy`; held demo sign-in has no status region. Publishing this branch is required to verify the requested refinements live. |
| Favicon / page title | FAIL | Title passes live. Local `/icon.svg` returns 200 with SVG content type and App Router icon metadata. Production has no `rel="icon"` metadata link. |
| Administrative Audit | PASS | Live `/api/admin/users` and `/api/admin/audit` return 200 to private admin; existing before/after account evidence expands in UI. Existing local tests verify guarded admin actions, immutable audit and current authority. |
| Production Audit | FAIL | Local admin-only GET and page pass; all six workflow records and exact immutable decision/batch evidence are present. Production `/api/admin/production-audit` returns 404. No production mutation authority was added. |
| Production verification audit | PASS | Live order has persisted verifier ID/name, decision/time, expected/actual counts, signed variances, rejection reason and exact 5% fabric wastage. SQL guards/transaction tests reject overwrites; normal application actions retain prior rejection after re-cut. |
| Security sanity | PASS | Fresh profiles, strict actor/time/status DTOs, Origin checks, fixed sewing view/RLS, no signup UI/API or generic status setter; fresh cloud `/auth/v1/settings` read confirms `disable_signup: true`. Private admin/infrastructure values absent from repository/generated JS, reachable history, checked live API responses/HTML/scripts. |
| README | PASS | Actual production URL, overview/stack/layers/schema/Auth/RBAC/setup/env/migration/test/deployment instructions and three explicitly requested evaluator credentials. Private admin remains excluded. |
| AI_OPTIMIZATION_REPORT.md | PASS | Four required sections, three evidenced defects linked to migration/source/test/history, human-direction attribution, approximate $3.75–$5 subscription allocation clearly labeled an estimate. |
| Git history | PASS | Understandable G00–G08 and UIX01 feature commits/PR merges; no history rewritten. 339 reachable blobs/commits/tags scanned before current branch commit. |
| Production build / full quality suite | PASS | Node 22.23.2 / npm 10.9.8; exact command results below. Existing business APIs/services, migrations, generated DB types, dependency pins and original tests preserved. |
| Full local E2E | PASS | 29 passes / one existing duplicate viewport-review skip across Chromium and Pixel 7. Both happy path and shortage → rejection → re-cut → YELLOW approval → sewing start are real cloud-backed flows. |
| Live end-to-end workflow | PASS | Controlled `ASSESSMENT-LIVE-` order completed through production URL; refresh, direct API guards and separate cloud persistence checks pass. Test audit remains under the no-delete contract. |

## Exact automated evidence

| Mandatory case | Exact test / file |
| --- | --- |
| All GREEN authenticated approval | `ASMT-01: authenticated verifier approves all GREEN` — `tests/integration/verification-api.test.ts` |
| RED hard stop | `ASMT-02: RED blocks approval with affected components` — `tests/integration/verification-api.test.ts` |
| Meaningful rejection reason | `ASMT-03: rejection without meaningful reason returns 422` — `tests/integration/verification-api.test.ts` |
| Non-verifier 403 | `ASMT-04: %s receives 403 even for malformed approval` (Cutting Supervisor, Sewing Supervisor, SYSTEM_ADMIN) — `tests/integration/verification-api.test.ts` |
| Sewing query isolation | `ASMT-05: repository always fixes VERIFIED despite injected status` — `tests/unit/sewing.test.ts`; reinforced by real `supabase/tests/sewing_workflow.sql` RLS and `tests/e2e/sewing.spec.ts` / `verification.spec.ts`. |

| Command | Executed result |
| --- | --- |
| `npm ci` | PASS, clean lockfile install; dependency pins unchanged. |
| `npm run typecheck` | PASS. |
| `npm run lint` | PASS, zero warnings. |
| `npm run format:check` | PASS. |
| `npm test` | PASS, 227 tests across 15 files. |
| `npm run test:db` | PASS, all eight migrations and full SQL constraints/grants/RLS/rollback/immutability suite; four real two-session races each have one commit and one stale conflict. Disposable database only. |
| `npm run test:e2e` | PASS, 29 tests and one intentional duplicate viewport-review skip. Includes `npm run build` and production-mode local server. |
| `npm run build` | PASS, protected UI/API routes plus `/admin/production-audit`, its GET API and `/icon.svg`. |
| `npm run supabase:schema:verify` | PASS, eight local/remote migration versions and cloud catalog match; no schema change. |
| `node --import tsx scripts/audit-private-values.ts` | PASS, repository/server/browser generated code checked; only explicitly authorized evaluator passwords inside the marked README section are exempt. |
| `npm audit --omit=dev` | PASS, zero vulnerabilities. |

The full development-tool install reports nine high transitive findings and the
inherited ESLint 9 EOL notice. The [current braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) lists no patched version on 2026-10-07; npm proposes breaking tool downgrades. Those existing dependency limitations remain
visible; the production audit result does not claim the full dev audit is clean.

## Persisted production evidence

- Order: `AF-000000000062`, ID `2fa2534d-4f1d-4d78-8a65-d73bd083994b`.
- Roll: `ASSESSMENT-LIVE-2026-10-07T04-43-56-312Z`; second attempt appends `-RECUT`.
- Five blouses: expected fabric 9 yards, Sleeve Cuffs 10 pieces.
- Attempt 1 rejection: `808edb4a-bea2-47a9-980f-335484438221`,
  `2026-10-07T04:44:58.861008+00:00`, persisted zero/RED and reason.
- Attempt 2 approval: `efdb5b22-de74-44fd-9cf2-522a8fbd80c4`,
  `2026-10-07T04:45:45.843523+00:00`; actual fabric 9.45 yards,
  exact wastage `5.000000000000`; one YELLOW and four GREEN components.
- Sewing start: `2026-10-07T04:46:05.005286+00:00`, authenticated sewing actor,
  order remains VERIFIED; repeated direct start returns 409.

Independent read-only cloud confirmation checks `cutting_orders`,
`verification_attempts`, `verification_logs` and `verification_log_items`.
Fresh-session rereads compare the sewing evidence with the approved log using
component identity, preserving every value despite different display ordering.

## Review corrections and release boundary

Real browser review found that the sewing view requires a sewing-role JWT even
for a service-role read. The new admin projection now reads the existing
VERIFIED order start fields and verifies their approved attempt/log linkage.
The original sewing view, RLS and commands remain unchanged. Test assertion
corrections preserve exact evidence values and target actual data/error rows,
avoiding static skeletons and Next.js's separate empty route-announcement alert.
The complete suite was rerun after those fixes. Screenshot inspection also caught narrow role labels beside the reserved sign-out button width; the mobile header now puts identity/role on a separate row at widths up to 480px.

A temporary inspection-script cleanup error printed a demo-session cookie in tool output. Its asynchronous request error handling was corrected and the inspection rerun successfully. Demo Supervisor refresh sessions were revoked afterward; account credentials and production data were unchanged. No token was written to repository artifacts.

Local and live screenshots/check summaries are private verification artifacts in
`/tmp/apparel-flow-polish/`; credentials and Auth traces are excluded. This is
scoped application review, not a formal independent accessibility certification.
The existing release is functioning. Publishing the tested refinement branch and
rechecking its Production Audit, favicon and loading states is the remaining
release step. The user explicitly reserved deployment; this verification did not
publish, replace or reconfigure the existing Vercel application.
