# 07 - Authentication, security, RBAC, and RLS

**DESIGN DECISION (approved by user):** Supabase Auth authenticates, backend RBAC authorizes, RLS provides defense in depth. Frontend is not a security boundary. Never expose SUPABASE_SERVICE_ROLE_KEY or browser-held elevated privileges.

## Identity and session

**DESIGN DECISION (approved UD-015/UD-025):** Supabase email/password authentication with cookie-based SSR session, real distinct demo accounts, public signup disabled. auth.users is authentication authority; public.profiles holds protected current role/activity/name. One role/user; no authority from editable user metadata or browser role switches.

Controller validates Auth identity with the supported server client and then current profile. Do not authorize using a locally read getSession user object. Server-confirmed getUser or verified token identity is distinct from a fresh role lookup. [Supabase server Auth guidance](https://supabase.com/docs/guides/auth/server-side/creating-a-client).

ActorContext is constructed server-side from verified subject/current role/activity/request ID. Client actor/created_by/verifier/role/status/time/expected/flag/wastage are rejected by strict command schemas. Decision timestamp is server/database decision time, not JWT issued-at time.

Missing/inactive profile denies app APIs and RLS data even if Auth still recognizes a valid JWT. This also prevents access by an incompletely provisioned account whose cleanup failed.

## Separate Supabase contexts

| Context | Credential | Allowed use | Guards |
|---|---|---|---|
| Browser Auth client | Public project key/current session | Email/password login, logout/session only. | Real Auth; no application table/privileged commands. |
| Server identity/read client | Validated user JWT | Identity and repository RLS-scoped reads. | Controller role/activity; fixed permitted resource predicates. |
| Server production command client | Backend-only elevated/restricted context | Approved transactional RPCs. | Service authority/rules; locked DB actor/creator/state/count rechecks. |
| Server Auth admin adapter | Server-only service-role/secret | Create Auth user/cleanup incomplete creation and approved account operations. | Current SYSTEM_ADMIN/self/promotion guards; never browser call. |
| Infrastructure/operator | Controlled Supabase operations | Manual first-admin bootstrap and later authorized migrations. | Not application admin; no G00 database work. |

Elevated service context bypasses RLS, so independent backend checks are essential. Grants and RLS both need review; policies do not revoke existing grants. Secure views as well as tables. [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

Keep server command/Auth-admin clients isolated in server-only adapters; secret possession is not application authority. Do not use elevated reads to expose production data to SYSTEM_ADMIN or broaden sewing scope.

## Factory-wide role policies

**DESIGN DECISION (approved UD-009):** One factory, no tenancy and no creator-owned visibility filters. Current role determines records. Creator identity remains solely for attribution and self-verification prevention.

The following read policies/grants are implementation details of that role contract. All anon application access denied; raw authenticated application writes denied.

| Resource | Supervisor SELECT | Verifier SELECT | Sewing SELECT | Admin SELECT | Raw user mutations |
|---|---|---|---|---|---|
| profiles | Own safe profile | Own safe profile | Own safe profile | Safe user-management fields | Denied |
| recipes/components | Seeded catalog | Seeded verification catalog | Verified snapshot only | Denied | Denied |
| cutting_orders | Factory cutting records | Pending queue/verification history | VERIFIED only | Denied | Denied |
| order_components | Role-readable parent | Role-readable parent | VERIFIED parent only | Denied | Denied |
| attempts/items | Factory cutting summaries | Factory verification history | Final approved attempt of VERIFIED parent only | Denied | Denied |
| logs/log-items | Factory cutting summaries | Factory verification history | Approved evidence of VERIFIED parent only | Denied | Denied |
| admin audit | Denied | Denied | Denied | Safe administrative events | Denied |

Every child-row lookup inherits parent restrictions. Own-created order read access for a reassigned verifier never allows its verification mutation. Sewing-start fields inherit VERIFIED-parent access; no separate sewing-start or operations table is needed.

**ASSESSMENT REQUIREMENT (9, p.4):** SewingRepository fixes database status = VERIFIED before search/pagination. Unsupported status/includeUnverified filters cannot widen it. Apply the same restriction to details, joins, totals, exports, views, and caches.

## Command access and creator separation

**DESIGN DECISION (approved UD-010/UD-012):** Every count/approve/reject command verifies current CUTTING_VERIFIER and actor != cutting_orders.created_by even after reassignment. Controller/service enforce it, and locked RPC rechecks it. Wrong role or creator -> 403; hard stop -> 422; state/revision conflict -> 409.

Browser JWTs cannot execute privileged commands. Concrete backend-only gateway/helper grants are implemented/reviewed at G03. If a definer helper is required, keep it private/unexposed with pinned search_path, qualified relations, controlled owner/EXECUTE; expose only a backend-credential invoker entry. [Supabase function security](https://supabase.com/docs/guides/database/functions).

Internal actor_id is derived by trusted controller; only backend can supply it. A service-role request does not magically carry a user's auth.uid. The command must read protected active role and reject forged/inappropriate internal actors.

## Administrative identity and creation

**DESIGN DECISION (approved UD-011/UD-022):** Manually create/bootstrap first admin through Supabase. Normal UI/API cannot create/promote another SYSTEM_ADMIN, self-deactivate/self-demote, or self-assign production. Guards protect direct API calls, not only hidden controls.

Creation inputs are email/full name/production role/temporary password. Backend Auth adapter creates Auth user; service/repository persist profile plus safe audit. Profile failure attempts cleanup of that newly created Auth user and returns error. Cleanup of incomplete creation is allowed; established users and audit are not hard-deleted. No invitation/durable operation/polling subsystem.

Temporary password travels only over the trusted server Auth call; never profiles, audit, logs, URLs, or response. Validate against configured Auth password policy. Missing/inactive profile fails closed during creation and if cleanup fails.

## Deactivation and role updates

Profile role/activity changes and immutable admin event are atomic; production writes recheck profile while locked. Current role is authoritative each request, not cached old claims. Deactivation immediately denies application access through profile/RLS checks. Supported Auth disabling is supplementary, not the application's sole gate.

Revoking sessions/sign-out may leave existing JWT valid until expiry; do not claim Auth deactivation instantly invalidates every token. [Supabase sign-out](https://supabase.com/docs/guides/auth/signout). Real app authorization remains denied for inactive profiles.

## Request/data safeguards

**DESIGN DECISION (approved UD-023):** Same-origin cookie authentication, explicit server origin protection on mutations, private no-store application data. No elaborate application rate-limiting subsystem required for MVP.

Implementation details:

- Match mutating request Origin to configured trusted app origin; reject cross-origin and undefined/untrusted mutation origins under the route policy. Cookies/CORS/UI redirects alone do not authorize.
- Apply appropriate cookie security/session refresh using supported Supabase SSR integration. Auth identity validation and current-profile checks occur for every privileged route.
- Strict Zod schemas reject protected/unknown keys, invalid/unsafe numbers, fabric overprecision, empty count payloads, and reasons beyond trimmed 1000 chars.
- Private authenticated HTML/API responses cannot enter shared caches; clear persona-scoped client state on demo account switch.
- Log server request IDs/safe outcomes; omit tokens/keys/passwords/raw request bodies and raw provider/SQL exceptions.
- Known transaction failures roll back; unexpected errors are sanitized. No error path creates VERIFIED or falsely successful user creation.
- Test bundle/network/console outputs for elevated secrets and temporary passwords.

## Proof obligations

Required direct supervisor approval is 403; RED/missing/uncounted is 422; sewing never exposes unapproved data. Approved additions: creator verification 403 after role change; admin self/promotion guards; read access by role across factory; cleanup failure cannot grant missing-profile access. [11](11_TEST_PLAN.md) plans direct API/DB/RPC, concurrency/rollback, audit, origin/cache, and creation-failure tests. None is claimed implemented during G00.
