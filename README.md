# ApparelFlow

Cutting Operations & Gatekeeper Verification Terminal, implementing the
[approved specification](docs/00_PROJECT_CHARTER.md).

**Current stage: G05 Cutting Supervisor Workflow.** G04 authentication/admin is merged through [PR #4](https://github.com/SMS123456789/apparel-flow/pull/4). Supervisor creation, preparation, frozen submission and same-order re-cut persistence are implemented. Verifier and sewing workflows follow in the authorized G06/G07 chunks. Deployment is manual user action after G08.

## Setup

Use Node **22.23.2** and npm **10.9.8**. Next.js 16.3.8, React 19.3.0,
TypeScript 5.9.3, Tailwind 4.3.3, Zod 4.6.5, Supabase JS 2.117.2/SSR 0.12.7,
Vitest 5.0.3, Playwright 1.63.0, and CLI 2.119.0 remain exact-pinned.

```bash
nvm use
npm ci
cp .env.example .env.local
# Configure actual credentials privately, then:
npm run dev
```

Open <http://localhost:3000>. Environment files are ignored; never commit real
credentials. The application needs the public Supabase URL/publishable key and
server-only `SUPABASE_SECRET_KEY`. `APP_ORIGIN` is the exact trusted origin,
without a trailing slash; use `http://localhost:3000` locally and the actual
HTTPS application origin when deployed. Missing/untrusted mutation Origin is
rejected. Database passwords are operator-only, not application configuration.

In the intended Supabase project's Authentication settings, disable **Allow new
users to sign up**. Local `supabase/config.toml` does not change cloud settings.
The provisioning script verifies this cloud setting before creating accounts.
There is no public signup UI/API.

## Operator provisioning and evaluator accounts

Configure these private values in ignored `.env.local`:

- `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_FULL_NAME`, `BOOTSTRAP_ADMIN_PASSWORD`.
- `DEMO_CUTTING_SUPERVISOR_EMAIL` and `DEMO_CUTTING_SUPERVISOR_PASSWORD`.
- `DEMO_CUTTING_VERIFIER_EMAIL` and `DEMO_CUTTING_VERIFIER_PASSWORD`.
- `DEMO_SEWING_SUPERVISOR_EMAIL` and `DEMO_SEWING_SUPERVISOR_PASSWORD`.
- `DEMO_ACCOUNTS_ENABLED=true` for the assessment panel.
- Operator `SUPABASE_DB_PASSWORD` (legacy `db_password` supported), optionally
  `SUPABASE_DB_URL` for a supported direct/pooler connection.

Use strong private provisioning passwords of at least 12 characters. The
bootstrap script does not print, reset, or overwrite passwords. On this workspace
these credentials were generated privately with user approval; the initial
admin password remains only in ignored `.env.local`.

```bash
npm run bootstrap:users
```

This server/operator-only command creates the first admin through Supabase Admin
Auth and an operator PostgreSQL transaction, with an attributed bootstrap audit.
It creates the three controlled production personas through Admin Auth followed
by the same narrow profile/audit command used by account management. Emails are
confirmed for these controlled accounts; no invitation email is sent. Existing
identities must authenticate with the configured password and have the expected
active profile; mismatches stop without changing their role/activity/password.
Replay is idempotent. Failed incomplete creation attempts only safe new-Auth
cleanup; established identities are preserved.

At `/login`, **Demo Accounts** offers Cutting Supervisor, Cutting Verifier, and
Sewing Supervisor. Each selection authenticates its configured real account,
checks the authoritative profile against the expected persona, and replaces the
local session. Passwords stay server-side; no credentials need publishing in
README. Sign out to return to the panel. The private admin uses ordinary email/
password login; no public admin persona or password is offered.

## Identity and administration

Supabase `auth.users` authenticates. `public.profiles` supplies current name,
role, and activity. Each protected request calls server-confirmed `getUser()` and
reloads its profile; missing/inactive profiles fail closed. Auth metadata, URL
roles, localStorage, and browser JSON do not authorize. Roles are independent;
SYSTEM_ADMIN has no manufacturing authority.

Next.js `src/proxy.ts` uses verified claims to refresh SSR cookies, forwards
updated cookies to the request/response, preserves cache headers on redirects,
and redirects unauthenticated protected navigation. Page guards and APIs perform
independent current-profile authorization. Cookies are HttpOnly, SameSite=Lax,
and Secure on HTTPS; current frontend authentication uses server APIs, not the
browser Supabase factory. Private pages/APIs use `private, no-store`. Persona
changes use full navigation to discard previous account content.

| Endpoint                            | Behavior                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------- |
| POST `/api/auth/login`              | Strict email/password credentials; canonical user and role destination.         |
| POST `/api/auth/demo`               | One of three allowlisted account selectors; real private-credential Auth login. |
| POST `/api/auth/logout`             | Sign out the local session, including an inactive account.                      |
| GET `/api/auth/me`                  | Fresh safe current identity.                                                    |
| GET/POST `/api/admin/users`         | Admin-only filtered cursor list / synchronous production-user creation.         |
| PATCH `/api/admin/users/:id/role`   | Production-role change with expected revision and audit.                        |
| PATCH `/api/admin/users/:id/status` | Activation/deactivation with expected revision and audit.                       |
| GET `/api/admin/audit`              | Admin-only immutable account-event cursor list.                                 |

`/admin` contains Users and Administrative audit. `/supervisor` now contains the cutting workflow; `/verifier` and `/sewing` remain protected identity shells. Wrong-role page navigation
returns to the user's own area; wrong-role API requests return 403. The supervisor workspace lists real factory cutting orders and prepares/submits batches. The verification terminal and Sewing Queue await G06/G07.
The compact light UI follows [15](docs/15_UI_DESIGN_SYSTEM.md), with readable
fields, semantic tables, native accessible dialogs, focus/error states, and
responsive navigation. Temporary passwords clear after submission attempts.

Admin creation is Auth create → atomic profile/audit persistence → safe 201.
If persistence fails, check whether the profile committed before attempting
cleanup of the newly created incomplete Auth identity. A committed/uncertain
outcome is preserved for reconciliation; cleanup success/failure still returns
a controlled error. Duplicate-email failure never deletes an existing user.
Role/status mutations recheck active admin authority under deterministic locks
and atomically append immutable audit. Admin accounts cannot be changed through
normal APIs; self-deactivation/demotion/production assignment and SYSTEM_ADMIN
creation are denied. Deactivation blocks subsequent app/RLS access even while an
older Auth JWT remains cryptographically valid.

## Architecture

```text
Frontend → API Route Handler → Controller → Service → Repository → Supabase
```

Controllers resolve server identity, authorize, validate strict Zod schemas, and
map requests. Services own behavior and compensation; repositories own typed
Auth/database access. JSON errors carry a request ID and safe codes/messages;
no provider exceptions, passwords, tokens, or stack traces reach the response.
Domain types/schemas are under `src/modules/`; server code is under
`src/server/{auth,controllers,http,repositories,services}/`. Frontend components
call same-origin APIs, with no business database queries.

## Supabase migration workflow

Cloud PostgreSQL **17.11** is the target; isolated tests use major 17. Six
version-controlled SQL migrations establish G03 schema/recipes/whitespace guards
and G04 identity/admin commands plus the private Auth ID/email projection.
Applied SQL is immutable; fixes require forward migrations.

```bash
npm run test:db
npm run supabase:remote:list
npm run supabase:remote:plan
npm run supabase:remote:push
npm run supabase:schema:verify
DOCKER_HOST=unix:///var/run/docker.sock npm run supabase:types
```

Operator tooling passes the database password through `PGPASSWORD`, excludes it
from CLI arguments, and withholds raw provider output. The supported `--db-url`
workflow needs no Management API token/login. `psql` is required for verification
and first-admin provisioning. CLI type generation uses Docker; this machine's
working default Engine is at `/var/run/docker.sock`. No global Docker context is
changed. Existing CLI login/link scripts remain an optional operator workflow.

`src/types/database.generated.ts` comes from the actual public schema. Existing
Prettier formats it automatically; successful output replaces the file atomically.
Never manually rewrite generated definitions. All three factories bind Database;
generated types remain typechecked and format-checked.

## Database and access boundaries

Ten tables: profiles, recipes, recipe_components, cutting_orders,
order_components, verification_attempts, verification_items, verification_logs,
verification_log_items, and admin_audit_events. See the
[relationship diagram](docs/05_DOMAIN_MODEL.md) and
[database inventory](docs/06_DATABASE_DESIGN.md).

Six enums, 21 restrictive foreign keys, 51 CHECKs, 44 indexes, and 26 historical/
immutability triggers preserve approved G03 rules. Quantities are bounded integers;
fabric uses bounded numeric scale checks to reject excess precision. Signed
variance/wastage remains representable; caps do not gate approval. Sewing metadata
stays on VERIFIED orders. Only the exact two recipes and ten BOM components are
SQL-seeded; no orders, verification attempts, or manufacturing events are created.

RLS remains enabled on every table. G04 grants authenticated SELECT only on its
own active profile with one scoped policy. All other ordinary table access and
all direct API mutations remain denied, including service-role DML. Four public
invoker gateways are executable only by the backend service role. They delegate
to private, fixed commands owned by a NOLOGIN role with profile/audit privileges
only. That role has no production/reference-table access, no API-role membership,
and no managed Auth schema/table access. A private security-barrier view supplies
only Auth ID/email using the existing operator's permissions; no API role can
read it directly. Every admin command locks/rechecks its server-supplied actor.
Private trigger helpers and order-number sequence stay inaccessible to API roles.

## Tests and commands

| Command                              | Purpose                                                                           |
| ------------------------------------ | --------------------------------------------------------------------------------- |
| `npm ci`                             | Fresh exact-lockfile installation.                                                |
| `npm run typecheck` / `npm run lint` | Strict TypeScript and zero-warning lint.                                          |
| `npm run format:check`               | Formatting check; numbered documentation formatting preserved.                    |
| `npm test`                           | Offline unit/API tests; no cloud dependency.                                      |
| `npm run test:db`                    | Disposable PostgreSQL migrations, RLS/grants, structural/history/admin atomicity. |
| `npm run test:e2e`                   | Build, then real-account desktop/mobile browser journeys.                         |
| `npm run build` / `npm run start`    | Production build/server.                                                          |
| `npm run supabase:check`             | Read-only provider connectivity diagnostic.                                       |
| `npm run bootstrap:users`            | Private operator provisioning/replay.                                             |

Install Chromium once with `npx playwright install chromium` (use `--with-deps`
if system libraries are missing). E2E loads ignored real-account configuration,
uses one worker to isolate shared demo accounts, owns port 3100, and overrides
APP_ORIGIN only for its server. Auth traces are disabled to avoid credential/
cookie artifacts. Role/status tests restore the original production profile in
finally; they create no extra Auth accounts or manufacturing fixtures. Cutting browser tests persist identifiable E2E-CUTTING batches in the configured assessment database; immutable records are retained. Verification/sewing acceptance follows G06/G07.

`test:db` never loads cloud environment files. Its network-isolated container has
no host ports, simulates the restricted cloud operator/managed Auth namespace,
runs actual migrations and idempotent seeds, and uses rollback-only fixtures.
The minimal local Auth FK/subject accessor is not Supabase login implementation.
Only its own container is removed. The full local Supabase stack remains optional;
never reset the assessment cloud database.

Production dependency audit has zero findings. The nine high development-tooling
findings inherited from G01 and ESLint 9 EOL remain documented in
[architecture decisions](docs/14_ARCHITECTURE_DECISIONS.md). No new dependencies
or forced downgrades were introduced. Detailed contracts, roadmap, failure/fix
history, and actual completion evidence are in [docs](docs/).

## Cutting workflow (G05)

CUTTING_SUPERVISOR alone can GET/POST /api/orders, read/edit /api/orders/:id and invoke named /submit or /recut commands. GET /api/recipes permits both cutting roles. Create saves CUTTING_IN_PROGRESS; Submit changes to PENDING_VERIFICATION and atomically freezes the full BOM/recipe/target plus a new uncounted verification attempt. Recipe/target stay frozen during re-cut, while replacement roll/fabric can be saved. Previous finalized attempts and evidence remain permanent. Server calculations derive target × pieces/garment and exact target × standard yards; client identity/status/expected fields are rejected.

G05 introduces eight scoped production/reference SELECT policies in addition to own-active-profile RLS. User JWTs supply reads; a separate restricted NOLOGIN command owner supplies four backend-only invoker gateways. Direct writes and user command execution remain denied. All writes lock/recheck the active actor and order and use current revisions. Isolated SQL tests cover command authorization, re-cut and injected submission rollback; browser tests cover real creation/edit/submit/reload.
