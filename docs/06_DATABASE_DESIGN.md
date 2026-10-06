# 06 - Database design and atomic persistence

**ASSESSMENT REQUIREMENT (8, p.4):** Persistent relational representation of users, recipes/components, orders, verification items/logs; refinements allowed. **DESIGN DECISION (approved by user):** Supabase PostgreSQL/Auth/RLS, no Prisma, no migrations in G00. Single factory, no tenancy or creator-ownership columns/policies.

G03 implements the relational inventory through three migrations. G04 adds two forward migrations for scoped identity reads and four backend-only admin gateways; the ten-table/six-enum domain inventory is unchanged. Authentication/admin services exist; manufacturing transactions and approval/rejection RPCs remain later work.

## G04 identity/admin access

Forward migrations 20261006163000_identity_admin_access.sql and 20261006170000_identity_auth_projection.sql introduce exactly one authenticated SELECT policy: profiles.id = auth.uid() and is_active. Authenticated users cannot write profiles or execute admin commands; production/reference tables remain denied. service_role still has no direct table DML.

The public admin_list_users/admin_create_profile/admin_update_profile/admin_list_audit functions are SECURITY INVOKER entry points executable only by service_role. They call four private SECURITY DEFINER commands with an empty search_path, fully qualified references and a restricted NOLOGIN, NOINHERIT, BYPASSRLS owner. That owner has only profile SELECT/INSERT/limited UPDATE and administrative audit SELECT/INSERT; no DELETE or production permissions. An internal invoker assertion locks/rechecks the active SYSTEM_ADMIN. Update locks actor/target in UUID order, protects admin targets, checks revision and inserts immutable audit in the same transaction.

The private security-barrier auth_identity_emails view projects only Auth id/email. Its operator owner already has managed Auth access; the command owner has SELECT only on this view and no direct Auth schema/table permissions. API roles cannot read it. This avoids granting broad managed-schema privileges or duplicating email/password data in profiles. A temporary CREATE grant for replacing the private commands is revoked within the forward migration. Catalog tests document and enforce all owner/schema/function/column grants.

## G02 migration foundation

