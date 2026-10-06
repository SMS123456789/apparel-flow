# 16 - Submission and evaluator checklist

**Local/cloud-backed implementation: COMPLETE.**
**LIVE DEPLOYMENT: PENDING MANUAL USER DEPLOYMENT.**

Verified on 2026-10-07, Asia/Colombo. The production-mode browser server runs
locally while persistence/Auth use the configured assessment Supabase project.
No Vercel project/site/DNS was configured. Follow
[the manual deployment guide](../DEPLOYMENT_GUIDE.md) to finish the public URL.

## Assessment cases

| Case | Expected result | Executed evidence |
| --- | --- | --- |
| ASMT-01 | Authenticated verifier can approve all GREEN | `verification-api.test.ts`; `verification_gatekeeper.sql`; real three-persona `sewing.spec.ts` |
| ASMT-02 | Any RED blocks approval, including a direct request | Unit/service/API, SQL zero/shortage and real browser `verification.spec.ts`: 422; Approve disabled |
| ASMT-03 | Reject without meaningful reason fails | Strict API/schema and SQL whitespace regressions; real browser 422 and focused reason validation |
| ASMT-04 | Non-verifier approval returns 403 | All other roles through API guards; real Supervisor direct attack; SQL role/activity/creator guards |
| ASMT-05 | Unapproved work never reaches Sewing query | Fixed repository/view predicate; strict query filters; real RLS child tests and pending/rejected browser queue/detail isolation |

Additional executed cases: YELLOW eligible, null versus zero, missing components,
physical-defect rejection with GREEN, above-cap approval, signed negative fabric,
immutable prior rejection after re-cut, fresh blank attempt counts, current actor
and database timestamps, stale decisions, creator separation after role change,
repeat/concurrent assembly start and immutable attribution.

## Evaluator simulation

| Item | Result / evidence |
| --- | --- |
| Actual evaluator accounts | Bootstrap verifies active real Cutting Supervisor, Cutting Verifier, Sewing Supervisor and private admin; replay does not reset passwords |
| Public signup | Cloud Auth settings checked disabled by bootstrap; no public signup API/UI |
| Happy path | Supervisor UI create/submit → Verifier explicit counts/approval → Sewing approved evidence/start/reload, desktop/mobile |
| Rejection path | Saved zero/RED → direct approve 422 → reasoned reject → supervisor re-cut/resubmit → fresh recount/YELLOW approval → approved-only sewing/start/reload |
| RBAC/security | Current profiles, independent roles, wrong-role 403, strict identity/time/status DTOs, exact Origin, no raw DML/RPC, no admin manufacturing access |
| RLS/grants | Eight applied migrations match generated types/cloud catalog; ten tables, nine SELECT policies, restricted owners/views/commands |
| Transactions/races | SQL injected rollback plus actual dual-approve, count-approve, reject-approve, dual-start: exactly one winner and one stale conflict |
| UI/accessibility | 1280/768/375/320, measured text/control contrast, 16px count fields, 44px touch targets, 200% text enlargement, labels/errors/focus/dialog/Enter/reflow checks |
| Credentials | Seven configured private values absent from repository/generated JS; environment files ignored; private admin credentials unpublished |
| Required artifacts | Root README, four-section AI report with real evidenced failures, nine-section manual deployment guide |
| Public source | GitHub repository is PUBLIC; reachable Git history and PR/issue/comment metadata were audited before visibility changed |
| LIVE DEPLOYMENT | **PENDING MANUAL USER DEPLOYMENT**; requires user Vercel setup and public-URL smoke test |

## Quality results

- `npm ci`, typecheck, lint and format: pass.
- `npm test`: **215 tests, 13 files passed**.
- `npm run test:db`: **eight migrations, full SQL suite, four actual two-session races passed**.
- `npm run test:e2e`: **23 passed, one deliberate duplicate viewport review skipped**.
- `npm run build`: **pass**, including protected UI and all API routes.
- Cloud schema/history verification and real account bootstrap: **pass**.
- Private-value/browser-marker audit: **pass**; production npm audit: **zero findings**.

Full dev-tool audit retains nine high findings rooted in an unpatched braces
advisory; ESLint 9 emits an EOL notice. These are documented limitations rather
than a claim that the full audit is clean. Existing E2E records remain as
attributable history under the no-delete contract. One factory/read-only recipes/
assembly-start-only scope is intentional. Only LIVE DEPLOYMENT is pending.

## Repository milestones

| Chunk | Feature commit | Merged PR / main merge |
| --- | --- | --- |
| G04 | `5cc1472` | [#4](https://github.com/SMS123456789/apparel-flow/pull/4), `9a818fb` |
| G05 | `ca17f9d` | [#5](https://github.com/SMS123456789/apparel-flow/pull/5), `3845efa` |
| G06 | `380afce` | [#6](https://github.com/SMS123456789/apparel-flow/pull/6), `349ab61` |
| G07 | `6a94ea6` | [#7](https://github.com/SMS123456789/apparel-flow/pull/7), `bfa4446` |
| G08 | Submission artifacts and final evaluation | Documentation PR merges after these checks; [Git history](https://github.com/SMS123456789/apparel-flow/commits/main/) records its final hashes |

[Architecture decisions](14_ARCHITECTURE_DECISIONS.md) preserve actual chunk
failures, corrections and validation. Final user action: manually import merged
`main` into Vercel, configure the documented Production environment/Auth origin,
deploy, then complete the public smoke test and submit the resulting URL.
