# Breaking persisted schema migrations

Use a numbered storage migration only when the new schema cannot continue accepting the old
representation safely. A migration upgrades all retained drafts, publication snapshots,
playthrough states, turn states, transcripts, and output messages before the deployment is
promoted.

## Creating a migration

1. Increment `PERSISTED_SCHEMA_VERSION` by exactly one in
   `src/compat/migrations/index.ts`.
2. Add `src/compat/migrations/v<old>To<new>.ts`.
3. Register it in `storageMigrations` in version order.
4. Explicitly provide `world`, `gameState`, and `messages` handling. Use `unchanged` for a document
   family whose representation did not change. `unchanged` preserves its JSON but does not opt that
   document out of the version bump.
5. Run `pnpm storage:contract` and review the new root snapshot.
6. Add focused migration tests containing the real legacy representation.
7. Add or update a `*.player.test.ts` replay test for any runtime-visible behavior.
8. Run `pnpm release:migrate` against an isolated preview database copied from production before
   allowing the production gate to run.

Example:

```ts
import {defineStorageMigration, unchanged} from "./types";

export const v2ToV3 = defineStorageMigration({
  id: "v2-to-v3-rename-examine-text",
  fromVersion: 2,
  toVersion: 3,

  world(value, context) {
    // Treat value as unknown legacy JSON. Validate only the legacy fields being touched,
    // return a new value, and preserve unrelated authored data.
    return renameExamineText(value);
  },

  gameState: unchanged,
  messages: unchanged,
});
```

Migration inputs are `unknown`. Do not cast a legacy document to the current `World` or
`GameState` type: doing so hides exactly the incompatibility the migration must handle. Prefer a
small legacy Zod schema for the fields being transformed and `structuredClone` or Immer for the
update.

Transforms must be deterministic, must not query the database, and must not mutate their input.
The central runner supplies record context and owns database selection, locking, writes, version
updates, and final validation.

## Versioning and one-time application

A migration is eligible only for a row whose `schema_version` exactly equals its `fromVersion`.
Applying the transform and writing `toVersion` are one operation controlled by
`applyVersionedTransform`; do not call a transform directly from database migration code. Every
retained row advances, including game states and messages marked `unchanged`.

This is the idempotency boundary. Once `v2ToV3` commits, those rows are version 3 and that migration
cannot run against them again. The migration ID is also recorded in `storage_migration_log`. Never
reset a row's version, edit an applied transform, reorder the registry, or attach an old transform
to a new version. Fix mistakes with another adjacent forward migration.

An opt-out migration is still a real adjacent migration: all three transforms may be `unchanged`,
but it must have a unique ID and must advance stored rows by one version. Use it only after reviewing
the contract and proving all old documents parse and replay without modification.

The initial `v1ToV2` migration is the sole deliberate exception to the usual preserve-authored-data
rule: it is a reviewed launch reset that blanks version-1 worlds. Its focused tests prove that its
output is the canonical blank shape and that applying it to version 2 is a no-op. Its complete output
also has a pinned digest. Do not update that digest when shared blank-world or initial-command data
changes; preserve the historical v2 output and add the next adjacent migration.

## Migration order

For each version step, the runner migrates:

1. editor and template worlds;
2. immutable publication world snapshots;
3. playthrough current states and transcripts, with the migrated pinned world in context;
4. historical turn states and output messages;
5. all documents through the current schemas;
6. complete command histories through the current player path.

Published versions and turns remain immutable to ordinary application code. A migration marker
allows the controlled transaction to change only JSON payload and schema-version columns; IDs,
revisions, commands, sequence numbers, release relationships, engine versions, and timestamps stay
immutable.

## Failure and rollback

The content transformation and validation run in one PostgreSQL transaction. If any retained
record fails parsing, relationship validation, or replay, the transaction rolls back and the Vercel
deployment remains unpromoted.

Do not weaken the candidate schema, discard legacy fields, alter historical commands, or rewrite
player-visible history merely to pass validation. Correct the transform.

After a successful breaking migration, an application rollback is safe only to a build supporting
the new storage version. Database triggers reject obsolete-version writes, but an old application
may be unavailable. Prefer a forward fix. For a genuinely destructive or logically irreversible
migration, confirm a Neon restore point first and document the restore procedure in the migration's
review.

Never edit an applied migration or reuse its ID. Add another forward migration.
