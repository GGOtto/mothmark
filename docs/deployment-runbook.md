# Mothmark deployment runbook

This runbook deploys Mothmark with:

- Vercel for the Next.js application and route handlers
- Neon for PostgreSQL
- Phase as the source of truth for environment variables
- GitHub as the deployment source

The production application gives each editor browser a private anonymous account and owned world.
The `main` world is a read-only template and is never served through the public world API. Keep
previews behind Vercel Authentication; production protection remains a launch decision described in
[Public launch gate](#public-launch-gate).

## The short version for every release after setup

```bash
pnpm lint
pnpm ts-check
pnpm test --runInBand
pnpm build
git push origin <branch>
```

1. Open the Vercel preview created for the branch.
2. Test loading, editing, autosaving, and refreshing the `main` world.
3. For a database change, push the reviewed candidate to the long-lived `staging` branch. The
   staging workflow applies migrations and validates retained data before building and deploying
   that exact commit; test its canonical staging URL.
4. Promote the validated `staging` commit to `prod`.
5. Let Vercel's `vercel.deployment.ready` event start the required production storage compatibility
   check, which applies migrations and validates all retained content before Vercel promotes the
   candidate.
6. Verify the production deployment and its logs.

Never run migrations from `next build` or application startup.

The authoritative schema and release-gate procedures live in the root-level
`SCHEMA_COMPATIBILITY_README.md`, `BREAKING_SCHEMA_MIGRATIONS_README.md`, and
`DEPLOYMENT_STORAGE_GATE_README.md` files.

## Environment map

| Purpose           | Git branch                 | Vercel environment | Phase environment | Neon branch      |
| ----------------- | -------------------------- | ------------------ | ----------------- | ---------------- |
| Local development | Any                        | Development        | Development       | Local PostgreSQL |
| Integration       | `main`                     | Preview            | Staging           | `preview`        |
| Hosted staging    | `staging`                  | Preview            | Staging           | `preview`        |
| Feature preview   | Other branch except `prod` | Preview            | Staging           | `preview`        |
| Live application  | `prod`                     | Production         | Production        | `production`     |

The long-lived Neon `preview` branch is reset from its `production` parent every Monday at 12:00
UTC. The reset workflow then reapplies the current `staging` branch's migrations and validates its
retained content while keeping the preview connection configuration stable.

Use these variables in Phase `Staging` and `Production`:

| Variable                    | Value                                              | Synced to Vercel? |
| --------------------------- | -------------------------------------------------- | ----------------- |
| `DATABASE_URL`              | Pooled Neon connection string containing `-pooler` | Yes               |
| `DATABASE_MIGRATION_URL`    | Direct Neon connection string without `-pooler`    | No                |
| `DATABASE_SSL`              | `true`                                             | Yes               |
| `DATABASE_POOL_MIN`         | `0`                                                | Yes               |
| `DATABASE_POOL_MAX`         | `1`                                                | Yes               |
| `PUBLIC_APP_ORIGIN`         | Exact public origin without a trailing slash       | Yes               |
| `AUTH_EMAIL_FROM`           | Verified Resend sender address                     | Yes               |
| `FEEDBACK_EMAIL_TO`         | Recipient address for product feedback             | Yes               |
| `RESEND_API_KEY`            | Resend transactional-email API key                 | Yes               |
| `CREDENTIAL_ENCRYPTION_KEY` | 32 random bytes encoded as base64                  | Yes               |
| `ADMIN_EMAIL`               | Sole administrator's verified email                | No                |

The application uses the pooled URL. Knex migrations use the direct URL through the Phase command
shown below. Neon recommends direct connections for schema migration tools and pooled connections
for serverless applications.

## One-time setup

### 1. Prepare the repository

The Git remote should be:

```text
git@github.com:GGOtto/mothmark.git
```

The repository default/integration branch is `main`; Vercel's production branch is `prod`. Before
the first deployment, run:

```bash
pnpm lint
pnpm ts-check
pnpm test --runInBand
pnpm build
git status
```

Review and commit only the intended files, then push them:

```bash
git add <files>
git commit -m "Prepare Mothmark for deployment"
git push origin <branch>
```

### 2. Create Neon production and preview databases

1. Sign in to the [Neon Console](https://console.neon.tech).
2. Create a project named `mothmark`.
3. Choose a region close to the expected users. Configure Vercel compute in the same general
   region to minimize database latency.
4. Keep the Neon `production` branch.
5. Create a child branch named `preview` from `production`.
6. For each branch, open **Connect** and copy:
   - the pooled connection string, whose hostname contains `-pooler`;
   - the direct connection string, whose hostname does not contain `-pooler`.

Each Neon branch has isolated data and its own connection strings. See Neon's [branching workflow
primer](https://neon.com/docs/get-started-with-neon/workflow-primer) and [connection pooling
guide](https://neon.com/docs/connect/connection-pooling).

Do not put either hosted connection string in `.env`, `.env.example`, documentation, tickets, or
Git history.

### 3. Configure Phase

1. Create or open a Phase app named `mothmark`.
2. Enable server-side encryption in the app settings. Phase requires it for secret syncing.
3. Keep the default `Development`, `Staging`, and `Production` environments.
4. Add the variables from [Environment map](#environment-map) to `Staging`, using the Neon
   `preview` URLs.
5. Add the same variables to `Production`, using the Neon `production` URLs.
6. For local registration and feedback testing, add `PUBLIC_APP_ORIGIN=http://localhost:3000`,
   `AUTH_EMAIL_FROM`, `FEEDBACK_EMAIL_TO`, and `RESEND_API_KEY` to Phase `Development`. Keep them in
   Phase; do not copy them into `.env` files.
7. Authenticate and initialize the repository locally:

```bash
phase auth
phase init
```

Select the `mothmark` app and `Development`. Phase creates `.phase.json`. It contains app and
environment identifiers rather than database credentials and may be committed.

Phase's [`run` command](https://docs.phase.dev/cli/commands#run) injects secrets only into the child
process. Phase can also [sync secrets to Vercel](https://docs.phase.dev/integrations/platforms/vercel).

### 4. Apply the initial migrations

Run migrations against `preview` first:

```bash
phase run --env staging 'DATABASE_URL="$DATABASE_MIGRATION_URL" pnpm migrate'
```

Then apply them to `production`:

```bash
phase run --env production 'DATABASE_URL="$DATABASE_MIGRATION_URL" pnpm migrate'
```

Expected output either lists an applied migration batch or says the database is already current.

### 5. Create the Vercel project

1. Sign in to [Vercel](https://vercel.com).
2. Select **Add New → Project**.
3. Import `GGOtto/mothmark`.
4. Use:
   - Framework preset: **Next.js**
   - Root directory: `./`
   - Production branch: `prod`
   - Install command: Vercel default
   - Build command: Vercel default
5. Deploy the project.

Vercel creates previews for non-`prod` branches and production deployments for `prod`. The first
deployment may not have working database access until Phase is synced; that is safe because the
database migrations were already applied.

The committed `vercel.json` disables Vercel's automatic deployment for the long-lived `staging`
and `prod` branches. GitHub Actions deploys each branch only after its database gate passes. Leave
automatic Git deployments enabled for ordinary feature-preview branches that do not add shared
migrations.

### 6. Protect the deployment

Use Vercel Authentication while the product is in private development, even though editor worlds
are now protected by opaque sessions, owner scopes, same-origin checks, and CSRF validation.

1. Open the Vercel project.
2. Go to **Settings → Deployment Protection**.
3. Enable **Vercel Authentication**.
4. Select **All Deployments**.
5. Save.

Vercel Authentication is available on all plans. It requires visitors to have explicit access to
the Vercel project or a permitted share link. See the [Vercel Authentication
guide](https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication).

### 7. Sync Phase to Vercel

Create the Vercel project before this step so Phase can select it as a destination.

1. In Vercel account or team settings, create an API token scoped to the team containing
   `mothmark`.
2. In Phase, open **Integrations → Third-party credentials** and add that token.
3. In the Phase `mothmark` app, open **Syncing**.
4. Create a sync from Phase `Staging` to Vercel `Preview`.
5. Create a sync from Phase `Production` to Vercel `Production`.
6. Sync only:
   - `DATABASE_URL`
   - `DATABASE_SSL`
   - `DATABASE_POOL_MIN`
   - `DATABASE_POOL_MAX`
   - `PUBLIC_APP_ORIGIN`
   - `AUTH_EMAIL_FROM`
   - `FEEDBACK_EMAIL_TO`
   - `RESEND_API_KEY`
   - `CREDENTIAL_ENCRYPTION_KEY`
7. Confirm that `DATABASE_MIGRATION_URL` is excluded from both Vercel syncs.

Avoid creating duplicate variables scoped to Vercel **All Environments**. Environment-specific
variables synced by Phase take precedence and duplicate definitions make troubleshooting harder.

### 8. Configure the staging deployment workflow

The repository includes `.github/workflows/deploy-staging.yml`. Configure the GitHub `Preview`
environment before relying on the canonical staging deployment:

1. Install Neon's GitHub integration so the repository has the `NEON_API_KEY` secret and
   `NEON_PROJECT_ID` variable. The workflow resolves a fresh, direct connection URI for the exact
   `preview` branch and masks it before exporting it to later steps; no migration URL is copied into
   GitHub.
2. Add a narrowly scoped `VERCEL_TOKEN` secret to that GitHub environment.
3. Add `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` as GitHub environment variables.
4. In Vercel, assign the canonical staging domain to the `staging` Git branch and keep its
   branch-specific Preview variables configured.
5. Push or merge a commit to `staging` and confirm **Deploy staging / Migrate, validate, and deploy
   staging** succeeds. Do not manually deploy that branch around a failed gate.

The workflow applies migrations before it builds or deploys the exact staging commit. Configure the
same Vercel secret and variables in GitHub's `Production` environment. The production workflow
resolves the direct `production` branch connection, runs the same gate, and only then builds and
deploys the exact `prod` commit.

### Configure authentication email and the administrator

Create separate Resend API keys and verified senders for Staging and Production. Set
`PUBLIC_APP_ORIGIN` to each environment's canonical HTTPS origin. Authentication messages contain
only a short-lived, single-use verification or recovery token. Never log those URLs.

Generate the credential-encryption key locally and place it directly into the matching Phase
environment:

```bash
openssl rand -base64 32
```

Do not reuse the key between environments. It encrypts TOTP seeds at rest and must be included in
protected database-recovery material. Losing it makes existing authenticators unreadable; exposing
it requires an MFA reset.

After applying the registered-account migration, set `ADMIN_EMAIL` in the Phase environment used
for the command and run:

```bash
phase run --env staging 'node --conditions=react-server --import tsx scripts/adminCreate.ts'
pnpm admin:create:prod
```

The command reads the password from a non-echoing terminal prompt, displays a TOTP enrollment URI,
requires a current authenticator code before committing, and then displays ten one-time recovery
codes. Store those codes offline and remove `ADMIN_EMAIL` after provisioning. The command creates
or upgrades exactly that verified address, refuses to replace another administrator, revokes old
sessions, and records no credential material.

Before enabling public registration in each deployed runtime, run `pnpm auth:benchmark` there and
record the three Argon2id timings in the release record. The versioned defaults use 64 MiB, four
passes, and one lane. Review them if the average falls outside the team's 50–250 ms operational
target; changing the stored versioned parameters upgrades hashes on the next successful sign-in
without requiring a password reset.

#### Administrator identity recovery

Recovery is intentionally unavailable through the application. Independently verify the operator
and database target, take a backup, obtain explicit approval, and run exactly one reviewed command:

```bash
phase run --env production 'pnpm admin:recover password'
phase run --env production 'pnpm admin:recover mfa'
phase run --env production 'pnpm admin:recover replace'
```

The command requires typing an operation-specific confirmation. Password input remains non-echoing.
Either operation revokes all administrator sessions and records a credential-free operational
event. MFA recovery replaces the authenticator and every recovery code, so store the newly printed
codes offline before ending the maintenance window. Replacement additionally requires `ADMIN_EMAIL`
to name a different existing verified account; it transfers the sole role, enrolls fresh MFA,
revokes both users' sessions, and demotes the former administrator to an ordinary registered user.

### 9. Redeploy with the synced environment

Vercel environment changes affect only new deployments.

1. Open **Deployments** in Vercel.
2. Select the latest production deployment.
3. Choose **Redeploy**.
4. For this first database-enabled deployment, do not reuse the previous build cache.
5. Wait for the deployment state to become **Ready**.

### 10. Verify production

Open the protected production URL and verify:

1. `/worlds` intentionally creates a temporary account and displays its private library.
2. Opening its first world changes the URL to `/worlds/[editorSlug]` and loads a world cloned from the
   template loads.
3. Make a small, recognizable edit.
4. Wait for the `Saving...` indicator to disappear.
5. Refresh the page.
6. Confirm the edit remains.
7. Open the same editor URL in a private browser window and confirm the other browser cannot resolve
   the world.
8. Confirm `/api/world/slug/main` returns 404 and `/api/world` returns 401 without the editor session.
9. Open **Vercel → Project → Logs** and check for database or route errors.
10. Register a preview account, consume its email verification link, sign out, and sign in again.
11. Confirm `/admin/sign-in` requires both the provisioned password and a current TOTP code.

Entering `/worlds` is intentional account creation. It atomically creates the anonymous user,
editor-audience session, and first owned world. Browsing `/`, `/starter`, `/sign-in`, `/register`, or
`/account` does not.

### 11. Verify preview isolation

Create a test branch:

```bash
git switch -c deployment-preview-test
git push -u origin deployment-preview-test
```

Open its Vercel preview URL and make a recognizable edit. Confirm the production world did not
change. If production changes, stop and correct the Phase `Staging` → Vercel `Preview` sync before
continuing.

Delete the test Git branch after verification using the team's normal Git workflow.

### 12. Enable the weekly preview refresh

The repository includes
[`.github/workflows/refresh-preview-database.yml`](../.github/workflows/refresh-preview-database.yml).
It resets Neon `preview` from its parent every Monday at 12:00 UTC and can also be run manually from
GitHub Actions.

Configure the workflow:

1. Install Neon's GitHub integration for `GGOtto/mothmark`, or create a narrowly scoped Neon API
   key.
2. In **GitHub → Repository → Settings → Secrets and variables → Actions**, add:
   - repository variable `NEON_PROJECT_ID` containing the Mothmark Neon project ID;
   - repository secret `NEON_API_KEY` containing the Neon API key.
3. Open **GitHub → Actions → Refresh preview database**.
4. Select **Run workflow** for the first manual refresh.
5. Confirm the action succeeds.
6. Open the preview editor and verify that a new anonymous account can clone the production
   template.

Neon's reset operation makes a child branch match the latest state of its parent and discards the
child's changes. The workflow uses Neon's official [Reset Branch
Action](https://github.com/neondatabase/reset-branch-action).

The reset does not require a Vercel redeployment or a Phase resync. After resetting, the same job
reapplies every migration from `staging` and runs exhaustive retained-content validation. The
existing preview connection continues to target the same Neon branch. Any editor tab open during
the reset may hold a stale world revision and should be refreshed.

## Public launch and operational gate

Production serves private editor accounts, public publication metadata, immutable playable
releases, and a separately authenticated administrator surface. Preview deployments remain behind
Vercel Authentication. Production protection may be disabled only after the checks below pass
against the production database and canonical public host.

- Verify registration, verification, sign-in, recovery, MFA, account deletion, private-world
  isolation, publication, two independent play sessions, progress deletion, and suspension.
- Confirm request-size enforcement, application authentication/hosted-play throttles, and a coarser
  Vercel WAF limit. Start the WAF above application limits and tune it from observed traffic so it
  absorbs floods without becoming an inexpensive account lockout mechanism.
- Confirm `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`,
  origin checks, CSRF enforcement, private `no-store` responses, and disabled browser source maps.
- Inspect logs for passwords, hashes, MFA material, email addresses, tokens, authored worlds,
  commands, transcripts, and provider payloads. None belong in structured logs.
- Verify the privacy page describes hosted command inspection and the only active cookies are the
  necessary editor, play, administrator, and audience-matched CSRF cookies.

The application bounds auth bodies at 8 KiB, publication-management bodies at 4 KiB, command API
bodies at 2 KiB, commands at 500 characters, and editor world bodies slightly above the 1 MiB world
limit. Hosted throttles are recorded as hashed principal/network dimensions. Vercel's
[WAF rate limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting) remains the
outer abuse-control layer.

### Backup and restore

Before migrations or destructive cleanup, create or confirm a Neon point-in-time restore point and
record the branch, migration batch, and operator in the release record. Restore into a new Neon
branch first, run migrations and integrity checks there, then change the Phase `DATABASE_URL` only
after approval. Never test recovery by overwriting the production branch.

### Cleanup and retention operations

Run `phase run --env production 'pnpm cleanup:anonymous --dry-run'` and review scheduled, cancelled,
deferred, failed, and unexpectedly large counts before scheduling. Run bounded purge batches only
after the grace window. Purge expired diagnostic rows separately with
`pnpm cleanup:anonymous --purge-playthroughs --batch=100`. Alert on any failed batch, a result over
the reviewed batch bound, or a sustained rise in scheduled/purged counts. Trashed worlds remain
recoverable for 30 days; playthrough identity is anonymized before its separate 90-day diagnostic
retention expires.

### Suspended publications

Suspension immediately blocks bootstrap, resume, restart, and command submission. Record a concise
moderation reason in the administrator action. After review, lifting suspension leaves the
publication unpublished; the owner explicitly republishes. Do not edit or delete immutable releases
to enforce a suspension.

### Email and credential operations

Monitor Resend delivery, bounce, complaint, and provider failures using message identifiers and
event types only; never log recipient addresses or verification/reset links. Rotate the Resend key
in the matching Phase environment, sync it to Vercel, deploy, verify a synthetic delivery, then
revoke the former key. Rotate `CREDENTIAL_ENCRYPTION_KEY` only with a reviewed re-encryption plan and
a verified backup; replacing it directly makes existing TOTP seeds unreadable. Administrator
password and MFA recovery continue to use the operator-only commands documented above.

## Deploying a routine change

### 1. Start from current `main`

```bash
git switch main
git pull --ff-only
git switch -c <feature-branch>
```

### 2. Validate locally

```bash
pnpm lint
pnpm ts-check
pnpm test --runInBand
pnpm build
```

Lint currently has a few known warnings. New errors or warnings introduced by the change should be
resolved before deployment.

### 3. Push and test preview

```bash
git push -u origin <feature-branch>
```

Use the Vercel preview link to test at minimum:

- editor load and refresh;
- room editing and movement;
- autosave and the unload warning;
- the game player;
- the specific feature being released;
- Vercel runtime logs.

An ordinary feature preview uses the schema already installed on the shared Neon `preview` branch.
If the change includes a migration, promote the reviewed commit to the long-lived `staging` branch
and test the canonical staging deployment instead. The staging workflow owns changes to the shared
preview schema.

### 4. Release

Merge the feature into `main`, then promote the reviewed integration candidate to `staging`. After
the controlled staging workflow succeeds and the canonical staging smoke test passes, promote that
same commit to `prod`. The controlled production workflow applies migrations and validates retained
content before it builds or assigns the production domains. Repeat the production smoke test and
check logs after promotion.

## Weekly preview database refresh

The scheduled workflow runs every Monday at 12:00 UTC. Treat all data and schema changes made only
in `preview` as disposable.

The refresh:

1. discards preview-only world edits;
2. discards preview-only migrations;
3. copies the latest production schema and data into preview;
4. does not modify production;
5. does not require new Phase or Vercel environment variables.

If a migration is actively being tested when the weekly reset runs, reapply it afterward:

```bash
phase run --env staging 'DATABASE_URL="$DATABASE_MIGRATION_URL" pnpm migrate'
```

To refresh preview immediately, open **GitHub → Actions → Refresh preview database → Run
workflow**. Check the workflow result before relying on preview for testing.

## Deploying a database migration

Follow the root-level `BREAKING_SCHEMA_MIGRATIONS_README.md` and
`DEPLOYMENT_STORAGE_GATE_README.md`. The commands below are retained for isolated staging and
initial setup; routine production migration is performed by the controlled production workflow.

Create a migration with a descriptive snake-case name:

```bash
pnpm db:make <migration_name>
```

The filename includes a timestamp so migrations do not overlap. Review both `up` and `down` before
running it.

Prefer backward-compatible, expand-and-contract changes:

1. **Expand:** add nullable columns, new tables, or compatible indexes.
2. Deploy code that can work with both the old and new shapes.
3. Backfill data if required.
4. Deploy code that uses the new shape exclusively.
5. **Contract:** remove old columns or constraints in a later release.

Apply and test staging by pushing the reviewed commit to the long-lived branch:

```bash
git push origin HEAD:staging
```

The staging workflow applies the migration, validates retained content, and only then builds and
deploys that exact commit. Once staging passes, promote the same candidate to `prod`. The required
production compatibility check applies the same migration and blocks Vercel promotion if any
retained content fails parsing or replay.

## Rollback and recovery

### Application rollback

If a deployment is broken but the migration was backward-compatible:

1. Open the last known-good deployment in Vercel.
2. Promote or roll back to it.
3. Check Vercel logs.
4. Leave the expanded database schema in place until a deliberate cleanup release.

Do not immediately run `knex migrate:rollback` in production. Application rollback and database
rollback are different operations, and a down migration can destroy data needed by the new release.

### Reset a private editor world

Use the editor's **Reset example** action and allow autosave to finish. Do not delete the `main`
template: it is the source for new anonymous worlds. Until the administrator world tools land,
database-level recovery should be handled through Neon restore history rather than ad hoc deletes.

## Troubleshooting

### Entering `/editor` returns 500

Check:

- Phase sync completed successfully.
- Vercel has an environment-specific `DATABASE_URL`.
- a new deployment was created after the environment sync.
- `DATABASE_SSL=true`.
- the runtime URL is the pooled Neon URL.
- migrations were applied to the same Neon branch.

### The API says the `revision` column does not exist

The Neon branch is missing migrations. For staging, rerun **Deploy staging** or **Refresh preview
database** and inspect the first failing migration/validation step. For production, rerun the
required production storage compatibility check after correcting its environment. Use the manual
commands in [Apply the initial migrations](#4-apply-the-initial-migrations) only for initial setup or
operator recovery.

### Preview edits production data

The Vercel Preview environment has the production `DATABASE_URL`. Disable the deployment if needed,
then fix the Phase `Staging` sync to use the Neon `preview` pooled URL.

### A save returns `WORLD_REVISION_CONFLICT`

Another tab saved a newer revision. Refresh the editor before making more changes. Do not bypass the
revision check.

### Neon rejects connections or migrations behave unexpectedly

Confirm the application uses the pooled `-pooler` URL and migrations are being run with the direct
URL. Keep `DATABASE_POOL_MIN=0` and begin with `DATABASE_POOL_MAX=1` for Vercel functions.

## Automated migration gates

Staging and production migration automation is now active. Both branches migrate and validate before
their GitHub Actions-controlled deployments. Both paths run `pnpm release:migrate`, use direct
database connections, serialize migrations, and retain the previously current deployment when their
gate fails.

Do not re-enable uncontrolled Vercel Git auto-deployments for `staging` or `prod`, prepend migrations
to the Vercel build command, or bypass either controlled workflow. Keep migrations backward-compatible
across the old and candidate application versions.
