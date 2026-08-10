# Vercel storage compatibility gate

Production database changes do not run in `next build` or application startup. When a production
deployment finishes building, Vercel sends the `vercel.deployment.ready` repository-dispatch event.
That event runs the storage compatibility job against the exact deployed commit and reports
`Vercel - mothmark: production storage compatibility` back to Vercel. Configure that uniquely named
status as a required Vercel Deployment Check so the production domains are assigned only after it
passes.

The workflow is `.github/workflows/production-storage-compatibility.yml`.

## Required service configuration

1. In Phase, keep `DATABASE_MIGRATION_URL` in the Production environment. It must be the direct
   Neon connection rather than the pooled application connection.
2. Use Phase's GitHub Actions integration to sync that value to the GitHub `production`
   environment. Phase remains the source of truth; do not hand-maintain a duplicate value.
3. Protect the GitHub `production` environment and limit access to the production deployment flow.
4. Keep the Vercel GitHub integration's repository-dispatch events enabled. The workflow ignores
   preview targets and runs only for `vercel.deployment.ready` production events.
5. In Vercel, enable automatic domain assignment with Deployment Checks and select
   `Vercel - mothmark: production storage compatibility` as required.
6. Keep the normal Vercel build command as `pnpm build`. Do not prepend migration commands.

The workflow checks out `client_payload.git.sha`, serializes production runs, and does not cancel an
in-progress migration when another deployment arrives. The runner also takes a PostgreSQL advisory
lock and rechecks the database version after acquiring it. Manual workflow dispatch remains
available for recovery and uses the selected branch's commit.

## Promotion behavior

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

## Preview testing

Do not run competing feature-branch migrations against one shared preview database. A breaking
migration should be tested on an isolated Neon branch cloned from production or the maintained
staging branch. Apply `pnpm release:migrate` there using the matching Phase environment.

Local or explicit staging execution uses:

```bash
phase run --env staging 'DATABASE_URL="$DATABASE_MIGRATION_URL" pnpm release:migrate'
```

Production is normally invoked only by the required GitHub/Vercel gate. An operator may rerun the
workflow manually after correcting an environmental failure; do not bypass a content validation
failure with Vercel's force-promotion control.
