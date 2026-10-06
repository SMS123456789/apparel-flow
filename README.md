# ApparelFlow

Cutting Operations & Gatekeeper Verification Terminal. The future application
will enforce the cutting-to-sewing verification checkpoint described in the
[project specification](docs/00_PROJECT_CHARTER.md).

**Current stage: G03 database foundation.** G01/G02 were merged through
[PR #1](https://github.com/SMS123456789/apparel-flow/pull/1) and
[PR #2](https://github.com/SMS123456789/apparel-flow/pull/2). Three migrations now
establish the cloud schema and exact assessment recipes, with default-deny RLS,
immutable evidence protection, generated types, and database verification.
Authentication flows, role policies, approval RPCs, business APIs, and production
UI remain later milestones. G03 stops before G04.

## Stack and setup

Next.js 16.3.8 App Router, React 19.3.0, strict TypeScript 5.9.3, Tailwind CSS
4.3.3, shadcn/ui infrastructure, Zod 4.6.5, Vitest 5.0.3, and Playwright 1.63.0.
Supabase JavaScript SDK 2.117.2, SSR helpers 0.12.7, and CLI 2.119.0 provide the
Auth/PostgreSQL infrastructure. Deployment target: Vercel. Prisma and Auth.js
are not used.

Use Node **22.23.2** (`.nvmrc`) and npm **10.9.8**. The engine range requires Node
22.12+ within Node 22 and npm 10.9+ within npm 10. Dependencies are exact-pinned
and resolved in `package-lock.json`; use `npm ci` for reproducible installation.

```bash
nvm use
npm ci
npm run dev
```

Open <http://localhost:3000>. The neutral home page and offline tests require no
Supabase credentials; factories validate configuration only when called.
For connectivity, copy `.env.example` to ignored `.env.local` and replace its
placeholders. An existing ignored `.env` is also supported by Next.js and the
check script. Do not commit credentials.

## Commands

| Command                          | Purpose                                                               |
| -------------------------------- | --------------------------------------------------------------------- |
| `npm run dev`                    | Development server                                                    |
| `npm run build`                  | Production build                                                      |
| `npm run start`                  | Serve the existing production build                                   |
| `npm run lint`                   | ESLint with zero allowed warnings                                     |
| `npm run typecheck`              | Generate Next.js route types, then strict TypeScript check            |
| `npm run format`                 | Format scaffold files; preserve existing numbered docs                |
| `npm run format:check`           | Check scaffold formatting                                             |
| `npm test`                       | Vitest unit/integration tests; no browsers                            |
| `npm run test:watch`             | Vitest watch mode                                                     |
| `npm run test:e2e`               | Build and run Chromium desktop/mobile home-page smoke tests           |
| `npm run supabase:check`         | Read-only cloud Auth/Data API connectivity verification               |
| `npm run supabase:status`        | Inspect an optional local Supabase stack                              |
| `npm run test:db`                | Validate migrations/constraints/immutability in disposable PostgreSQL |
| `npm run supabase:remote:list`   | Inspect cloud/local migration versions using ignored operator config  |
| `npm run supabase:remote:plan`   | Dry-run unapplied cloud migrations                                    |
| `npm run supabase:remote:push`   | Apply reviewed version-controlled cloud migrations                    |
| `npm run supabase:schema:verify` | Read-only cloud catalog, RLS/grant and recipe assertions              |
| `npm run supabase:types`         | Atomically generate/format public-schema TypeScript definitions       |

Before E2E tests, install the matching browser once:

```bash
npx playwright install chromium
npm run lint
npm run typecheck
npm test
npm run format:check
npm run test:e2e
```

On a Linux machine missing browser system libraries, use
`npx playwright install --with-deps chromium`. Playwright owns an isolated
production server on port 3100 and stops it after tests; keep that port available.
These smoke tests prove the scaffold, not the assessment's manufacturing rules.

Dependency checks found no production vulnerabilities. Development tooling has
nine audit findings inherited from the unpatched `braces` advisory
[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
ESLint 9 is upstream EOL but matches the current Next.js plugins' declared peer
support; migrate when those plugins support ESLint 10. These limitations are
tracked in the architecture decisions, without forced dependency downgrades.

## Architecture and source conventions

The modular monolith uses:

```text
Frontend → API Route Handler → Controller → Service → Repository → Database
```

Routes delegate HTTP requests; controllers validate trusted identity, invoke
authorization guards, parse Zod input, and map results. Services own workflows
and business rules. Repositories perform persistence. Domain code stays free of
React, Next.js, Supabase, HTTP, and environment access. No route-to-database or
privileged component-to-database shortcuts.

Current source and test files:

```text
src/
  app/{layout.tsx,page.tsx,globals.css}
  lib/env/{keys.ts,public.ts,server.ts}
  lib/supabase/{client.ts,server.ts,admin.ts}
  lib/utils/index.ts
  types/database.generated.ts
tests/
  unit/{classnames,environment,supabase-clients}.test.ts
  e2e/home.spec.ts
scripts/{check-supabase,manage-database,test-database}.ts
supabase/
  config.toml
  .gitignore
  migrations/{20261006153000_apparelflow_domain_schema,20261006153100_assessment_recipes,20261006155500_rejection_reason_whitespace}.sql
  tests/{bootstrap,schema_catalog,domain_constraints}.sql
```

Future directories are created when their authorized implementation needs them;
there are no empty files or artificial placeholder modules:

```text
src/
  app/
    (auth)/ (admin)/ (supervisor)/ (verifier)/ (sewing)/
    api/
  components/{ui,layout,shared}/
  domain/{orders,verification,sewing,users,recipes}/
  server/{controllers,services,repositories,auth,validation,errors}/
  lib/{supabase,utils}/
  types/
tests/{unit,integration,e2e}/
docs/
```

Use `@/*` imports rooted at `src/`. Vitest resolves the same alias and collects
only `tests/unit` and `tests/integration`; Playwright owns `tests/e2e`. Strict
TypeScript includes unchecked-index and exact-optional-property checks. ESLint
uses Next.js Core Web Vitals/TypeScript rules and rejects explicit `any`.
Prettier and EditorConfig define two-space indentation and LF line endings.

shadcn/ui is manually initialized with `components.json`, a light neutral
CSS-variable theme, Tailwind 4 PostCSS, and the `cn` utility exported from
`@/lib/utils`. No UI component collection is installed. Its CLI is pinned locally;
future authorized components can be added with `npx shadcn add <component>`.
See [shadcn manual installation](https://ui.shadcn.com/docs/installation/manual).
Zod validates infrastructure environment configuration; future request schemas
will live in `src/server/validation` when APIs are implemented.

Future security follows [07](docs/07_AUTH_SECURITY_RBAC_RLS.md): Supabase identity,
server authorization, RLS defense, same-origin mutation protection, private
`no-store` data, and server-only elevated credentials. UI visibility is not
authorization. There will be no generic production-status setter or fake roles.

Future error concepts live in `src/server/errors`: AuthenticationError (401),
AuthorizationError (403), NotFoundError (404), ValidationError/BusinessRuleError
(422), InvalidStateTransitionError/ConflictError (409), and sanitized unexpected
errors (500). The full response contract remains in
[08](docs/08_API_CONTRACT.md); the infrastructure adds no business error framework
or API.

## Supabase configuration and clients

| Variable                               | Boundary and use                                                                               |
| -------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Browser-safe project URL, shared by all factories                                              |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-safe publishable API key, browser Auth and user-context server clients                 |
| `SUPABASE_SECRET_KEY`                  | **SERVER ONLY — NEVER PREFIX AS PUBLIC — NEVER EXPOSE TO BROWSER**; privileged backend adapter |

Modern keys follow [official Supabase API-key guidance](https://supabase.com/docs/guides/getting-started/api-keys).
A legacy project's `anon` value can fill the publishable variable; its
`service_role` value can fill the secret variable. Existing
`SUPABASE_SERVICE_ROLE_KEY` variable names must be mapped to `SUPABASE_SECRET_KEY`
locally. No actual key belongs in docs, logs, snapshots, or Git.

`src/lib/env/public.ts` exposes only the two public values and rejects privileged
keys in the public field. `server.ts` is guarded by `server-only` and validates
the secret separately. Errors contain variable names, never values. Offline tests
use synthetic fixtures and mock SDK constructors; they need no live project.

The browser factory uses `createBrowserClient` from `@supabase/ssr` for future
cookie-based Auth. Application business reads/mutations still use the backend
layers. The async server factory awaits Next.js `cookies()`, creates one
user-context client per request, and transfers cookie writes and SSR cache
headers to the caller's `Headers`. Callers must use those headers in their
response. Cookie-write errors are not swallowed; use writable Route Handler or
Server Action contexts. Read-only rendering and session-refresh proxy integration
are deferred until G05, when authenticated pages exist. See
[Supabase SSR guidance](https://supabase.com/docs/guides/auth/server-side/creating-a-client).

The admin factory and server environment module both import `server-only`.
Privileged Auth persistence/refresh/URL-session detection are disabled. Both
server factories fetch with `no-store`. No factory runs from the home page.
Only future trusted backend repositories/Auth adapters may use elevated access;
it never supplies ordinary user-context reads or bypasses manufacturing rules.

Run `npm run supabase:check` to verify configured cloud connectivity. This
development-only script loads ignored env files with `@next/env`, uses the
public key for Auth health, the server credential for Data API OpenAPI metadata,
and the privileged SDK for a single read-only Auth user-list request. No response
bodies or user data are printed. The
[OpenAPI endpoint now requires privileged credentials](https://supabase.com/changelog/42949-breaking-change-removing-access-to-openapi-spec-via-the-anon-key).
Missing/invalid config or failed requests return nonzero. These checks prove API
connectivity, not future application tables, RLS, login, or transaction behavior.
No public diagnostics endpoint is exposed.

## Supabase migration workflow

Cloud PostgreSQL **17.11** is the primary target. G03 applied the schema, recipe,
and rejection-reason whitespace migrations in `supabase/migrations/` using the
pinned CLI. Every schema
change must have version-controlled SQL. Never edit applied history; introduce a
new migration for future changes. The Dashboard is for inspection/project
configuration, with application schema reproducible from the repository.

Operator scripts load ignored env files. `SUPABASE_DB_PASSWORD` (legacy
`db_password` supported) is **server/operator-only**, separate from application
API keys. The documented direct database host is derived from the project URL;
optional `SUPABASE_DB_URL` can supply the exact session-pooler URI from the
project's Connect dialog. Passwords are passed through `PGPASSWORD`, removed
from CLI arguments, and never logged. App clients do not use this password.
See [Supabase connection guidance](https://supabase.com/docs/guides/database/connecting-to-postgres).

Reviewable cloud migration workflow:

```bash
npm run supabase:migration:new -- <migration-name>
# Implement/review the generated SQL; validate in isolation before applying.
npm run test:db
npm run supabase:remote:list
npm run supabase:remote:plan
npm run supabase:remote:push
npm run supabase:schema:verify
npm run supabase:types
```

These scripts use supported CLI `--db-url` flags; no Management API token/login
is required for the configured direct connection. `psql` must be installed for
verification. CLI login/link with a separate personal access token remains an
alternative; the existing `supabase:link`, `supabase:migration:list -- --linked`,
and `supabase:db:push -- --linked` scripts still support that operator workflow.
No history repair or cloud reset was used.

`npm run test:db` uses an isolated PostgreSQL 17 container, default Docker context
(override with `DATABASE_TEST_DOCKER_CONTEXT`), no network/host ports, actual SQL
migrations, idempotent seed replay, and rollback-only fixtures. It removes its
own container in a finally block. Its minimal Auth identity/role infrastructure
is only for FK/RLS tests; it neither calls nor implements Supabase Auth. No test
production records or Auth users are inserted into the cloud project.

CLI type generation needs Docker when using `--db-url`. On this machine the
desktop context is unavailable and the existing default Engine is usable:

```bash
DOCKER_HOST=unix:///var/run/docker.sock npm run supabase:types
```

Use ordinary `npm run supabase:types` where the selected Docker daemon works.
The CLI generates `src/types/database.generated.ts` from the real public schema;
existing Prettier formats it automatically, and the file is replaced atomically
only after successful output/credential checks. Never manually rewrite generated
definitions. All factories bind its `Database` generic. Generated helper code is
excluded from authored-code ESLint rules but still strict-typechecked and
format-checked. No empty/failed generated file is committed.

The full local Supabase stack remains optional. `supabase:start/status/stop` and
`supabase:db:reset -- --local` operate only that disposable stack. Local config
uses PostgreSQL 17, disables signup/implicit grants and separate seed files;
the two recipe seeds are migrations, so both cloud push and local reset include
them. Cloud Auth settings are configured later with authentication work.
Migration SQL flows through version control to Supabase; Vercel consumes the
resulting app configuration. See [migration guidance](https://supabase.com/docs/guides/deployment/database-migrations)
and [generated types](https://supabase.com/docs/guides/api/rest/generating-types).

## Implemented database foundation

Ten application tables: `profiles`, `recipes`, `recipe_components`,
`cutting_orders`, `order_components`, `verification_attempts`, `verification_items`,
`verification_logs`, `verification_log_items`, and `admin_audit_events`.
`profiles.id` references `auth.users.id`; no duplicate password hash or Auth user
seed exists. Sewing start actor/time stays on `cutting_orders` with status VERIFIED.
The [domain relationship diagram](docs/05_DOMAIN_MODEL.md) and
[actual schema inventory](docs/06_DATABASE_DESIGN.md) explain all relationships.

Six enums cover four lowercase database roles, the four approved order states,
OPEN/APPROVED/REJECTED attempts, GREEN/YELLOW/RED component states,
APPROVED/REJECTED decisions, and four account-management audit actions.
Composite restrictive FKs prevent mixing orders/attempts/recipe components.
CHECKs preserve positive targets/fabric, nullable nonnegative integer counts,
safe-integer bounds, consistent signed count evidence, and trimmed rejection
reasons of 1–1000 characters. Bounded `numeric` scale checks reject overprecision
instead of silently rounding; analytics preserve negative fabric variance and
never gate on the recipe cap.

All tables have RLS enabled and **zero policies**. PUBLIC/anon/authenticated
table access is revoked; service_role has SELECT only with direct mutations
revoked. Private trigger functions/numbering sequence are inaccessible to API
roles. Ordinary reads intentionally await later scoped policies. Generated
Insert/Update types describe structure and do not grant database permissions.

Private invoker triggers block hard deletes/reference-data edits, freeze submitted
recipe/target/BOM and finalized verification evidence, make logs/admin audit
immutable, and preserve verified-order/sewing attribution. Mutable rows share
an updated-at helper. Authorization, legal transitions, full manifest completeness,
and transactional approval/rejection are still future service/RPC work.

Only REC-BL01 Casual Blouse (1.8 yards, 5% cap) and REC-CT02 Crop Top (1.1 yards,
8% cap), with their exact five components each and null images, are seeded.
Deterministic UUIDs and conflict validation make reference-seed replay idempotent.
No profiles, production orders, verification history, or admin events are seeded.

All business requirements and future milestones remain in [docs](docs/).
Concrete G01/G02/G03 choices and actual validation evidence are recorded in
[architecture decisions](docs/14_ARCHITECTURE_DECISIONS.md#g03-database-foundation-decisions).
