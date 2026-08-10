# Vercel storage compatibility gates

Staging and production both run `pnpm release:migrate` from the exact candidate commit, but at
different points in their release flows:

- `.github/workflows/deploy-staging.yml` applies the candidate migrations and validates retained
  content before it builds and deploys the `staging` branch.
- `.github/workflows/production-storage-compatibility.yml` runs after the production candidate has
  built and blocks production-domain promotion until migration and validation succeed.

The repository's `vercel.json` disables Vercel's automatic Git deployment for the `staging` branch.
This is intentional: allowing Vercel and GitHub Actions to start independently would let staging
serve new application code before its required schema exists. Other preview branches retain their
normal automatic deployments, but they must not introduce migrations against the shared preview
database.

## Staging release

A push to the long-lived `staging` branch starts `Deploy staging`. The workflow checks out that exact
commit, serializes access to the shared staging database, applies SQL migrations, validates every
retained storage object, builds with the branch-specific Vercel Preview configuration, and deploys
the validated artifact. If migration, validation, or build fails, the previously deployed staging
version remains current.

The weekly preview reset uses the same concurrency group. After Neon resets `preview` from
`production`, the refresh workflow checks out the currently deployed `staging` branch and reapplies
its migrations and compatibility validation before reporting success. A reset can therefore no
longer silently remove columns still required by staging.

Configure the existing GitHub `Preview` environment with:

- `DATABASE_MIGRATION_URL` as a secret, synced from Phase Staging and using Neon's direct connection;
- `VERCEL_TOKEN` as a narrowly scoped secret permitted to deploy the Mothmark project;
- `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` as environment variables.

Keep the staging branch's application variables in Vercel Preview, including any branch-specific
overrides. Do not sync `DATABASE_MIGRATION_URL` to Vercel.

The workflow installs a pinned Vercel CLI and attaches GitHub branch metadata to its CLI deployment
so Vercel continues to update the `staging` branch URL/domain. Keep the `staging` branch in Vercel
connected to that canonical staging domain.

## Production release

Production database changes do not run in `next build` or application startup. When a production
deployment finishes building, Vercel sends the `vercel.deployment.ready` repository-dispatch event.
That event runs the storage compatibility job against the exact deployed commit and reports
`Vercel - mothmark: production storage compatibility` back to Vercel. Configure that uniquely named
status as a required Vercel Deployment Check so the production domains are assigned only after it
passes.

### Required service configuration

1. In Phase, keep `DATABASE_MIGRATION_URL` in the Production environment. It must be the direct
   Neon connection rather than the pooled application connection.
2. Use Phase's GitHub Actions integration to sync that value to the GitHub `Production`
   environment. Phase remains the source of truth; do not hand-maintain a duplicate value.
3. Protect the GitHub `Production` environment and limit access to the production deployment flow.
4. Keep the Vercel GitHub integration's repository-dispatch events enabled. The workflow ignores
   preview targets and runs only for `vercel.deployment.ready` production events.
5. In Vercel, enable automatic domain assignment with Deployment Checks and select
   `Vercel - mothmark: production storage compatibility` as required.
6. Keep the normal Vercel build command as `pnpm build`. Do not prepend migration commands.

The workflow checks out `client_payload.git.sha`, serializes production runs, and does not cancel an
in-progress migration when another deployment arrives. The runner also takes a PostgreSQL advisory
lock and rechecks the database version after acquiring it. Manual workflow dispatch remains
available for recovery and uses the selected branch's commit.

### Promotion behavior

For a compatible schema change, the gate performs read-only content validation and updates only the
accepted contract metadata. For a breaking schema change, it applies the registered transformation
and advances every retained record to the candidate storage version. A transform and its
`schema_version` update are coupled: only exact `fromVersion` rows are eligible, and even an
`unchanged`/opt-out transform advances its row. This makes every numbered migration one-time and
makes a same-version redeploy validation-only.

After a breaking migration commits and before Vercel finishes promotion, the old deployment may
still receive traffic. Database storage-version triggers reject obsolete-version writes during
that interval. This may produce a short controlled failure for an old request, but prevents stale
code from corrupting migrated content.

Redeploying the same commit is idempotent: SQL and storage migrations are already recorded, while
the complete parse and replay validation runs again. In particular, redeploying the v1-to-v2
launch reset cannot blank a version-2 world.

## Other preview testing

Do not run competing feature-branch migrations against the shared preview database. Database
changes reach shared hosted storage only by pushing the reviewed candidate to the maintained
`staging` branch. A migration that needs testing before that point must use an isolated Neon branch
cloned from production.

Local or isolated explicit execution uses:

```bash
phase run --env staging 'DATABASE_URL="$DATABASE_MIGRATION_URL" pnpm release:migrate'
```

Production is normally invoked only by the required GitHub/Vercel gate. An operator may rerun the
workflow manually after correcting an environmental failure; do not bypass a content validation
failure with Vercel's force-promotion control.
