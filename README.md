# ApparelFlow

Cutting Operations & Gatekeeper Verification Terminal. The future application
will enforce the cutting-to-sewing verification checkpoint described in the
[project specification](docs/00_PROJECT_CHARTER.md).

**Current stage: G01 scaffold only.** The home page, tooling, and test foundation
are present. Supabase is not connected. Authentication, database configuration,
business APIs, and production features belong to later milestones.

## Stack and setup

Next.js 16.3.8 App Router, React 19.3.0, strict TypeScript 5.9.3, Tailwind CSS
4.3.3, shadcn/ui infrastructure, Zod 4.6.5, Vitest 5.0.3, and Playwright 1.63.0.
Deployment target: Vercel. Supabase Auth/PostgreSQL is planned; Prisma and Auth.js
are not used.

Use Node **22.23.2** (`.nvmrc`) and npm **10.9.8**. The engine range requires Node
22.12+ within Node 22 and npm 10.9+ within npm 10. Dependencies are exact-pinned
and resolved in `package-lock.json`; use `npm ci` for reproducible installation.

```bash
nvm use
npm ci
npm run dev
```

Open <http://localhost:3000>. No environment file is needed for G01.
`.env.example` documents future `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for cookie-based SSR clients. The
`SUPABASE_SERVICE_ROLE_KEY` placeholder is **SERVER ONLY — NEVER PREFIX AS
PUBLIC — NEVER EXPOSE TO BROWSER**. Actual values go into an ignored environment
file in G02. Do not commit credentials. See [Supabase SSR client
documentation](https://supabase.com/docs/guides/auth/server-side/creating-a-client).

## Commands

| Command                | Purpose                                                     |
| ---------------------- | ----------------------------------------------------------- |
| `npm run dev`          | Development server                                          |
| `npm run build`        | Production build                                            |
| `npm run start`        | Serve the existing production build                         |
| `npm run lint`         | ESLint with zero allowed warnings                           |
| `npm run typecheck`    | Generate Next.js route types, then strict TypeScript check  |
| `npm run format`       | Format scaffold files; preserve existing numbered docs      |
| `npm run format:check` | Check scaffold formatting                                   |
| `npm test`             | Vitest unit/integration tests; no browsers                  |
| `npm run test:watch`   | Vitest watch mode                                           |
| `npm run test:e2e`     | Build and run Chromium desktop/mobile home-page smoke tests |

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
  lib/utils/index.ts
tests/
  unit/classnames.test.ts
  e2e/home.spec.ts
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
Zod is installed; request schemas will live in `src/server/validation` when APIs
are implemented.

Future security follows [07](docs/07_AUTH_SECURITY_RBAC_RLS.md): Supabase identity,
server authorization, RLS defense, same-origin mutation protection, private
`no-store` data, and server-only elevated credentials. UI visibility is not
authorization. There will be no generic production-status setter or fake roles.

Future error concepts live in `src/server/errors`: AuthenticationError (401),
AuthorizationError (403), NotFoundError (404), ValidationError/BusinessRuleError
(422), InvalidStateTransitionError/ConflictError (409), and sanitized unexpected
errors (500). The full response contract remains in
[08](docs/08_API_CONTRACT.md); G01 adds no error framework or API.

All business requirements and future milestones remain in [docs](docs/).
Concrete G01 choices are recorded in
[architecture decisions](docs/14_ARCHITECTURE_DECISIONS.md#g01-scaffold-decisions).
