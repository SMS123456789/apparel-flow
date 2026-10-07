# 16 - Submission and evaluator checklist

**Current repository checks: PASS. Existing production workflow: PASS.**
**Final assessment sign-off: withheld for deployed-version gaps.**

The authoritative production application is https://apparel-flow.vercel.app/.
It was exercised independently of localhost on 2026-10-07. The current branch's
Production Audit, favicon and loading refinements have not been published there.
See [17 Final assessment verification](17_FINAL_ASSESSMENT_VERIFICATION.md) for
the complete PASS/FAIL table, exact mandatory test names, live record evidence
and quality-command results. No replacement deployment or Vercel/DNS change was
performed. [DEPLOYMENT_GUIDE.md](../DEPLOYMENT_GUIDE.md) documents reproducibility.

## Submission checks

| Item | Result / evidence |
| --- | --- |
| Three evaluator accounts | Real Supabase Auth credentials in README; each exact workspace and cross-role 403 verified locally and live. Private admin credentials excluded. |
| Five mandatory cases | Existing ASMT-01–05 pass; exact mapping in the final report. |
| Full evaluator workflow | Both local/browser and controlled live shortage/reject/re-cut/YELLOW approve/sewing-start flow pass; refreshed data matches cloud records. |
| Sewing isolation | All three unapproved states absent from live queue/detail; unsupported status filters return 422. Verified detail exposes exact approved evidence. |
| Numeric guards | Strict inline/API/SQL validation; component zero accepted; positive fabric supports up to three decimals. |
| Audit | Immutable production sign-off and account audit pass. New read-only Production Audit passes locally; deployed API returns 404. |
| UI | Desktop/tablet/mobile contrast and reflow pass on available live screens and local branch. Requested new loading/favicon refinement awaits publication of this branch. |
| Quality | 227 Vitest tests / 15 files; 29 Playwright passes / one existing viewport skip; eight-migration SQL suite / four real races; ci/typecheck/lint/format/build pass. |
| Credentials / security | Configured private values excluded from bundles/source/history; env files ignored. Only the three explicitly requested evaluator pairs are published in the marked README section. |
| Submission files | README, four-section factual AI report with cost estimate, deployment guide and final assessment report updated. |
| Git history | Public source contains readable G00–G08 and UIX01 commits/PR merges. Refinement commit `563ed71` is on a separate branch. |

The production dependency audit reports zero findings. The inherited full
development-tool audit still has nine high transitive findings and ESLint 9 is
EOL. Attributable browser fixtures and the controlled live order retain their
audit evidence under the no-hard-delete contract.

## Repository milestones

| Chunk | Feature commit | Merged PR / main merge |
| --- | --- | --- |
| G00 | `9b9a7a3` | Approved requirements and architecture |
| G01 | `8bc0103` | [#1](https://github.com/SMS123456789/apparel-flow/pull/1), `c8ec89b` |
| G02 | `fff5167` | [#2](https://github.com/SMS123456789/apparel-flow/pull/2), `0ec4879` |
| G03 | `1788109` | [#3](https://github.com/SMS123456789/apparel-flow/pull/3), `97da2e7` |
| G04 | `5cc1472` | [#4](https://github.com/SMS123456789/apparel-flow/pull/4), `9a818fb` |
| G05 | `ca17f9d` | [#5](https://github.com/SMS123456789/apparel-flow/pull/5), `3845efa` |
| G06 | `380afce` | [#6](https://github.com/SMS123456789/apparel-flow/pull/6), `349ab61` |
| G07 | `6a94ea6` | [#7](https://github.com/SMS123456789/apparel-flow/pull/7), `bfa4446` |
| G08 | `414e222` | [#8](https://github.com/SMS123456789/apparel-flow/pull/8), `8800e76` |
| UIX01 | `91f33c1` | [#9](https://github.com/SMS123456789/apparel-flow/pull/9), `8e1f64b` |

[Architecture decisions](14_ARCHITECTURE_DECISIONS.md) preserve historical
milestone evidence. The final report supersedes historical statements that no
production URL exists while retaining those records as project history.
