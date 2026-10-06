# 03 - Roles and permissions

**ASSESSMENT REQUIREMENT (5, p.2):** Three distinct authenticated production personas. **APPROVED EXTENSION:** SYSTEM_ADMIN is administrative only. **DESIGN DECISION (approved by user):** Server-authorize every privileged API; navigation/RLS supplement this.

## Vocabulary and scope

| Application identifier | Assessment identifier | Authority |
|---|---|---|
| CUTTING_SUPERVISOR | cutting_supervisor | Prepare/submit/re-cut orders and track cutting progress. |
| CUTTING_VERIFIER | cutting_verifier | Physical counts, approve/reject, sign-off. |
| SEWING_SUPERVISOR | sewing_supervisor | Verified-only view and Start Sewing. |
| SYSTEM_ADMIN | Not present | User lifecycle, production-role assignment, administrative audit. |

**DESIGN DECISION (approved by user, UD-009/UD-010/UD-025):** One factory, no tenancy, exactly one current role per user in public.profiles. Production access is role-based across factory records; creator-owned lists or tenant/plant membership tables are not required. Admin is not a super-role. Supabase auth.users owns authentication; profiles owns application role/activity/name. Editable Auth metadata and client JSON cannot grant authority.

**DESIGN DECISION (approved by user, UD-010):** A user who created an order can never verify that order, even after reassignment to CUTTING_VERIFIER. This restriction applies to entering counts, approval, and rejection and is checked by backend guards/services and again inside transactional commands. History remains readable where the current role permits it; read access does not permit self-verification. SYSTEM_ADMIN cannot self-assign production privileges.

## Current implementation: G04–G07

The canonical server identity comes from Auth getUser() plus the matching active profiles row. requireUser/requireRole use exact role membership with no inheritance. Every admin controller and service independently guards SYSTEM_ADMIN; every role page checks its current role. Admin can list/create production users, change production role/activity and read audit. The full cutting, verification and sewing permissions in the matrix are implemented, including factory history and approved-only sewing child evidence. Existing JWTs are denied after deactivation and reflect the current role after reassignment.

## Capability matrix

A = assessment; E = approved extension; D = approved design decision. Deny anything not granted.

| Capability | Cutting Supervisor | Cutting Verifier | Sewing Supervisor | System Admin | Basis |
|---|---|---|---|---|---|
| Read seeded recipes | Allow | Allow for verification | Verified snapshot only | Deny | D, UD-008/UD-009 |
| Create order | Allow | Deny | Deny | Deny | A/E |
| View factory cutting orders/progress | Allow | Pending queue and verification history | Deny unverified | Deny | A/D, UD-009 |
| Edit prepared order/submit | Allow before first submission | Deny | Deny | Deny | D, UD-005/UD-006 |
| Re-cut/resubmit rejected order | Allow | Deny | Deny | Deny | A/D, UD-006 |
| Enter counts | Deny | Allow except own-created orders | Deny | Deny | A/D, UD-010 |
| Approve/reject | Deny | Allow except own-created orders | Deny | Deny | A/D/E |
| Edit recipes | Deny | Deny | Deny | Deny | A/D, UD-008 |
| Sewing Queue | Deny | Deny | VERIFIED only | Deny | A/E |
| Read immutable verification evidence | Factory cutting summary | Factory verification history | VERIFIED approved evidence only | Deny | D, UD-009 |
| Start Sewing | Deny | Deny | VERIFIED and not already started | Deny | A/D, UD-007 |
| Create/view production users | Deny | Deny | Deny | Allow: email/name/role/temporary password | E/D, UD-022 |
| Activate/deactivate users | Deny | Deny | Deny | Allow; cannot deactivate itself | E/D, UD-011 |
| Assign/change production role | Deny | Deny | Deny | Allow; no self-production assignment or self-demotion | E/D, UD-010/UD-011 |
| Create/promote SYSTEM_ADMIN via normal UI/API | Deny | Deny | Deny | Deny | D, UD-011 |
| Administrative audit | Deny | Deny | Deny | Allow | E |
| Direct status assignment | Deny | Deny | Deny | Deny | Approved invariant |
| Rewrite finalized evidence/hard-delete established records | Deny | Deny | Deny | Deny | D, UD-006/UD-014 |
| Impersonate/inject sewing entry | Deny | Deny | Deny | Deny | Approved invariant |

The first SYSTEM_ADMIN is privately bootstrapped through Supabase by an infrastructure operator using scripts/bootstrap-users.ts and ignored configuration, as explicitly authorized in G04. It is not created through public signup or the normal admin panel. UI restrictions above are enforced by server APIs as well.

Approved UD-022 uses synchronous Auth-user creation followed by profile persistence. Profile failure attempts cleanup of only that newly created incomplete Auth identity and returns error. This rollback is not a hard-delete permission for established users or audit records.

## Authorization sequence

Identity/RBAC and the role scope above are **DESIGN DECISION (approved by user)**. Response ordering is a documented implementation detail consistent with UD-019.

1. Validate Supabase identity server-side; invalid/absent -> 401.
2. Load current public.profiles row; missing/inactive/wrong role -> 403.
3. Apply role-permitted resource visibility; absent or invisible -> 404 after capability authorization.
4. For every verification mutation, compare created_by with authenticated actor ID; same person -> 403 regardless of their new role.
5. Validate payload/call service; mutating transaction rechecks current role/activity and creator separation.
6. RLS and database grants independently constrain rows and direct entry points.

Guard every method, related join, rendered page, search count, and cache. Wrong-role approval remains the assessment's 403. Sewing cannot obtain pending payloads from another route. Supervisor access to factory cutting history does not grant access to the Sewing Queue endpoint.

## Separation over time

One role at a time never erases historical creator identity. Role changes are auditable and cannot authorize self-verification. Normal admin APIs reject production-role assignment to the acting admin, self-deactivation/self-demotion, and creation or promotion of another SYSTEM_ADMIN. Demo switching authenticates another real account; it never mutates a session role.
