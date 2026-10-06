# 02 - Business rules

Classification follows [00](00_PROJECT_CHARTER.md). Services own business decisions; database constraints/transaction checks reinforce them. Zod handles input shape/basic ranges, not eligibility.

## Quantity engine and gate

| Rule | Classification/source | Definition |
|---|---|---|
| BR-001 | ASSESSMENT REQUIREMENT, 7.2 p.3 | Expected component count = target garment quantity times recipe pieces/garment; derive every component server-side. |
| BR-002 | ASSESSMENT REQUIREMENT, 7.3 p.3 | Actual = expected -> GREEN/MATCH. |
| BR-003 | ASSESSMENT REQUIREMENT, 7.3 p.3; approved UD-002 | Actual > expected -> YELLOW/EXCESS; eligible when all required components counted without shortage. |
| BR-004 | ASSESSMENT REQUIREMENT, 7.3 p.3 | Actual < expected -> RED/SHORTAGE; blocks approval. |
| BR-005 | ASSESSMENT REQUIREMENT, 9 p.4 | Missing/uncounted required component blocks approval with 422. Null actual is uncounted, not zero/GREEN. |
| BR-006 | ASSESSMENT REQUIREMENT, 7.4 p.3 | RED disables UI Approve; backend independently rejects it. Reject needs reason and returns batch for re-cut. |
| BR-007 | ASSESSMENT REQUIREMENT, 6/9 pp.2,4 | Authorized verifier signs off; identity/time server-derived. |
| BR-008 | ASSESSMENT REQUIREMENT, 7.5/9 pp.3-4 | Sewing database query fixes status = VERIFIED. |
| BR-009 | DESIGN DECISION, approved by user | Admin cannot manufacture, impersonate, force state, or bypass gate. |
| BR-010 | DESIGN DECISION, approved by user | Named backend actions; clients cannot assign protected production status. |
| BR-011 | DESIGN DECISION, approved UD-010 | Order creator cannot count/approve/reject that order even after role change. |
| BR-012 | DESIGN DECISION, approved UD-009 | Single factory; current role controls records, not creator-owned filtering or tenancy. |

**DESIGN DECISION (approved by user, UD-001):** Target and recipe multipliers are positive integers. Actual counts are nonnegative integers including 0. Actual fabric yards must be positive with at most three decimal places; neither target nor fabric may be 0. Strings, fractions for discrete counts, nonnumeric/empty/non-finite values, unsafe/overflow values, and coercions such as empty string -> 0 are rejected. Excess fabric precision is rejected, not silently rounded.

**DESIGN DECISION (implementation detail under approved UD-008/UD-016):** Check completeness against the frozen required-component manifest, not only rows that happen to exist. Require exact component-set equality, reject duplicate/foreign IDs, and derive expected/count flags from authoritative data. Deleting/omitting an item cannot make approval easier. Only RED/missing/uncounted block the quantity gate; authentication, authorization, legal state, and structural input validity are independently enforced.

## Fabric analytics

**ASSESSMENT REQUIREMENT (7.5, p.3):** Fabric wastage formula; expected multiplication/component signed variance implement the required analytics/audit.

```text
expectedFabricYards = targetQty × standardFabricYardsPerGarment
fabricWastagePct = ((actualFabricYards - expectedFabricYards) / expectedFabricYards) × 100
componentVariance = actualQty - expectedQty
```

Casual Blouse, target 50 -> expected 90 yards; actual 94.5 -> 5%. Cuffs expected 100/actual 103 -> +3/YELLOW.

**DESIGN DECISION (approved by user, UD-003/UD-004):** 5.0%/8.0% caps are warnings/analytics, not approval gates. Preserve signed negative fabric variance; never clamp to zero or use absolute value. Neither under-use nor cap excess adds a production rejection rule. Use positive denominator and decimal arithmetic; bounded storage/display conventions are in [06](06_DATABASE_DESIGN.md).

**DESIGN DECISION (approved by user, UD-017/UD-018):** Physical defects can justify verifier rejection even with GREEN counts. Every reason is trimmed, nonempty, maximum 1000 characters; invalid reason returns 422. No invented defect-rate threshold or override button.

## Workflow and immutable evidence

**DESIGN DECISION (approved by user, UD-005/UD-006/UD-008):** Create CUTTING_IN_PROGRESS, explicitly submit PENDING_VERIFICATION. Freeze recipe/target and snapshot full BOM/expected quantities at first submission. Re-cut reuses order and frozen requirements but creates a new verification attempt with fresh uncounted items. Previous attempts/logs stay immutable.

Per-attempt submitted fabric basis is an explicit implementation assumption so a later preparation edit cannot change earlier analytics. It does not change the formula or create another gate.

**ASSESSMENT REQUIREMENT (6, p.2):** Approval evidence includes verifier ID/time, component variances, fabric percentage and accompanies sewing. **DESIGN DECISION (approved UD-014):** No hard deletion; deactivate users. Finalized attempts, approval/rejection evidence, and audit are not overwritten. Snapshot labels/counts/fabric basis to preserve meaning after profile/reference changes.

**DESIGN DECISION (approved UD-007):** Start Sewing sets server sewing_started_at/started_by while order remains VERIFIED. No initial separate sewing production status or mutable queue-membership table.

**DESIGN DECISION (approved UD-011/UD-022):** Manually bootstrap first admin; normal APIs cannot create/promote another admin, deactivate/demote the actor, or self-assign production. Admin user creation uses email/full name/production role/temporary password through backend Auth creation then profile creation. If profile persistence fails, attempt cleanup of that newly created Auth identity and return error. This rollback cleanup is the narrow exception for an incomplete creation; established users/evidence are not hard-deleted.

## Atomicity and concurrency

**DESIGN DECISION (approved UD-012/UD-016/UD-019):** Critical transitions use PostgreSQL transaction/RPC only via services/repositories. Approval rereads authoritative DB counts under lock, verifies current actor/state/manifest, freezes audit, and sets VERIFIED atomically. No independent HTTP check-then-update sequence.

Common order locks/revisions are implementation details: one competing decision wins; stale/repeated state action -> 409, wrong role/creator -> 403, RED/missing/uncounted -> 422. Audit/transition failure rolls back the entire approval. Explicit Save Counts, no autosave, no approval of unsaved client data.
