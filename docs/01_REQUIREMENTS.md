# 01 - Requirements and assessment traceability

Classification follows [00](00_PROJECT_CHARTER.md). This matrix defines future acceptance criteria; G00 delivers documentation, not an application. Planned tests are defined in [11](11_TEST_PLAN.md).

## Functional and security requirements

**ASSESSMENT REQUIREMENT** applies to every REQ row.

| ID | Source | Requirement and observable acceptance criterion | Planned verification |
|---|---|---|---|
| REQ-001 | Sections 4-5, p.2 | Real authentication supports three production personas; visible role/demo credential panel lets evaluator log in as each. | AUTH-01, UI-01 |
| REQ-002 | Section 5, p.2 | Supervisor creates orders/tracks cutting; cannot verify or access Sewing Queue. | RBAC-01 |
| REQ-003 | Section 5, p.2 | Verifier counts and approves/rejects; cannot create orders, edit recipes, or access Sewing Queue. | RBAC-02 |
| REQ-004 | Section 5, p.2 | Sewing sees verified batches/attribution and starts sewing; never sees unverified/pending/rejected orders. | RBAC-03, SEW-01 |
| REQ-005 | Section 7.1, p.3 | Database contains at least both exact recipes/BOMs below. | DATA-01 |
| REQ-006 | Section 7.2, p.3 | Creation requires Recipe ID, Target Batch Quantity, Fabric Roll ID, Actual Fabric Used in yards. | ORDER-01, INPUT-01 |
| REQ-007 | Section 7.2, p.3 | Expected component count = target quantity times pieces per garment. | DOMAIN-01 |
| REQ-008 | Sections 6/7.2, pp.2-3 | Submission changes prepared order to PENDING_VERIFICATION. | FLOW-01 |
| REQ-009 | Section 7.3, p.3 | Every component is counted; equal GREEN, excess YELLOW, shortage RED; terminal evaluates in real time. | DOMAIN-02, UI-02 |
| REQ-010 | Sections 7.3-7.4, p.3 | YELLOW can proceed; any RED disables Approve and blocks backend approval. YELLOW allowance is confirmed by approved UD-002. | ASMT-01, ASMT-02, DOMAIN-03 |
| REQ-011 | Section 9, p.4 | RED, missing, or uncounted components cause direct approval HTTP 422 and leave order unverified. | ASMT-02, GATE-01 |
| REQ-012 | Sections 6/7.4, pp.2-3 | Rejection requires reason and returns batch for re-cut. Same-order/new-attempt mechanics are approved under UD-006. | ASMT-03, FLOW-02 |
| REQ-013 | Section 6, p.2 | Approval permanently stores verifier ID, time, component variances, fabric wastage percentage; evidence accompanies sewing unchanged. | AUDIT-01 |
| REQ-014 | Sections 7.5/9, pp.3-4 | Sewing database query enforces status = VERIFIED; URL manipulation cannot expose other states. | ASMT-05, SEW-01 |
| REQ-015 | Section 7.5, p.3 | Backend stores [(actual fabric - expected fabric) / expected fabric] times 100. | DOMAIN-04 |
| REQ-016 | Section 9, p.4 | Supervisor direct approval receives 403; all privileged operations enforce server RBAC. | ASMT-04, RBAC-01 |
| REQ-017 | Section 9, p.4 | Verifier identity/audit time are server-derived, never trusted client fields. | AUTH-02, AUDIT-01 |
| REQ-018 | Section 11, p.5 | Orders, counts, transitions, and logs survive refresh in persistent cloud database. | DATA-02 |
| REQ-019 | Section 11, p.5 | Reject negative, decimal, nonnumeric, empty inputs; immediate inline errors. Approved UD-001 explicitly permits positive actual fabric to three decimal places while discrete counts remain integers. | INPUT-01 |
| REQ-020 | Section 11, p.5; section 15, p.6 | Inputs, search, dropdowns, focus, and all states remain legible/high contrast; responsive layout. | UI-03 |
| REQ-021 | Section 10, p.4; section 14, p.6 | Automated suite covers all five mandatory cases below; runs via npm test or equivalent. | ASMT-01 through ASMT-05 |
| REQ-022 | Sections 12/14, pp.5-6 | Root AI report has tools/prompts, at least two real faulty AI-code instances, human refactoring, defensive architecture. | DELIVERY-01 |
| REQ-023 | Section 14, p.6 | Submit live URL, public GitHub with atomic commits, README architecture/schema/three-role credentials, passing suite. | DELIVERY-01 |
| REQ-024 | Sections 1/4/13, pp.1-2,5 | Build the checkpoint, not whole ERP; four-day/28-32-hour source schedule, with admin secondary and no architecture scheduling blocker (UD-024). | Scope review, UD-024 |

