# Mothmark deployment runbook

This runbook deploys Mothmark with:

- Vercel for the Next.js application and route handlers
- Neon for PostgreSQL
- Phase as the source of truth for environment variables
- GitHub as the deployment source

The production application currently has one shared world with the slug `main`. Everyone will
eventually be allowed to edit that world. Until the public editor API described in [Public launch
gate](#public-launch-gate) is implemented, keep every deployment behind Vercel Authentication.

## The short version for every release after setup

If the release has no database migration:

```bash
pnpm lint
pnpm ts-check
pnpm test --runInBand
pnpm build
git push origin <branch>
```

1. Open the Vercel preview created for the branch.
2. Test loading, editing, autosaving, and refreshing the `main` world.
3. Merge the branch into `main`.
4. Verify the production deployment and its logs.

If the release includes a database migration:

1. Apply the migration to Neon `preview`.
2. Deploy and test the Vercel preview.
3. Apply the same migration to Neon `production`.
4. Merge into `main` so Vercel deploys the compatible application code.

Never run migrations from `next build` or application startup.

## Environment map

| Purpose           | Git branch               | Vercel environment | Phase environment | Neon branch      |
| ----------------- | ------------------------ | ------------------ | ----------------- | ---------------- |
| Local development | Any                      | Development        | Development       | Local PostgreSQL |
| Hosted testing    | Any branch except `main` | Preview            | Staging           | `preview`        |
| Live application  | `main`                   | Production         | Production        | `production`     |

The long-lived Neon `preview` branch is reset from its `production` parent every Monday at 12:00
UTC. This replaces all preview-only schema and data with the current production state while keeping
the preview connection configuration stable.

Use these variables in Phase `Staging` and `Production`:

| Variable                 | Value                                              | Synced to Vercel? |
| ------------------------ | -------------------------------------------------- | ----------------- |
| `DATABASE_URL`           | Pooled Neon connection string containing `-pooler` | Yes               |
| `DATABASE_MIGRATION_URL` | Direct Neon connection string without `-pooler`    | No                |
| `DATABASE_SSL`           | `true`                                             | Yes               |
| `DATABASE_POOL_MIN`      | `0`                                                | Yes               |
| `DATABASE_POOL_MAX`      | `1`                                                | Yes               |

The application uses the pooled URL. Knex migrations use the direct URL through the Phase command
shown below. Neon recommends direct connections for schema migration tools and pooled connections
for serverless applications.

## One-time setup

### 1. Prepare the repository

The Git remote should be:

```text
git@github.com:GGOtto/mothmark.git
```

The production branch is `main`. Before the first deployment, run:

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
git push origin main
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
6. Authenticate and initialize the repository locally:

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
   - Production branch: `main`
   - Install command: Vercel default
   - Build command: Vercel default
5. Deploy the project.

Vercel creates previews for non-`main` branches and production deployments for `main`. The first
deployment may not have working database access until Phase is synced; that is safe because the
database migrations were already applied.

### 6. Protect the deployment

The current generic world routes include create, update, list, delete, and schema-version
operations. Do not expose them publicly yet.

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
7. Confirm that `DATABASE_MIGRATION_URL` is excluded from both Vercel syncs.

Avoid creating duplicate variables scoped to Vercel **All Environments**. Environment-specific
variables synced by Phase take precedence and duplicate definitions make troubleshooting harder.

### 8. Redeploy with the synced environment

Vercel environment changes affect only new deployments.

1. Open **Deployments** in Vercel.
2. Select the latest production deployment.
3. Choose **Redeploy**.
4. For this first database-enabled deployment, do not reuse the previous build cache.
5. Wait for the deployment state to become **Ready**.

### 9. Verify production

Open the protected production URL and verify:

1. `/editor` displays the loading grid before the world appears.
2. If the database is empty, the example world loads.
3. Make a small, recognizable edit.
4. Wait for the `Saving...` indicator to disappear.
5. Refresh the page.
6. Confirm the edit remains.
7. Open `/api/world/slug/main` and confirm it returns a record containing `id`, `world`, and
   `revision`.
8. Open **Vercel → Project → Logs** and check for database or route errors.

The example world is not inserted just by loading it. It becomes the stored `main` world after the
first edit causes autosave.

### 10. Verify preview isolation

Create a test branch:

```bash
git switch -c deployment-preview-test
git push -u origin deployment-preview-test
```

Open its Vercel preview URL and make a recognizable edit. Confirm the production world did not
change. If production changes, stop and correct the Phase `Staging` → Vercel `Preview` sync before
continuing.

Delete the test Git branch after verification using the team's normal Git workflow.

### 11. Enable the weekly preview refresh

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
6. Open the preview editor and verify that it now contains the current production `main` world.

Neon's reset operation makes a child branch match the latest state of its parent and discards the
child's changes. The workflow uses Neon's official [Reset Branch
Action](https://github.com/neondatabase/reset-branch-action).

The reset does not require a Vercel redeployment or a Phase resync. The existing preview connection
continues to target the same Neon branch. Any editor tab open during the reset may hold a stale world
revision and should be refreshed.

## Public launch gate

Vercel Authentication protects the entire app, so it is appropriate during private development.
The intended public product does not need user accounts: visitors may all edit one shared world.
Before disabling Vercel Authentication for Production, narrow and protect the API.

The public browser should receive only:

- `GET /api/editor/world`, which always returns `main`
- `PUT /api/editor/world`, which validates and updates only `main`

The public write route should require:

- a signed anonymous `HttpOnly`, `Secure`, `SameSite=Lax` session cookie;
- a matching same-origin `Origin` header;
- an application CSRF header;
- the existing Zod world validation and revision check;
- a request body-size limit;
- Vercel WAF rate limiting.

Keep these generic or destructive operations inaccessible to public sessions:

- listing all worlds;
- creating arbitrary worlds or slugs;
- fetching or updating arbitrary IDs;
- deleting worlds;
- changing schema versions;
- resetting `main` to the example.

A browser cannot safely contain a private API key. Anonymous sessions, origin and CSRF checks, a
narrow route surface, validation, and rate limiting reduce accidental and automated abuse; they do
not make a determined public editor user unable to replay their own allowed request.

Start with a Vercel WAF rule around 60 writes per minute per IP for the public editor endpoint, then
adjust from observed traffic. Vercel's [WAF rate limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting)
is available on all plans.

Only after this gate is implemented and tested should Production Vercel Authentication be disabled.
Keep Vercel previews authenticated.

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

### 4. Release

Merge the branch into `main`. Vercel deploys the merge automatically. After the deployment becomes
Ready, repeat the production smoke test and check logs.

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

Apply and test preview:

```bash
phase run --env staging 'DATABASE_URL="$DATABASE_MIGRATION_URL" pnpm migrate'
```

Once preview passes, apply production before merging the compatible application code:

```bash
phase run --env production 'DATABASE_URL="$DATABASE_MIGRATION_URL" pnpm migrate'
```

Then merge into `main`. Do not automatically run a destructive migration merely because an
application deployment started.

## Rollback and recovery

### Application rollback

If a deployment is broken but the migration was backward-compatible:

1. Open the last known-good deployment in Vercel.
2. Promote or roll back to it.
3. Check Vercel logs.
4. Leave the expanded database schema in place until a deliberate cleanup release.

Do not immediately run `knex migrate:rollback` in production. Application rollback and database
rollback are different operations, and a down migration can destroy data needed by the new release.

### Reset the shared world manually

Until an admin-only reset route exists, reset through the Neon SQL Editor. Verify the target branch
and inspect the row before deleting anything:

```sql
select id, name, slug, revision, updated_at
from worlds
where slug = 'main';
```

For the intended branch only, delete `main`:

```sql
delete from worlds
where slug = 'main';
```

This is destructive. Neon restore history is the recovery mechanism if the wrong data is removed.
After deletion, `/editor` loads the checked-in example world. The first subsequent edit saves a new
`main` record.

## Troubleshooting

### The app builds but `/api/world/slug/main` returns 500

Check:

- Phase sync completed successfully.
- Vercel has an environment-specific `DATABASE_URL`.
- a new deployment was created after the environment sync.
- `DATABASE_SSL=true`.
- the runtime URL is the pooled Neon URL.
- migrations were applied to the same Neon branch.

### The API says the `revision` column does not exist

The Neon branch is missing migrations. Apply them to the affected Phase environment using the
commands in [Apply the initial migrations](#4-apply-the-initial-migrations).

### Preview edits production data

The Vercel Preview environment has the production `DATABASE_URL`. Disable the deployment if needed,
then fix the Phase `Staging` sync to use the Neon `preview` pooled URL.

### A save returns `WORLD_REVISION_CONFLICT`

Another tab saved a newer revision. Refresh the editor before making more changes. Do not bypass the
revision check.

### Neon rejects connections or migrations behave unexpectedly

Confirm the application uses the pooled `-pooler` URL and migrations are being run with the direct
URL. Keep `DATABASE_POOL_MIN=0` and begin with `DATABASE_POOL_MAX=1` for Vercel functions.

## Later automation

The first releases intentionally keep production migrations explicit. When releases become
frequent, add a GitHub Actions workflow that:

1. runs lint, type-check, tests, and build;
2. migrates the Neon preview branch before preview integration tests;
3. requires approval for the production environment;
4. migrates Neon production with the direct connection;
5. triggers or promotes the Vercel production deployment only after migration succeeds.

Do not combine uncontrolled Vercel Git auto-deploys with destructive migrations. Keep migrations
backward-compatible or change production deployment to a gated workflow before automating this
sequence.
