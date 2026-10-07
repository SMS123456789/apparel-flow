# Manual deployment guide

**Current deployed application:** [https://apparel-flow.vercel.app/](https://apparel-flow.vercel.app/)

The user supplied this existing production deployment for final verification.
This guide documents reproduction and operator maintenance; no replacement
deployment, configuration or DNS change was performed during verification.
[Final assessment evidence](docs/17_FINAL_ASSESSMENT_VERIFICATION.md) distinguishes
the deployed version from the current local branch. Keep private values private.

## 1. Pre-deployment checks

Use the merged `main`, Node 22.23.2 (`nvm use`) and npm 10.9.8. Preserve an existing
ignored `.env.local`; otherwise copy `.env.example` and configure it. Install
Chromium once with `npx playwright install --with-deps chromium`. Docker and
`psql` are needed for the database/operator checks. Configure the real four test
accounts in section 6 before browser tests.

```bash
git switch main
git pull --ff-only
npm ci
npm run typecheck
npm run lint
npm run format:check
npm test
npm run test:db
npm run test:e2e
npm run build
node --import tsx scripts/audit-private-values.ts
npm audit --omit=dev
git status --short
```

All commands should exit zero and Git should be clean. Expected current results:
215 Vitest tests, 23 Playwright passes/one duplicate viewport-review skip, eight
SQL migrations/four actual two-session races and a successful Next.js build.
Browser tests run a local production server at `127.0.0.1:3100` against the
configured Supabase DB, temporarily restore demo role/activity changes and leave
attributable E2E records/audit under the no-delete rule. Use controlled accounts
without concurrent evaluator activity. The production audit is clean; the full
dev-tool audit has nine documented high findings with no patched upstream braces
release. See [README limitations](README.md#submission-and-limitations).

## 2. Supabase checklist

Sign into Supabase and select the intended cloud project. Its URL and all keys
must belong to the same project. The existing assessment project is already
migrated; verify it from your configured operator workspace:

```bash
npm run supabase:check
npm run supabase:remote:list
npm run supabase:schema:verify
npm run bootstrap:users
```

The read-only schema verifier checks exact local/remote history, all ten tables'
RLS, scoped grants/policies, restricted commands/views/triggers, six enums and the
exact two recipes/ten BOM rows. Bootstrap checks public signup disabled and real
sign-in/active profile for the private admin and three production accounts.
Expect PASS output without passwords/provider details.

Expected migration versions, in order:

```text
20261006153000  20261006153100  20261006155500  20261006163000
20261006170000  20261006180000  20261006190000  20261006200000
```

If an intended new project is missing migrations, use its database password from
Supabase's Connect/database settings in ignored `SUPABASE_DB_PASSWORD`.
`SUPABASE_DB_URL` optionally overrides the default direct connection; store the
password separately. For an IPv4-only network, use the project's **session
pooler** connection details from Connect. Then:

```bash
npm run supabase:remote:plan
# Confirm only intended unapplied forward migrations, then:
npm run supabase:remote:push
npm run supabase:schema:verify
npm run supabase:types
```

Type generation requires Docker; on this Linux workspace use
`DOCKER_HOST=unix:///var/run/docker.sock npm run supabase:types` if needed. Review
generated changes. Do not edit applied SQL/types by hand, reset cloud data or run
`supabase/tests/*` mutation fixtures against cloud. The cloud project must expose
`public` to the Data API; `app_private` stays unexposed. Keep **Allow new users to
sign up** disabled in Authentication settings. Local `supabase/config.toml`
does not change cloud settings.

## 3. Vercel project setup

1. Sign into Vercel yourself. Select **Add New → Project**, connect GitHub if
   needed, and import `SMS123456789/apparel-flow` from `main`.
2. Select framework **Next.js**, root directory **`.`** (repository root), install
   command **`npm ci`**, and build command **`npm run build`**. Keep the framework's
   automatic Output Directory; this app uses Next.js server routes and is not a
   static export. [Vercel build settings](https://vercel.com/docs/builds/configure-a-build).
3. Choose **Node.js 22.x** in Build and Deployment settings. The repository's
   engine restricts Node to 22; local testing uses 22.23.2. Vercel manages the
   major version's patch updates. [Supported Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).
4. Add section 4's Production variables before the initial build. Choose a
   project name and use the stable Production domain shown by Vercel for
   `APP_ORIGIN`. If that domain is only known after initial deployment, correct
   `APP_ORIGIN` from **Settings → Domains** and redeploy before sign-in testing.
   The application's origin check deliberately rejects a mismatch.

Do not configure a custom domain/DNS for this assessment; the assigned HTTPS
Vercel Production domain is sufficient. Use that canonical domain for evaluation.

## 4. Environment variables

Copy Supabase URL/publishable key from the project's **Connect** dialog or
**Settings → API Keys**; copy its secret key from API Keys. Legacy `anon` and
`service_role` keys are accepted in the corresponding public/secret variables.
[Supabase key guidance](https://supabase.com/docs/guides/getting-started/api-keys).

**`SUPABASE_SECRET_KEY` — SERVER ONLY — NEVER EXPOSE IN CLIENT CODE.** Never prefix
it, demo passwords or admin/operator credentials with `NEXT_PUBLIC_`. No actual
secret value belongs in this guide, Git, screenshots or logs.

| Variable                               | Value source / purpose                                                              | Exposure             | Vercel environment                                            |
| -------------------------------------- | ----------------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Intended project's HTTPS URL                                                        | Browser-safe         | Production; Preview/Development only if used                  |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Same project's publishable key, or legacy anon                                      | Browser-safe         | Same as URL                                                   |
| `SUPABASE_SECRET_KEY`                  | Same project's secret key, or legacy service_role                                   | Server only          | Production; isolated Preview/Development if used              |
| `APP_ORIGIN`                           | Actual canonical origin, e.g. `https://<assigned-domain>.vercel.app`; no slash/path | Server configuration | Production; exact respective origin for any other environment |
| `DEMO_ACCOUNTS_ENABLED`                | `true` for evaluator buttons; otherwise `false`                                     | Server configuration | Production for assessment; optional elsewhere                 |
| `DEMO_CUTTING_SUPERVISOR_EMAIL`        | Controlled supervisor Auth account email                                            | Server only          | Production when demos enabled                                 |
| `DEMO_CUTTING_SUPERVISOR_PASSWORD`     | That account's configured password                                                  | Server only          | Same                                                          |
| `DEMO_CUTTING_VERIFIER_EMAIL`          | Controlled verifier Auth account email                                              | Server only          | Same                                                          |
| `DEMO_CUTTING_VERIFIER_PASSWORD`       | That account's configured password                                                  | Server only          | Same                                                          |
| `DEMO_SEWING_SUPERVISOR_EMAIL`         | Controlled sewing Auth account email                                                | Server only          | Same                                                          |
| `DEMO_SEWING_SUPERVISOR_PASSWORD`      | That account's configured password                                                  | Server only          | Same                                                          |

The first four are required for application operations. All six demo account
values are required when demos are enabled. The production assessment should
have demos enabled. A preview also needs the same application variables with its
own exact origin and controlled database/accounts if you elect to use it; this
implementation does not automatically trust changing preview domains. Local
`npm run dev` reads ignored `.env.local`, with `APP_ORIGIN=http://localhost:3000`.

These are **operator/test-only** values; keep them locally, not in Vercel:

| Variable                                             | Source / purpose                                                                                     |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `SUPABASE_DB_PASSWORD`                               | Database password for migrations/verifier/initial admin bootstrap; legacy `db_password` is supported |
| `SUPABASE_DB_URL`                                    | Optional password-free direct/session-pooler connection from Connect                                 |
| `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` | Private initial admin credentials chosen/stored by operator                                          |
| `BOOTSTRAP_ADMIN_FULL_NAME`                          | Optional private admin name; defaults to ApparelFlow Administrator                                   |
| `DATABASE_TEST_DOCKER_CONTEXT`                       | Optional isolated-test Docker context; defaults to `default`                                         |

No Supabase CLI token, database password or admin password is required by the
running website. Set secrets directly in Vercel's environment-variable UI.
Changes affect new deployments; redeploy after any change, especially public
variables that Next.js embeds during build. [Vercel environment variables](https://vercel.com/docs/environment-variables).

## 5. Supabase Auth URL configuration

After obtaining the stable Production URL, open Supabase
**Authentication → URL Configuration** and set **Site URL** to
`https://<actual-production-domain>.vercel.app`. Use that same origin as Vercel
`APP_ORIGIN`. Supabase uses Site URL as the default for redirect-based flows.
[Supabase redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls).

This app implements password sign-in at `/login` through `/api/auth/login` and
real persona sign-in through `/api/auth/demo`. It does not use OAuth, magic links,
email recovery or an Auth callback. **No additional Auth Redirect URLs are
required by this implementation.** Do not add `/auth/callback` or
`/api/auth/callback`. Local development remains `http://localhost:3000/login`;
production sign-in is `https://<actual-production-domain>.vercel.app/login`.
Changing Site URL does not fix a wrong `APP_ORIGIN` or mismatched Supabase keys.

## 6. Demo user setup

In ignored `.env.local`, configure the four application variables, database
operator values for a first bootstrap, private `BOOTSTRAP_ADMIN_*` and the six
`DEMO_*` values. Use distinct controlled emails and passwords of 12–128 characters.
Keep the private admin password in your password manager/ignored local config.
Disable cloud public signup before running:

```bash
npm run bootstrap:users
```

Expected PASS lines verify SYSTEM_ADMIN and Cutting Supervisor, Cutting Verifier,
Sewing Supervisor. Replay verifies existing passwords/roles/activity without
resetting or overwriting them. Existing mismatches require reconciliation through
the private admin/operator; missing profiles fail closed. The script creates
confirmed controlled Auth identities and matching active profiles; no invitation
email is sent.

Copy only the three demo pairs to Vercel and set `DEMO_ACCOUNTS_ENABLED=true`.
At the public `/login`, evaluators select a persona button to authenticate its
real account. Sign out between personas. Ordinary email/password login also
works with those controlled credentials. Never publish the SYSTEM_ADMIN password
or offer an admin demo persona. Verify the private admin locally through ordinary
sign-in; account administration is secondary to the production assessment.

## 7. Deploy — user action

In the Vercel import screen, review settings/environment variables and click
**Deploy**. Wait for **Ready**, copy the stable Production domain from the project,
and complete section 5. Correct any domain/env mismatch in **Settings →
Environment Variables**, save, then use **Deployments → latest Production
Deployment → … → Redeploy**. Use fresh build cache after changing public keys.
Confirm the final build is from merged `main`, with Node 22 and the intended
Supabase project. [Vercel deployments](https://vercel.com/docs/deployments).

If evaluator access encounters Vercel's deployment protection, configure the
Production deployment's access in the project's Deployment Protection settings
so the evaluator can reach `/login`; application authentication must remain
required. Run section 8 on the canonical Production domain. Record the resulting
URL for submission only after these checks pass.

## 8. Post-deployment smoke test

1. Open the public `/login` in a private browser window. All three demo buttons
   should be available. Unauthenticated `/api/auth/me` should return 401.
2. Sign in as Cutting Supervisor. Create 50 Casual Blouses, a unique roll and
   94.5 actual yards; confirm 90 expected yards and 100 cuffs/sleeves. Save and
   submit. Record the order number/UUID; refresh to confirm persistence.
3. Switch to Sewing first: searching this number must return no batch; its
   `/api/sewing/<UUID>` must return 404. Then sign in as Cutting Verifier.
4. Enter 0 for Front Body Panel and **Save Counts**. Refresh: zero persists,
   Shortage 50 appears and Approve is disabled. Test the direct request below:
   current RED/uncounted counts must still produce 422.
5. Reject without a reason must fail. Reject with a meaningful reason, switch to
   Supervisor, Begin Re-cut, save replacement roll/fabric and resubmit. Verifier
   sees fresh blank counts and prior immutable rejection evidence.
6. Count every required piece at the expected quantity, **Save Counts**, and
   confirm approval. A surplus may also be approved. The result is VERIFIED with
   verifier/time, piece variances and signed fabric percentage.
7. Sign in as Sewing Supervisor. Search/open the verified batch; only approved
   evidence is exposed. Start Sewing Assembly and refresh. Actor/time persist,
   status stays VERIFIED and repeating the direct start returns 409.
8. As Supervisor, the approve request must return 403; Sewing/Admin also lack
   verification permission. Sewing queue APIs return 403 for other roles.
   `?status=REJECTED` on the sewing queue returns 422, never hidden records.

For a same-origin direct approval test, use the browser console on the canonical
app domain while signed in; replace only `ORDER_ID` with the recorded UUID:

```javascript
const orderId = "ORDER_ID";
const detail = await fetch(`/api/verification/${orderId}`, {
  cache: "no-store",
});
const { data: batch } = await detail.json();
const response = await fetch(`/api/verification/${orderId}/approve`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    attemptId: batch.currentAttemptId,
    expectedRevision: batch.revision,
  }),
});
console.log(response.status); // 422 with saved shortage; 200 only for eligible counts.
```

For wrong-role testing, keep the recorded attempt/revision and send that same
body after switching to Supervisor. Do not fetch verifier detail with a wrong
role, because that detail itself correctly returns 403. Never paste cookies,
JWTs or secret keys into diagnostics.

## 9. Troubleshooting

| Symptom                                               | Check / recovery                                                                                                                                                                                                                                  |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Missing/invalid environment variable or build failure | Vercel Build Logs; verify names, Production scope, no quotes/spaces, Node 22, root `.`, `npm ci`, `npm run build`. Reproduce preflight locally. Never paste secrets/provider errors publicly.                                                     |
| Supabase URL/key mismatch; 503 dependency failure     | Same project in Connect/API Keys for URL, public and secret key. `npm run supabase:check`; set correct values and rebuild/redeploy.                                                                                                               |
| Login 403 / missing profile                           | Authentication Users and `public.profiles`: same UUID, correct production role and `is_active=true`; use bootstrap/private admin. Auth metadata does not grant a role.                                                                            |
| Inactive/misassigned demo account                     | Private `/admin` manages role/activity; bootstrap intentionally refuses to silently reactivate/reassign existing accounts. Verify the matching password before retrying.                                                                          |
| Demo buttons absent                                   | `DEMO_ACCOUNTS_ENABLED=true` and all six demo values on the running environment; redeploy. No admin persona is expected.                                                                                                                          |
| Origin mismatch / every mutation 403                  | Match actual browser origin exactly to `APP_ORIGIN`: HTTPS, correct stable domain, no trailing slash/path. Avoid alternate deployment URLs; redeploy after correction.                                                                            |
| Redirect mismatch                                     | This app has no redirect-based Auth callback. Check Site URL and actual `/login`, then distinguish wrong origin/keys/session from a nonexistent callback path.                                                                                    |
| Cookies/session do not persist                        | Use the same canonical HTTPS hostname, inspect HttpOnly/SameSite cookies in browser storage and private/no-store responses; avoid a proxy/CDN caching authenticated responses. Clear stale cookies and sign in again after project-key changes.   |
| Migration/type mismatch                               | `npm run supabase:remote:list`, `supabase:remote:plan`, `supabase:schema:verify`; apply only missing intended forward SQL and regenerate types. Do not reset or rewrite history.                                                                  |
| RLS denies a legitimate operation / empty results     | Confirm current active profile and resource state. Sewing only sees VERIFIED/approved children; Verifier sees submitted work. Run schema verifier for grants/policies; inspect sanitized request ID/logs. Do not disable RLS or grant raw writes. |
| 409 save/approve/start                                | Reread authoritative state. Verifier retains local counts for deliberate review/Save Counts. After a decision timeout inspect committed state before retrying. Repeated sewing start correctly conflicts.                                         |
| Operator database/Docker failure                      | Check `psql`, network/session-pooler connection, separate DB password and Docker availability/context. `npm run test:db` is disposable/local only; type generation may need the Linux host Docker socket above.                                   |

The current production URL is recorded above. Test results and any deployed-version
gaps are recorded in the final assessment report. Submission evidence is in
[the submission checklist](docs/16_SUBMISSION_CHECKLIST.md).
