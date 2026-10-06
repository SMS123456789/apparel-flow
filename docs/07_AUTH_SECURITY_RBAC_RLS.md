# 07 - Authentication, security, RBAC, and RLS

**DESIGN DECISION (approved by user):** Supabase Auth authenticates, backend RBAC authorizes, RLS provides defense in depth. Frontend is not a security boundary. Never expose SUPABASE_SECRET_KEY (including a legacy service_role value) or browser-held elevated privileges.

## G02 credential foundation

**DESIGN DECISION (implementation detail):** NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are browser-safe. SUPABASE_SECRET_KEY is separately validated in a server-only module; legacy anon/service_role values map to the public/secret variables respectively. Browser, cookie-based user-context server, and stateless privileged factories are separate. The server factory propagates SSR cookie writes/cache headers to a writable response context and does not hide failures. G02 deferred login/guards/Proxy/cloud Auth settings; G04 now implements those identity features. Local and verified cloud settings disable signup; G05–G07 implement the manufacturing RLS boundaries below. G02 connectivity uses trusted development-only read requests, never a public diagnostic API. See [G02 decisions](14_ARCHITECTURE_DECISIONS.md#g02-supabase-foundation-decisions).

## Identity and session

Historically, G03 was a database-only foundation: all ten application tables have RLS enabled with no policies. PUBLIC/anon/authenticated table access is revoked; service_role is read-only. No production RPC exists and API roles cannot execute private trigger helpers or use the private numbering sequence. Database role values use the lowercase assessment identifiers plus system_admin; G04 API/application identifiers use their documented uppercase representation. G03 itself seeded no Auth identities/profiles and implemented no login/refresh/role guard. G04 changes only the narrow identity/admin boundaries described below.

**DESIGN DECISION (approved UD-015/UD-025):** Supabase email/password authentication with cookie-based SSR session, real distinct demo accounts, public signup disabled. auth.users is authentication authority; public.profiles holds protected current role/activity/name. One role/user; no authority from editable user metadata or browser role switches.

Controller validates Auth identity with the supported server client and then current profile. Do not authorize using a locally read getSession user object. Server-confirmed getUser or verified token identity is distinct from a fresh role lookup. [Supabase server Auth guidance](https://supabase.com/docs/guides/auth/server-side/creating-a-client).

ActorContext is constructed server-side from verified subject/current role/activity/request ID. Client actor/created_by/verifier/role/status/time/expected/flag/wastage are rejected by strict command schemas. Decision timestamp is server/database decision time, not JWT issued-at time.

Missing/inactive profile denies app APIs and RLS data even if Auth still recognizes a valid JWT. This also prevents access by an incompletely provisioned account whose cleanup failed.

## Implemented G04 session boundary

Login/logout/me/demo are backend APIs. AuthRepository returns only id/email from verified getUser(); ProfileRepository reads the same subject through the JWT client and own-active-profile RLS. AuthService rejects missing/inactive/mismatched profiles; no metadata role or getSession object supplies authority. Controllers/services share exact requireUser/requireRole guards and sanitized HTTP translation. All private API responses carry request IDs and private,no-store headers. Mutations require an exact configured APP_ORIGIN, including login/demo/logout; missing/cross origins are forbidden.

Next.js 16 src/proxy.ts calls getClaims for verified refresh and coarse unauthenticated page redirects only. Cookie refresh updates both request and response and preserves cookies/cache headers on redirects; API requests reach independent controllers rather than receiving login redirects. Cookies are HttpOnly, SameSite=Lax and Secure on HTTPS. Read-only Server Component clients rely on Proxy for writes; writable route clients propagate cookie failures and refresh headers. Role lookup is fresh for every protected API/page.

The visible demo panel authenticates one of three allowlisted real accounts using server-held private credentials and checks its persisted production role. Each change signs out the previous local session, signs in a different Auth identity and performs full navigation. SYSTEM_ADMIN credentials are never exposed to the panel. DEMO_ACCOUNTS_ENABLED defaults false; the assessment environment explicitly enables it. Public signup is disabled in the cloud and there is no application signup endpoint.

The two forward identity migrations add one own-active profiles SELECT policy and four service_role-only invoker admin gateways. Their restricted private definer owner can mutate only profiles/admin audit, never production/reference tables or Auth users. A private id/email projection avoids direct managed Auth schema grants. All direct API-role DML, authenticated admin RPC EXECUTE, trigger-helper EXECUTE and sequence access stay denied. Full grants and rationale are documented in [06](06_DATABASE_DESIGN.md#g04-identityadmin-access).

## Separate Supabase contexts

| Context | Credential | Allowed use | Guards |
|---|---|---|---|
| Browser | Same-origin HttpOnly cookie | Calls login/logout/demo and protected backend APIs. Existing public-only Supabase factory is unused by G04 UI. | No browser business queries or privileged client. |
| Server identity/read client | Validated user JWT | Identity and repository RLS-scoped reads. | Controller role/activity; fixed permitted resource predicates. |
| Server production command client | Backend-only elevated/restricted context | Approved transactional RPCs. | Service authority/rules; locked DB actor/creator/state/count rechecks. |
| Server Auth admin adapter | Server-only service-role/secret | Create Auth user/cleanup incomplete creation and approved account operations. | Current SYSTEM_ADMIN/self/promotion guards; never browser call. |
| Infrastructure/operator | Controlled Supabase operations | Manual first-admin bootstrap and later authorized migrations. | Not application admin; no G00 database work. |

Elevated service context bypasses RLS, so independent backend checks are essential. Grants and RLS both need review; policies do not revoke existing grants. Secure views as well as tables. [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

Keep server command/Auth-admin clients isolated in server-only adapters; secret possession is not application authority. Do not use elevated reads to expose production data to SYSTEM_ADMIN or broaden sewing scope.

## Factory-wide role policies

**DESIGN DECISION (approved UD-009):** One factory, no tenancy and no creator-owned visibility filters. Current role determines records. Creator identity remains solely for attribution and self-verification prevention.

The following read policies/grants are implemented by G04–G07. G03 historically denied ordinary reads as well as writes before those reviewed scoped-access migrations. All anon application access remains denied; raw authenticated application writes remain denied.

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

Browser JWTs cannot execute privileged commands. G03 implements default-deny grants and invoker-only private trigger helpers; G04 added backend admin gateways and G05–G07 added reviewed production commands. Their definer helpers are private/unexposed with pinned search_path, qualified relations, restricted owner/EXECUTE; only backend-credential invoker entries are exposed. [Supabase function security](https://supabase.com/docs/guides/database/functions).

Internal actor_id is derived by trusted controller; only backend can supply it. A service-role request does not magically carry a user's auth.uid. The command must read protected active role and reject forged/inappropriate internal actors.

## Administrative identity and creation

**DESIGN DECISION (approved UD-011/UD-022):** Privately bootstrap the first admin through Supabase using the explicitly authorized G04 operator script. Normal UI/API cannot create/promote another SYSTEM_ADMIN, self-deactivate/self-demote, or self-assign production. Guards protect direct API calls, not only hidden controls.

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


## Historical G05 production boundary

The G05 migration adds narrow SELECT grants/policies for active cutting-role catalog and active supervisor factory orders/children. At G05, Sewing/admin/inactive subjects received no production/reference rows; final Sewing scope is described below. Public cutting_create/cutting_edit/cutting_submit/cutting_recut are invoker-only and executable by service_role alone. Private commands recheck the locked actor's current cutting_supervisor role/activity and order revision/state. The production command owner cannot assign profile roles/activity, access Auth or administer accounts. API-role direct writes and command EXECUTE stay denied. Missing/foreign/empty inputs, trusted client state/identity/expected fields and generic status mutation are rejected at the server boundary.

## Final G06–G07 production boundaries

The approved read-policy table is now implemented. Active Verifier scope includes
submitted history; active Sewing scope fixes VERIFIED and limits all attempt,
count and evidence children to the current approved attempt/log. Sewing cannot
read reference recipes/components or prior rejected evidence. Views use caller
RLS. Admin remains isolated from all production data and commands.

Only server repositories call eight named service-role production gateways;
private commands recheck a locked active actor and the specific permitted role,
state, revision and creator separation where applicable. No generic status or
identity/timestamp arguments are accepted from browser JSON. Approval's complete
manifest/count gate and immutable audit/status transaction, rejection reason,
re-cut history and once-only sewing start are tested against real PostgreSQL.
Race tests use two actual connections rather than promise ordering in mocks.
Seven configured private values and credential variable markers were absent from
the final G07 browser JS; raw secrets/provider responses are withheld from logs.