## Exact assessment seed data

**ASSESSMENT REQUIREMENT (7.1, p.3):** Preserve names, codes, categories, rates, caps, and BOM grouping. Sleeves (Left & Right) is one grouped component with multiplier 2. Approved UD-008 preserves these exact seeded/read-only BOM groups.

| Recipe code | Name | Category | Standard yards/garment | Wastage cap |
|---|---|---|---:|---:|
| REC-BL01 | Casual Blouse | Blouse | 1.8 | 5.0% |
| REC-CT02 | Crop Top | Crop Top | 1.1 | 8.0% |

| Recipe | Component | Pieces/garment | Expected for 50 |
|---|---|---:|---:|
| REC-BL01 | Front Body Panel | 1 | 50 |
| REC-BL01 | Back Body Panel | 1 | 50 |
| REC-BL01 | Sleeves (Left & Right) | 2 | 100 |
| REC-BL01 | Collar & Stand | 1 | 50 |
| REC-BL01 | Sleeve Cuffs | 2 | 100 |
| REC-CT02 | Front Chest Panel | 1 | 50 |
| REC-CT02 | Back Support Panel | 1 | 50 |
| REC-CT02 | Neck Binding Strip | 1 | 50 |
| REC-CT02 | Hem Elastic Casing | 1 | 50 |
| REC-CT02 | Side Strap Accents | 2 | 100 |

**DESIGN DECISION (approved by user, UD-021):** image_url is nullable; no images supplied. **DESIGN DECISION (approved by user, UD-003):** Caps are approved warning/analytics values and never approval gates.

## Mandatory assessment tests

| Assessment case | Planned ID | Required result |
|---|---|---|
| Test 1 | ASMT-01 | Authenticated verifier approves all-GREEN order. |
| Test 2 | ASMT-02 | At least one RED blocks approval; section 9 specifies HTTP 422. |
| Test 3 | ASMT-03 | Rejection without reason fails backend validation. |
| Test 4 | ASMT-04 | Non-verifier personas get 403 for approval. |
| Test 5 | ASMT-05 | Sewing database query never returns an unapproved order. |

## User-approved architecture and security requirements

**DESIGN DECISION (approved by user):**

- ARC-001: Complete chosen stack in [00](00_PROJECT_CHARTER.md).
- ARC-002: Frontend -> Route Handler -> Controller -> Service -> Repository -> Supabase PostgreSQL. Controllers own auth/RBAC/Zod mapping, services business rules, repositories persistence.
- ARC-003: Server-validated identity, independent server RBAC, RLS defense, server-only elevated access.
- ARC-004: Atomic approval includes state/count validation, immutable audit, VERIFIED transition.
- ARC-005: No trusted client status, actor, role, timestamp, or audit values.
- ARC-006: No application code, installations, migrations, or G01 during G00.

## Administrative extension

**APPROVED EXTENSION** applies to these rows.

| ID | Requirement | Planned verification |
|---|---|---|
| REQ-A001 | SYSTEM_ADMIN creates and views production users; approved UD-022 selects direct temporary-password creation, with invitations outside initial scope. | ADMIN-01 |
| REQ-A002 | SYSTEM_ADMIN activates/deactivates and assigns/changes production roles. | ADMIN-02, AUTH-03 |
| REQ-A003 | SYSTEM_ADMIN reviews administrative audit information. | ADMIN-03 |
| REQ-A004 | SYSTEM_ADMIN cannot create/count/approve/reject, directly change production states, inject sewing entries, or impersonate production personas. | RBAC-04 |

**DESIGN DECISION (approved by user, UD-014/UD-022):** Immutable attributed admin events accompany successful account/role mutations. Creation synchronously makes Auth identity then profile; failed profile persistence attempts cleanup of the newly created Auth user and returns error. Established records are not hard-deleted.
