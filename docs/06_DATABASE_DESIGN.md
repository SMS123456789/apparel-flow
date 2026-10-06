# 06 - Database design and atomic persistence

**ASSESSMENT REQUIREMENT (8, p.4):** Persistent relational representation of users, recipes/components, orders, verification items/logs; refinements allowed. **DESIGN DECISION (approved by user):** Supabase PostgreSQL/Auth/RLS, no Prisma, no migrations in G00. Single factory, no tenancy or creator-ownership columns/policies.

Logical columns, constraints, indexes, and command internals are implementation details under approved decisions, not executable DDL or reopened architecture blockers.

## G02 migration foundation

**DESIGN DECISION (implementation detail):** Every application database/schema change must be represented by a version-controlled Supabase SQL migration. The pinned CLI initializes supabase/config.toml; G02 creates no migration, seed, business table, or generated Database type. Cloud is the primary target. Login/link/review/dry-run/push and optional local reset/type-generation commands are documented in [README](../README.md#supabase-migration-workflow). Dashboard inspection and project configuration are allowed; application schema must remain reproducible from the repository. Schema/grants/RLS/RPC implementation starts only with separately authorized G03.

## Assessment mapping

| Assessment entity | Representation |
|---|---|
| users | auth.users authentication + public.profiles application data. No duplicate password hash (UD-025). |
| recipes | Exact seeded/read-only names/codes/category/standard rate/cap (UD-008). |
| recipe_components | Recipe FK/name/positive integer multiplier/nullable image_url (UD-001/UD-021). |
| cutting_orders | Recipe/target/fabric/state/creator/server timestamps, attempt/approval references and sewing start. |
| verification_items | Per-attempt required component/count/derived status. |
| verification_logs | Immutable decision/verifier/reason/fabric evidence, plus frozen component log-items. |

## Relational inventory

**DESIGN DECISION (implementation detail within approved UD-005 through UD-016 and UD-025):**

| Table | Principal fields/types | Keys/invariants |
|---|---|---|
| public.profiles | id UUID; full_name text; role constrained value; is_active boolean; revision bigint; created_at/updated_at timestamptz | PK/FK id -> auth.users.id; one protected role; no client role/activity writes; email authoritative in Auth. |
| recipes | id UUID; recipe_code/name/category text; std_fabric_yards numeric(12,3); wastage_cap numeric; created_at timestamptz | Unique recipe_code; standard > 0; cap >= 0; no runtime recipe editor. |
| recipe_components | id/recipe_id UUID; component_name text; pieces_per_garment integer; image_url nullable text; sort_order integer | FK recipe; positive multiplier; grouped exact BOM; unique(recipe_id, component_name). |
| cutting_orders | id UUID; order_no text; recipe_id UUID; target_qty integer; fabric_roll_id text; actual_fabric_yds numeric(12,3); status; created_by UUID; current_attempt_id/approved_log_id nullable UUID; sewing_started_at nullable timestamptz; started_by nullable UUID; revision bigint; timestamps | Unique server number; FK recipe/profile; attempt/log belong to order; positive target/fabric; start fields both absent/present, only set while VERIFIED. |
| order_components | id/order_id/component_id UUID; component_name_snapshot text; pieces_per_garment integer; expected_qty bigint; sort_order integer | Created/frozen on first submit; unique(order_id, component_id); source recipe membership; no post-submit replacement. |
| verification_attempts | id/order_id UUID; attempt_no integer; OPEN/APPROVED/REJECTED; submitted/closed timestamps; submitted_by UUID; recipe/target/roll/standard/cap/actual/expected-fabric snapshots | Unique(order_id, attempt_no); one OPEN/order; reuse frozen recipe/target/BOM across re-cut; closed attempts immutable. |
| verification_items | id/order_id/attempt_id/component_id/order_component_id UUID; expected_qty bigint; actual_qty nullable bigint; status nullable GREEN/YELLOW/RED; updated_by/time | Unique(attempt_id, component_id); composite same-order links; actual >= 0/null; flag derived; closed attempt rows immutable. |
| verification_logs | id/order_id/attempt_id/verifier_id UUID; APPROVED/REJECTED; nullable rejection_note; expected_fabric_yds numeric(24,3); actual_fabric_yds numeric(12,3); wastage_pct numeric(32,12); timestamp; actor role/name snapshots | Unique attempt; at most one APPROVED/order; reason trimmed 1-1000 on rejection; actor != creator; full approved evidence. |
| verification_log_items | log_id/order_component_id/component_id UUID; component_name; expected_qty; nullable actual/variance; nullable derived flag | PK(log_id, order_component_id); frozen manifest/variances; approved rows never null/RED. |
| admin_audit_events | id/actor_id/target_user_id UUID; action; safe before/after JSON; server timestamp/outcome/request ID | Immutable; account/profile changes and event in one SQL transaction; no credentials or password fields. |

No separate roles table, sewing_starts table, tenant/plant tables, or durable admin_operations table is needed. Sewing start metadata lives on cutting_orders. Fabric roll is an identifier, not inventory scope.

## Bounded types and historical integrity

The user's UD-013 approves reasonable bounded columns; these concrete engineering defaults fit the seeded recipes and preserve arithmetic:

- Target/multiplier: positive PostgreSQL integer. Count fields: nonnegative bigint/null with application/DB safe-integer bound 9,007,199,254,740,991; multiplication checked before persistence.
- Entered yards/standard: positive numeric(12,3). Validate input scale before any cast/write; overprecision fails, never silently rounds into a valid input.
- Expected fabric: numeric(24,3), allowing target multiplication without overflowing entered-yard width. Wastage: signed numeric(32,12), with enough fractional precision to retain small negative variances within these input bounds. Never clamp.
- UUID PKs; server-generated unique human number via database sequence, e.g. AF-000001. Formatting is an engineering choice; never count rows for numbering.
- timestamptz/UTC storage and ISO 8601 output; UI labels its display timezone. JSON count numbers stay safe; decimal outputs use canonical strings.
- Reason trimmed 1-1000 chars. App schemas/database guards agree on this approved length.
- Restrictive FKs and denied DELETE preserve established users/orders/recipes/audit. Users deactivate rather than delete; no cascading sign-off deletion.
- First submit validates exact recipe manifest and freezes it; count rows alone cannot establish completeness. Null actual/flag means uncounted; zero remains counted shortage.
- Approved status and approved-log reference are mutually consistent and command-only. No generic client UPDATE can fabricate either.
- Auth-user cleanup only rolls back a new, incomplete admin creation that failed profile persistence (UD-022). It does not delete established profiles, orders, or audit.

## Query indexes

Implementation indexes: orders(status, created_at, id), components(recipe_id, sort_order), attempts(order_id, attempt_no), items(attempt_id), logs(order_id, timestamp), audit(target_user_id, timestamp). Creator is historical identity/separation data, not an ownership query filter. Validate actual plans later; no performance measurements are claimed by G00.

## Transaction strategy and layer ownership

**DESIGN DECISION (approved UD-012):** Critical transitions use one backend-only PostgreSQL transaction/RPC. VerificationService checks rules; VerificationRepository invokes typed persistence. The command repeats hard invariants under lock against current values to close service-read/commit races. Separate Supabase HTTP calls are not a transaction.

Supabase supports database-function RPC and requires explicit function privilege review. [Supabase database functions](https://supabase.com/docs/guides/database/functions).

### Approval transaction

1. Controller validates cookie identity/current profile; service checks verifier role and creator separation.
2. Repository invokes restricted command with server-derived actor ID, order/attempt ID, revision. No client actor/status/audit argument is trusted.
3. Lock/recheck actor profile, then order using a common order for all writers. Role/activity changes use the same profile-lock protocol.
4. Recheck current CUTTING_VERIFIER, actor != creator, PENDING_VERIFICATION/current OPEN attempt/revision.
5. Reread full frozen manifest/authoritative saved count set. Recompute expectations/lights/set completeness and signed fabric percentage. RED/missing/uncounted -> 422; no cap gate.
6. Insert immutable decision/component snapshots with server identity/time/fabric/variances.
7. Close attempt, set VERIFIED/approval reference, increment revision, all in the transaction.
8. Commit once. Any failure rolls back every write; return committed values only.

All related writers lock the same order; its lock alone cannot protect writes that ignore this protocol. [PostgreSQL locking](https://www.postgresql.org/docs/current/explicit-locking.html).

### Other consistency boundaries

| Operation | Atomic SQL set |
|---|---|
| Create/edit preparation | Valid inputs/server expectations/order/revision; recipe/target changes only before first submit. |
| Submit/resubmit | First frozen manifest or reused manifest; new attempt/input basis/uncounted rows/pending state. |
| Explicit count save | Actor != creator; current attempt/revision; submitted subset/derived flags/revision. |
| Reject | Actor != creator; valid reason/immutable evidence/closed attempt/REJECTED. |
| Start sewing | VERIFIED/approval/current revision; sewing_started_at/started_by/revision; no status change. |
| Role/activity update | Current admin/target/self guards; profile mutation/admin audit. |
| Admin create | External Auth create first; then profile+admin audit SQL transaction. If SQL fails, attempt removal of only that newly created Auth user and return error. |

Auth creation and profile SQL are not one distributed transaction. The simple compensation path is approved in [10](10_ADMIN_PANEL_SPEC.md); no job/polling/operation ledger is required.

## Exposure and elevated safeguards

**DESIGN DECISION (implementation detail under approved UD-012/UD-023):** User-scoped server Supabase clients perform RLS-protected reads. Deny anon/authenticated raw production/profile mutations and privileged command EXECUTE. Backend elevated commands check current actor/role/creator/state because service-role bypasses RLS.

If elevated helpers are needed, use private unexposed schema, least-privilege owner, qualified names, pinned search_path, restricted grants; an exposed invoker gateway is backend-credential-only. Concrete grants are reviewed/implemented at G03 without reopening UD-012. No browser path may call the privileged mutation gateway.

Application SYSTEM_ADMIN is not infrastructure service_role. Application immutability does not protect against a database owner deliberately editing storage; operational recovery is outside normal UI authority.