**DESIGN DECISION (implementation detail):** Every application database/schema change must be represented by a version-controlled Supabase SQL migration. G02 initialized the pinned CLI but created no schema. G03 applies 20261006153000_apparelflow_domain_schema.sql and 20261006153100_assessment_recipes.sql plus the forward 20261006155500_rejection_reason_whitespace.sql fix to cloud PostgreSQL 17.11. The supported --db-url workflow uses the database password through PGPASSWORD without a Management API token/login. Login/link is an optional operator alternative; commands are documented in [README](../README.md#supabase-migration-workflow). Never edit applied SQL; future fixes require new migrations.

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
| public.profiles | id UUID; full_name; app_role; is_active default false; revision; created_at/updated_at | PK/FK id -> auth.users.id; one role; no password/email copy; stable identity/creation timestamp. |
| recipes | id UUID; recipe_code/name/category; bounded numeric std_fabric_yards/wastage_cap_pct; created_at | Unique code; positive standard/nonnegative cap; immutable reference data. |
| recipe_components | id/recipe_id UUID; component_name; positive integer pieces_per_garment/sort_order; nullable image_url; created_at | Recipe FK; unique recipe/name and recipe/sort; immutable reference data. |
| cutting_orders | id; sequence order_no; recipe_id; positive integer target_qty; roll ID; actual_fabric_yds; production_status; created_by; current_attempt_id/approved_log_id; generated approval_decision; first_submitted_at; sewing_started_at/started_by; revision; timestamps | Same-order current-attempt/approved-decision FKs; VERIFIED iff approved log; sewing actor/time pair requires VERIFIED and becomes immutable. |
| order_components | id/order_id/recipe_id/component_id UUID; component_name_snapshot; pieces_per_garment; expected_qty bigint; sort_order; created_at | Unique order/component and order/sort; composite source-recipe membership; immutable from insertion, no additions after first submission. |
| verification_attempts | id/order_id/recipe_id; attempt_no; OPEN/APPROVED/REJECTED; submitted_by; target_qty_snapshot; fabric_roll_id_snapshot/std_fabric_yards_snapshot/wastage_cap_pct_snapshot; actual/expected fabric; submitted_at/closed_at; revision/updated_at | Unique order/attempt; one OPEN/order; frozen submitted basis; finalized attempts immutable. |
| verification_items | id/order_id/attempt_id/order_component_id/component_id; expected/nullable actual bigint; generated signed variance_qty; nullable component_status; updated_by; created_at/updated_at | Unique attempt/order-component; same-order/expected-basis FKs; count/status nullable together and consistent; finalized evidence cannot change/extend. |
| verification_logs | id/order_id/attempt_id/verifier_id; verifier name/role snapshots; decision; rejection_note; actual/expected fabric; signed wastage_pct; created_at | Unique attempt; one APPROVED/order; reason trimmed 1-1000 for REJECTED, null for APPROVED; immutable. Future RPC verifies actor/creator/gate/calculation. |
| verification_log_items | log_id/order_id/attempt_id/order_component_id/component_id; name snapshot; expected/nullable actual; generated variance; nullable status | Natural UUID-pair PK(log_id, order_component_id), no independent identity; same-attempt/count-manifest association; immutable. Future RPC verifies approved completeness. |
| admin_audit_events | id/actor_id/target_user_id UUID; admin_audit_action; before_state/after_state JSON; request_id UUID; created_at | Immutable; JSON permits typed full_name/role/is_active only, no credential/nested arbitrary payload. G04 profile creation and role/activity updates append audit atomically. |

No separate roles table, sewing_starts table, tenant/plant tables, or durable admin_operations table is needed. Sewing start metadata lives on cutting_orders. Fabric roll is an identifier, not inventory scope.

## Bounded types and historical integrity

The user's UD-013 approves reasonable bounded columns; these concrete engineering defaults fit the seeded recipes and preserve arithmetic:

- Target/multiplier: positive PostgreSQL integer. Count fields: nonnegative bigint/null with application/DB safe-integer bound 9,007,199,254,740,991; multiplication checked before persistence.
- Entered yards/standard: positive numeric with value < 10^9 and scale <= 3, preserving the planned numeric(12,3) bounds. Checks replace the typmod because PostgreSQL rounds excess scale before CHECK/trigger evaluation. Raw overprecision is rejected by database tests, not merely future Zod validation. Cap uses the same decimal bounds with zero allowed.
- Expected fabric: positive numeric with value < 10^21 and scale <= 3, preserving numeric(24,3) bounds. Wastage: signed numeric with absolute value < 10^20 and scale <= 12, preserving numeric(32,12) bounds. Never clamp. Future transactions calculate/round analytics explicitly; G03 has no calculation/approval RPC.
- UUID PKs except the documented natural log/component UUID pair. Private bounded noncycling sequence generates AF- plus twelve digits, e.g. AF-000000000001; never count rows for numbering. Gaps, including rollbacks, are permitted.
- timestamptz/UTC storage and ISO 8601 output; UI labels its display timezone. JSON count numbers stay safe; decimal outputs use canonical strings.
- Reason trimmed 1-1000 chars. App schemas/database guards agree on this approved length.
- Restrictive FKs and denied DELETE preserve established users/orders/recipes/audit. Users deactivate rather than delete; no cascading sign-off deletion.
- First submit validates exact recipe manifest and freezes it; count rows alone cannot establish completeness. Null actual/flag means uncounted; zero remains counted shortage.
- Approved status and approved-log reference are mutually consistent; a generated APPROVED discriminator rejects rejection logs through a composite FK. All direct API mutations are denied; future command authorization/completeness remains mandatory.
- Auth-user cleanup only rolls back a new, incomplete admin creation that failed profile persistence (UD-022). It does not delete established profiles, orders, or audit.

## Query indexes

Cloud has 44 indexes: 26 supporting PK/unique constraints plus 18 purposeful indexes. Unique keys cover codes/numbers, recipe sort, order attempts, and attempt items. Additional indexes support order state/time/creator/recipe/sewing actor, profile role/activity, OPEN-attempt and single-approval partial uniqueness, attempt state/time/submitter, component/update-actor FKs, log order/time/verifier, and admin target/time/actor. Creator indexing supports separation/referential checks, not ownership visibility. Query-plan performance remains unmeasured until application queries exist.

## G03 enums, immutability and RLS

Enums: app_role = system_admin/cutting_supervisor/cutting_verifier/sewing_supervisor; production_status = CUTTING_IN_PROGRESS/PENDING_VERIFICATION/REJECTED/VERIFIED; verification_attempt_status = OPEN/APPROVED/REJECTED; component_status = GREEN/YELLOW/RED; verification_decision = APPROVED/REJECTED; admin_audit_action = USER_CREATED/USER_ROLE_CHANGED/USER_ACTIVATED/USER_DEACTIVATED.

At G03 all ten tables enabled RLS with zero policies. At that milestone PUBLIC/anon/authenticated had no table privileges and service_role had SELECT only. G04 adds only the own-active-profile SELECT and restricted admin commands above; all direct INSERT/UPDATE/DELETE/TRUNCATE and manufacturing access remain denied. Future manufacturing reads/transactions require reviewed migrations.

Seven invoker-only app_private trigger helpers use an empty search_path and qualified relations. API roles lack schema/function/sequence privileges. Twenty-six triggers block hard deletions; protect reference/BOM/log/log-item/admin-audit updates; freeze submitted recipe/target and verified order facts; preserve sewing attribution; freeze attempt inputs/finalized rows; and prevent changing/extending finalized count/sign-off evidence. Reusable set_updated_at covers only profiles/orders/attempts/items and also protects stable IDs/creation timestamps. A database owner can deliberately disable protections; this is outside ordinary application authority.

| Private helper | Purpose |
|---|---|
| set_updated_at | Refresh mutable-row timestamps; retain IDs and creation timestamps. |
| prevent_mutation | Deny hard deletes and edits to immutable reference/BOM/audit rows. |
| guard_order_history | Freeze submitted recipe/target, verified facts, and one-time sewing attribution. |
| guard_manifest_insert | Prevent extending the BOM after first submission. |
| guard_attempt_history | Preserve submitted basis and prohibit finalized-attempt changes. |
| guard_item_history | Preserve count identity/basis; accept count mutations only while the attempt is OPEN. |
| guard_open_evidence_insert | Allow decision/component audit insertion only before attempt finalization. |

Future first submission inserts the complete BOM before setting first_submitted_at in the same transaction. Sign-off inserts log/items while the attempt is OPEN, then closes it and updates the order atomically. These ordering requirements support immutability; they do not implement actor authorization, legal transitions, manifest completeness, or approval RPCs in G03.

The deterministic recipe migration supplies only the two exact assessment recipes and ten nullable-image components. Replay is idempotent and validates equality without overwriting conflicts. G03 seeds no cloud profiles/Auth users/orders/verification/sewing/admin events. G04 operator provisioning separately creates four real Auth identities/profiles and administrative creation evidence, with private credentials outside migrations. CLI definitions live in src/types/database.generated.ts and bind all three factories; generated types do not grant permissions.

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

If elevated helpers are needed, use private unexposed schema, least-privilege owner, qualified names, pinned search_path, restricted grants; a future exposed invoker gateway is backend-credential-only. G03 established safe default-deny grants. G04 introduces only the four admin gateways described below; no manufacturing gateway exists. Later workflow goals introduce reviewed command grants without reopening UD-012. No browser path may call future privileged entry points.

Application SYSTEM_ADMIN is not infrastructure service_role. Application immutability does not protect against a database owner deliberately editing storage; operational recovery is outside normal UI authority.


## G05 cutting access and commands

Migration 20261006180000 implements the create/edit/submit/recut atomic sets above. Eight authenticated SELECT policies scope catalog to active cutting roles and order/child data to active supervisors. User-context repositories use these policies. Four service-only public invoker gateways call private locked commands owned by apparelflow_production_owner, a separate NOLOGIN/NOINHERIT owner with no Auth/admin-audit or profile-role/activity privilege. UPDATE(id) on profiles and attempts is solely for row locks; existing identity/history triggers prevent changes. Direct API DML stays denied. First submit freezes exact complete BOM and derives quantities; subsequent submission reuses the frozen manifest and first-attempt standard/cap. SQL fixtures prove real submission rollback and re-cut history preservation.

## G06–G07 final workflow access

The verification migration adds three named save/approve/reject invoker gateways
and restricted private commands. The sewing migration adds one named start
command; all eight production gateways are service_role-only. The nine total
SELECT policies comprise own-active identity, two cutting reference policies and
six production/child policies. Sewing receives VERIFIED orders and only their
approved attempts/counts/logs/items, never prior rejected attempts or catalog
rows. The two public views use security_invoker=true; verification_evidence
preserves decimal text, and sewing_batches independently fixes VERIFIED, approved
links and active Sewing scope. There is no browser DML or privileged RPC grant.

Submitted attempts freeze recipe code/name labels as well as the original
fabric/target basis. A trigger supplies first-attempt labels on re-cut. G07
backfills only the newly added label columns from immutable seeded references,
then protects them through the existing attempt-history trigger. Schema totals:
ten tables, six enums, 21 restrictive foreign keys, 53 CHECKs, 44 indexes, 27
triggers, nine scoped SELECT policies, four admin and eight production gateways.
All eight forward migrations are applied to the assessment Supabase database and
CLI-generated types match it. Real isolated sessions prove atomic decisions,
rollback, creator guards, full child isolation and concurrent once-only starts.
