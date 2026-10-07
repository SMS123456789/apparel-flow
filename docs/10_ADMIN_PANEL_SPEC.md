# 10 - Administrative panel specification

**APPROVED EXTENSION:** SYSTEM_ADMIN views/creates production users, changes production roles, activates/deactivates, reviews administrative audit and a separate read-only production audit. No manufacturing, impersonation, force-state, or sewing injection.

**DESIGN DECISION (approved UD-011/UD-022):** First admin privately bootstrapped through Supabase by scripts/bootstrap-users.ts using operator-only ignored configuration, explicitly authorized in G04. Normal UI/API cannot create/promote another SYSTEM_ADMIN, self-deactivate/self-demote, or self-assign production. User creation is synchronous Auth create -> profile create, with cleanup attempt on profile failure; no invitation/async provisioning system is required initially.

## G04 delivered behavior

/admin lists/searches application users with literal name/email search, exact role/activity filters and stable keyset pagination. Native Add User/Change Role/Activate–Deactivate dialogs prevent repeated submissions, show validation/errors, clear temporary passwords after completion and confirm dirty cancellation. SYSTEM_ADMIN targets show a protected label. Stale revisions require reloading/reopening the edit; successful server responses alone update state. /admin/audit shows immutable, paginated safe account events and request IDs.

Creation performs Supabase Admin Auth createUser(email_confirm=true), then a backend-only profile-plus-audit transaction. If persistence fails, the service checks whether a profile committed before attempting deletion of only the newly created incomplete Auth identity. Unknown/committed outcomes return PROVISIONING_OUTCOME_UNCERTAIN; absent profile triggers cleanup and controlled PROFILE_CREATION_FAILED/USER_CLEANUP_FAILED. Existing identities are never deleted. No invitation email or mandatory first-login password reset was added.

Role/activity updates lock/recheck the active admin and target, reject all SYSTEM_ADMIN targets, apply expectedRevision and append audit atomically. Four narrowly granted admin gateways support the repository; service_role has no direct DML; the identity command owner and SYSTEM_ADMIN have no manufacturing permission. Production commands use their separate restricted owner. The operator bootstrap is idempotent, verifies existing credentials before granting a profile, refuses role/name/activity mismatches and never resets existing passwords.

## Screens

| Screen | Content | Controls |
|---|---|---|
| Users | Name/email/current role/active state/timestamps; safe search/filter/pagination. | Create User; production-role change; activate/deactivate. |
| Create User | Email, full name, production role, temporary password. | Submit once; show validation/success/sanitized failure. |
| Administrative audit | Actor/target/action/safe before-after role/activity/time/outcome/request ID. | Read-only cursor pagination and safe before/after details. |
| Production audit | Time/order/recorded actor/action/summary; existing creation, submission, decision and sewing-start records. | Read-only cursor pagination and expandable immutable evidence; no manufacturing controls. |

No production workspace, order/count/recipe/sewing mutation, override or impersonation navigation. The explicitly requested Production audit is a separate read-only destination. Browser never invokes Supabase Admin API or stores elevated secrets.

## Approved creation flow

```text
SYSTEM_ADMIN
  -> email + full name + production role + temporary password
  -> POST /api/admin/users
  -> AdminUserController
  -> AdminUserService
  -> server Supabase Admin API creates Auth user
  -> public.profiles row created
  -> 201 with safe user data
```

Controller authenticates current admin, applies origin guard, validates strict fields, and calls service. Service checks allowed production role and uses server Auth adapter/repositories. Admin APIs never accept acting-user identity or arbitrary admin promotion.

Temporary password satisfies configured Supabase password policy. Keep it only as the in-memory creation input/secure Auth request; no profile column, audit/log field, URL, response echo, or duplicate password hash. Creation UI clears password after submission completion; avoid persisting it in client storage.

Successful public.profiles row uses returned Auth ID, full name, one production role, active state, server timestamps. Insert profile and creation-audit event in one PostgreSQL transaction. Return success only after persistence succeeds. No email-invite flow or mandatory first-login-reset workflow is silently added.

## Failure and cleanup contract

**DESIGN DECISION (approved UD-022):**

1. If Auth creation fails, do not create a profile; return mapped error. Duplicate email -> 409; invalid password/input -> 422; dependency failure -> sanitized 503/500.
2. If profile/audit persistence fails after a new Auth user was created, roll back SQL, attempt cleanup through the trusted Supabase Admin API using only that new Auth ID, and return an error.
3. Cleanup success still returns profile-creation failure, not 201. Cleanup failure also returns error and records sanitized server diagnostics for operator reconciliation.
4. An incomplete Auth user with no active profile cannot access application APIs or RLS-protected data, even if Auth sign-in succeeds.
5. Never remove an existing user after a duplicate-email failure, and never delete an established profile/order/audit as compensation. If persistence outcome is uncertain, check the new profile before attempting deletion so a committed user is not accidentally removed.

Profile failure/cleanup failure use sanitized 500 codes such as PROFILE_CREATION_FAILED or USER_CLEANUP_FAILED. No secret/temporary password/raw provider exception is exposed. This best-effort rollback of incomplete creation is the approved narrow exception to UD-014's no hard deletion for established records.

No durable admin_operations table, background worker, 202/polling/retry endpoint, or elaborate invitation recovery is needed for this scope.

## Roles, activation, and audit

One current role in protected public.profiles is reloaded by guards each request. Role/activity changes lock current actor/target, apply self guards, update target/revision, and append immutable audit atomically. Creator IDs remain historical; reassignment never permits verifying an own-created order.

Deactivation commits is_active=false with audit; subsequent application/RLS access denies even with an existing JWT. Any supported Auth disabling is separate server administration; it is not a replacement for the active-profile check. Reactivation uses an existing valid Auth identity. Established users are deactivated, not hard-deleted.

Audit stores server actor/time, target, action, safe old/new role/activity and outcome. No passwords/tokens/keys/production payload. Creation failure may use sanitized operational logs if DB is unavailable; never fabricate a successful audit event.

## Acceptance

Non-admin -> 403 for admin reads/mutations. Admin -> 403 for all production commands. Self-deactivation/demotion/production-role assignment and SYSTEM_ADMIN creation/promotion through normal API fail. Auth creation failure leaves no new profile; profile failure attempts new-Auth cleanup and returns error; cleanup failure grants no application access. Successful creation is synchronous 201 with safe user data. Admin remains secondary to core assessment work.

## Production audit refinement

`GET /api/admin/production-audit` uses the existing Route → Controller → Service → Repository layering and private, no-store responses. It aggregates immutable creator/time fields from cutting orders, submitted actor/time from verification attempts, recorded decisions from verification_evidence plus verification_log_items, and starts from VERIFIED cutting_orders with a matching APPROVED current attempt and log. The sewing_batches view retains its sewing-role JWT predicate unchanged. No table, migration, event store, RPC or write capability is added. Each source is bounded to limit + 1; merged pagination orders exact microsecond time, source and record ID descending. Details are hydrated only for the returned page.

Decision names come from the immutable verifier name snapshot. Other names are explicitly current account names looked up by the recorded actor ID, with a safe missing-name fallback. Current order preparation is never presented as a creation snapshot. No event is inferred from updated_at; edits, recuts and intermediate count saves are not invented. Sewing starts include approved sign-off evidence and recorded start attribution. Technical IDs and exact decimals remain available in expandable details.
