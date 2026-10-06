# ApparelFlow

Cutting Operations & Gatekeeper Verification Terminal. The future application
will enforce the cutting-to-sewing verification checkpoint described in the
[project specification](docs/00_PROJECT_CHARTER.md).

**Current stage: G02 Supabase infrastructure.** G01 was merged through
[PR #1](https://github.com/SMS123456789/apparel-flow/pull/1). Environment validation,
separate Supabase factories, CLI configuration, and read-only cloud connectivity
checks are present. Application tables, authentication flows, RBAC/RLS policies,
business APIs, and production features belong to later milestones.

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

| Command                   | Purpose                                                     |
| ------------------------- | ----------------------------------------------------------- |
| `npm run dev`             | Development server                                          |
| `npm run build`           | Production build                                            |
| `npm run start`           | Serve the existing production build                         |
| `npm run lint`            | ESLint with zero allowed warnings                           |
| `npm run typecheck`       | Generate Next.js route types, then strict TypeScript check  |
| `npm run format`          | Format scaffold files; preserve existing numbered docs      |
| `npm run format:check`    | Check scaffold formatting                                   |
| `npm test`                | Vitest unit/integration tests; no browsers                  |
| `npm run test:watch`      | Vitest watch mode                                           |
| `npm run test:e2e`        | Build and run Chromium desktop/mobile home-page smoke tests |
| `npm run supabase:check`  | Read-only cloud Auth/Data API connectivity verification     |
| `npm run supabase:status` | Inspect an optional local Supabase stack                    |

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
tests/
  unit/{classnames,environment,supabase-clients}.test.ts
  e2e/home.spec.ts
scripts/check-supabase.ts
supabase/{config.toml,.gitignore}
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

Cloud Supabase is the primary target. The CLI is pinned locally and initialized
in `supabase/config.toml`; no SQL, seeds, business tables, or generated database
types exist yet. CLI login uses a separate Supabase personal access token; linking
may require the database password. These are server/operator secrets and are
separate from application API keys. Keep them out of arguments recorded in Git.

Future authorized migration work uses:

```bash
npx supabase login
npm run supabase:link -- --project-ref <project-ref>
npm run supabase:migration:new -- <migration-name>
# Review the generated supabase/migrations/<timestamp>_<name>.sql first.
npm run supabase:migration:list -- --linked
npm run supabase:db:push -- --linked --dry-run
npm run supabase:db:push -- --linked
```

**Every application schema change must be a version-controlled SQL migration.**
The Dashboard is for inspection, Auth users, and project configuration; schema
changes must remain reproducible from the repository. G02 runs no migration push,
reset, or schema changes. CLI login/linking is not configured yet; cloud API
connectivity is independent of that operator workflow.

Optional later local development requires Docker. `npm run supabase:start`,
`supabase:status`, and `supabase:stop` operate only the local stack. Local
`supabase:db:reset -- --local` destroys/recreates that local database; use it only
for an intended disposable development database. G02 does not install/start
Docker. The generated PostgreSQL 17 local default must match the chosen cloud
database version before adopting local migration tests. Local config disables
public signup, seeding, and implicit Data API grants; cloud Auth settings are
managed separately before authentication is implemented.

After G03 creates the schema, generate types instead of inventing them:

```bash
mkdir -p src/types
npx supabase gen types typescript --linked --schema public > src/types/database.ts
# Or, for an explicitly adopted local stack:
npx supabase gen types typescript --local --schema public > src/types/database.ts
```

Review and commit successful output, then bind the factories' Database generic.
Do not commit failed/empty generated files. Migration SQL flows from development
through version control to Supabase; Vercel consumes the resulting application
configuration. Full migration guidance is in
[Supabase's migration documentation](https://supabase.com/docs/guides/deployment/database-migrations).

All business requirements and future milestones remain in [docs](docs/).
Concrete G01/G02 choices are recorded in
[architecture decisions](docs/14_ARCHITECTURE_DECISIONS.md#g02-supabase-foundation-decisions).
