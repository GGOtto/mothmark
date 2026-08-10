# Anonymous and registered accounts, multiple worlds, publishing, and hosted play

## Horizontal slice implementation plan

**Implementation status (2026-08-09):** Slices 1–10 are implemented. The launch runbook retains the
preview migration, production-like retention drill, and operator approval steps that must be
performed against the target deployment rather than simulated in repository tests.

This document is the implementation plan for moving Mothmark from one shared editable world to:

- browser-bound anonymous user accounts;
- optional registered accounts with verified email, password login, recovery, and cross-browser
  access;
- multiple private editor worlds per user;
- one strongly authenticated administrator account;
- administrator-controlled permissions, limits, users, and worlds;
- publishing for eligible registered world owners;
- a public catalog at `mothmark.app/play`;
- a command-line player at `mothmark.app/play/[world]`; and
- durable hosted playthroughs recorded as exact command strings.

Each slice must deliver a coherent path that a person can exercise through the interface. Database
tables, API routes, authorization, UI, and tests land together when they are needed by that path.
Do not land disconnected infrastructure, placeholder navigation, or empty product areas merely to
prepare for a later slice.

## Product decisions

These decisions are authoritative for this plan.

1. Ordinary users begin anonymously. Their account is a durable database row accessed through an
   opaque browser session, and they may register later without losing that row or its worlds.
2. A user may own multiple private editor worlds, subject to an administrator-controlled limit.
3. Merely visiting a public page does not create an anonymous account. Entering the editor, creating
   a world, or starting hosted play does.
4. Public registration uses verified email and a password. Administrator authority is never
   available through public registration: the initial administrator is provisioned by an explicit
   operator command, and administrator sessions require password authentication plus MFA.
5. A world is publishable only when its owner is registered, active, and permitted to publish it.
   Eligible ordinary registered owners publish their own worlds directly; administrator status is
   not a publishing prerequisite.
6. Administrator access to an anonymous user's private world does not make that world publishable.
   Transferring or duplicating it to the administrator is an explicit, audited ownership action.
7. A mutable editor world is never served directly to players. A publication points to an immutable
   release, and a release points to an immutable world version.
8. `mothmark.app/play` lists published, listed worlds. Selecting a world opens its command-line
   player directly at `mothmark.app/play/[world]`.
9. Each anonymous play user has at most one active playthrough per publication. Returning to the
   same world loads that playthrough.
10. A playthrough stores exact newline-delimited player commands, the visible transcript, the
    current game state, and an immutable result record for each accepted turn. It remains pinned to
    the release on which it began.
11. Only hosted play under `mothmark.app/play` creates these playthrough records. The embedded editor
    player is out of scope and must not write to them.
12. Editor session recording is out of scope. Do not add PostHog, Clarity, OpenReplay, or an editor
    recording table in these slices.
13. No consent popup is planned while Mothmark uses only the session cookie needed to provide the
    requested account and play service. The product still needs a plain privacy/cookie notice and a
    launch-time review for the jurisdictions it serves. Any future optional analytics or session
    recording requires its own consent decision before it is enabled.

## Terminology

Use these terms consistently in code, schema, APIs, tests, and interface copy.

- **User:** A stable person-like database principal that may remain anonymous or become registered.
- **Session:** An opaque, revocable credential for one application audience.
- **Editor world:** A mutable private world document owned by one user.
- **Template:** A read-only source that can be cloned into an editor world. The existing `main`
  world becomes the initial template.
- **World version:** An immutable snapshot of an editor world at one numbered revision.
- **Publication:** The stable public identity, slug, visibility, and lifecycle for one published
  world.
- **Release:** One immutable published edition that points to one world version.
- **Playthrough:** One player's durable hosted game state and command history for a release.
- **Registered:** A user with a verified email address and an active Mothmark credential. Registering
  an anonymous account preserves its user ID, worlds, activity, limits, and drafts.

Do not call editor worlds “games” in one surface and “projects” in another. “World” is the product
term. “Player” refers to a user while interacting under `mothmark.app/play`; it is not a separate user
table.

## Application surfaces

The initial route map is:

```text
mothmark.app
├── /
├── /register
├── /sign-in
├── /verify-email
├── /forgot-password
├── /reset-password
├── /worlds
├── /worlds/[editorSlug]
├── /play
│   └── /[world]
├── /account
└── /admin
    ├── /users
    ├── /users/[userId]
    ├── /worlds
    ├── /worlds/[worldId]
    ├── /publications
    ├── /publications/[publicationId]
    ├── /playthroughs
    ├── /playthroughs/[playthroughId]
    └── /audit
```

`mothmark.app/play/[world]` uses the publication slug. It must never expose an editor-world UUID as
the public identifier.

Private editor URLs use a separate stable, owner-scoped `editor_slug` derived from the world name.
It is readable but not public or authoritative: the owner session still gates every lookup, world
UUIDs remain internal mutation identifiers, and old UUID URLs canonicalize to the editor slug. A
rename does not change an existing editor slug. Publication slugs remain a distinct later concept.

The play and authoring surfaces share one Next.js application and database. Route-aware authorization
must keep their public surfaces distinct. Public play routes must not expose editor or administrator
data or operations.

## Security and authorization invariants

These invariants apply from the first identity slice onward.

### Sessions

- Session cookies contain cryptographically random opaque secrets.
- PostgreSQL stores only a hash of the secret.
- Cookies are `HttpOnly`, `SameSite=Lax`, `Path=/`, and `Secure` in hosted environments.
- Do not use a broad `.mothmark.app` domain cookie.
- Sessions have an audience: `editor`, `play`, or `admin`.
- A play session cannot authorize editor APIs. An editor session cannot authorize administrator APIs.
- Administrator sessions require a registered, active administrator identity.
- Mutations require the expected origin and application CSRF protection in addition to the session.
- Session lookup rejects expired, revoked, suspended, deleted, and wrong-audience principals.
- Throttle `last_seen_at` writes rather than updating the database on every request.

Anonymous editor and play identities may initially be different users, even in the same browser.
Registration does not weaken cookie boundaries: each host and audience issues its own opaque
session after credential authentication. Account linking across an editor identity and a separately
created play identity requires an explicit, authenticated merge design and is not inferred from
matching browser state.

### Registered credentials

- Normalize email addresses for lookup and uniqueness while preserving the entered address for
  display and delivery.
- Public registration never assigns `site_role = admin` or an administrator permission.
- Store passwords only as versioned, salted Argon2id hashes. Never store, log, email, or place a
  password in Phase, a migration, command arguments, audit metadata, or reversible encryption.
- Require at least 15 characters for a password used as a single factor, allow password-manager
  paste and long passphrases, reject known-compromised values, and do not require arbitrary
  composition rules.
- Email verification and password-reset credentials are cryptographically random, hashed at rest,
  single-use, narrowly scoped, and short-lived.
- Login, registration, verification, and recovery responses do not disclose whether an email exists.
- Apply escalating per-account and per-network throttles to password, registration, verification,
  recovery, and MFA attempts without creating an easy permanent account-lockout attack.
- Changing a password or completing account recovery revokes every existing session. An ordinary
  password change requires the current password and may offer explicit all-session revocation.
- Administrator sessions require a separately enrolled MFA authenticator. Recovery codes are
  displayed once and stored only as hashes; losing every administrator factor requires the reviewed
  operational recovery procedure.
- Authentication and email-delivery secrets live in the matching Phase environment, including local
  Development.

### Anonymous account cleanup

- Cleanup applies only to `account_type = anonymous`, `site_role = user` accounts.
- Registered users, administrators, and administratively suspended users are never automatically
  purged.
- Cleanup is two-phase: first schedule deletion, then purge after a grace period.
- Returning with a valid session before purge clears the schedule before serving a protected action.
- Purge rechecks eligibility under a database lock so a request and cleanup job cannot race.
- A nonexpired session or activity newer than the cleanup cutoff prevents purge.
- Dependent sessions, private worlds, server-side activity rows, permission overrides, and
  playthroughs follow an explicit deletion or anonymization policy; do not leave dangling ownership.
  Browser-local drafts become inaccessible when their user/world keys are purged and are removed
  when that browser next runs local maintenance.
- Record aggregate scheduled/completed cleanup batches as system audit or operational events, and
  record administrator cancellations individually, without storing cookie or content data. Do not
  replace every deleted orphan account with a permanent per-account audit row.

Use retention classes rather than one blunt cutoff:

- **Empty:** no owned worlds and no playthroughs; shortest retention.
- **Untouched editor:** owns only an initial world that has never advanced beyond its created
  revision and has no hosted play; short retention.
- **Play-only:** no owned editor worlds but has hosted playthroughs; retention follows the published
  play privacy policy.
- **Authored editor:** owns an editor world with saved changes; longest anonymous retention.

Provisional inactivity values before scheduling are 24 hours for empty accounts, 7 days for
untouched editor accounts, 30 days for play-only accounts, and 180 days for authored editor accounts.
The deletion grace period begins after scheduling and is chosen separately. Confirm these values
before the slice that activates each class. The cleanup query must derive the class from
authoritative database state each time; do not permanently label an account with a stale class.

### Private worlds

- A user can list only active editor worlds they own.
- A user can read, update, duplicate, export, trash, or restore only worlds they own and only when
  their effective permissions allow the action.
- Templates are readable only through a narrow cloning/template path and are never mutable through
  ordinary world APIs.
- Another user's missing, deleted, or inaccessible world returns the same unresolved result.
- Slugs do not authorize access to private worlds.
- Repository and service functions used by public handlers must accept an actor or an already
  authorized scope. Avoid unrestricted public-route calls to `getWorld(id)`.

### Publishing

- Publishing requires an active registered owner and the `world.publish_owned` capability.
- Site-role administration alone does not make an anonymous-owned world publishable.
- Releases and world versions are immutable.
- Editor saves never change a live release.
- Only published publications resolve under the public `/play` routes.
- Listed publications appear in the catalog. Unlisted publications resolve only by exact slug.
- Suspension immediately prevents catalog visibility, new playthroughs, and continued play.
- Publication and release mutations are audited.

### Playthroughs

- A play user may read or mutate only their own playthrough.
- An administrator needs the explicit `admin.playthroughs.view` capability to inspect one.
- A playthrough is pinned to a publication, release, world, and world version.
- At most one active playthrough exists for a player and publication.
- Command submission uses optimistic concurrency so two tabs cannot silently overwrite state.
- The original player input is retained with only line-ending normalization.
- Player input is untrusted text. Escape it in every administrative and player rendering path.

## Target data model

Names below describe the intended relational contract. Migration implementation may use PostgreSQL
checks rather than database enum types so values remain easier to extend during active development.

### `users`

```text
id                    uuid primary key
account_type          anonymous | registered
site_role             user | admin
status                active | suspended | deleted
display_name          nullable text
created_at            timestamp
updated_at            timestamp
last_seen_at          timestamp
registered_at         nullable timestamp
deleted_at            nullable timestamp
cleanup_scheduled_at  nullable timestamp
cleanup_after         nullable timestamp
cleanup_reason        nullable text
```

Keep the user ID stable when an anonymous user eventually registers. Cleanup scheduling fields apply
only to ordinary anonymous users and are cleared immediately if an eligible user returns before
purge.

### `user_emails`

```text
user_id               uuid primary key references users
email                 text
normalized_email      text unique
email_verified_at     nullable timestamp
created_at            timestamp
updated_at            timestamp

unique (normalized_email)
```

The first registered-account release supports one email per user. A verified address is required
for registered access and publishing. Multiple addresses and address changes require their own
verified workflow later.

### `password_credentials`

```text
user_id               uuid primary key references users
password_hash         text
hash_version          integer
password_changed_at   timestamp
failed_attempts       integer
locked_until          nullable timestamp
created_at            timestamp
updated_at            timestamp
```

`password_hash` contains the full versioned Argon2id encoding, including its salt and work factors.
Successful authentication may transparently rehash an older work factor.

### `account_tokens`

```text
id                    uuid primary key
user_id               nullable uuid references users
registration_id       nullable uuid references account_registrations
purpose               verify_email | reset_password
token_hash            text unique
expires_at            timestamp
consumed_at           nullable timestamp
created_at            timestamp

index (user_id, purpose, created_at)
index (registration_id, purpose, created_at)
check exactly one of user_id or registration_id is present
```

Tokens are never stored in plaintext. Issuing a newer live token for the same purpose invalidates
the previous one.

### `account_registrations`

```text
id                    uuid primary key
existing_user_id      nullable uuid references users
normalized_email      text unique
email                 text
password_hash         text
expires_at            timestamp
created_at            timestamp
```

This table holds a bounded pending registration without prematurely granting registered access. On
verification, one transaction either creates a registered user or upgrades `existing_user_id`,
creates its email and password credential, clears anonymous cleanup state, and consumes the pending
registration. It must recheck email uniqueness and the anonymous session under lock.

### `mfa_authenticators`

```text
id                    uuid primary key
user_id               uuid references users
kind                  totp
secret_ciphertext     text
created_at            timestamp
verified_at           nullable timestamp
last_used_step        nullable bigint

unique (user_id, kind)
```

TOTP secrets are encrypted with a key held in Phase, never merely encoded. Reject reuse of a time
step. Store administrator recovery codes in a companion table as individually salted hashes and
consume them atomically.

### `mfa_recovery_codes`

```text
id                    uuid primary key
user_id               uuid references users
code_hash             text unique
created_at            timestamp
consumed_at           nullable timestamp
```

Generate a complete replacement set rather than appending codes. Display plaintext codes once,
never log them, and revoke the remaining set after administrator factor recovery.

### `sessions`

```text
id                    uuid primary key
user_id               uuid references users
audience              editor | play | admin
token_hash            text unique
created_at            timestamp
last_seen_at          timestamp
expires_at            timestamp
revoked_at            nullable timestamp
```

### Changes to `worlds`

Retain the current world document, schema version, revision, and timestamps. Add:

```text
owner_user_id         nullable uuid references users
kind                  template | editor
updated_by_user_id    nullable uuid references users
deleted_at            nullable timestamp
```

The current `worlds.slug` is not the public play URL. New public slugs belong to
`world_publications`. Stop using `worlds.slug` for editor authorization or public discovery.

### `user_limits`

```text
user_id               uuid primary key references users
max_worlds            positive integer
updated_by_user_id    nullable uuid references users
updated_at            timestamp
```

The default limit is a configuration decision made before Slice 2. There is no unlimited sentinel
in the first version; the administrator receives a suitably high explicit limit.

### `user_permission_overrides`

```text
user_id               uuid references users
permission            text
effect                allow | deny
reason                nullable text
expires_at            nullable timestamp
created_by_user_id    uuid references users
created_at            timestamp
updated_at            timestamp

primary key (user_id, permission)
```

Permission names are a code-defined union. The database does not invent runtime capabilities.
Effective access resolves from account defaults, site-role defaults, and a per-user override, with an
explicit deny taking precedence.

Initial ordinary-user capabilities:

```text
editor.access
world.create
world.update_owned
world.delete_owned
world.export_owned
hosted_play.access
hosted_play.save_progress
```

Registered-owner capability:

```text
world.publish_owned
```

Initial administrator capabilities:

```text
admin.users.view
admin.users.manage
admin.users.manage_permissions
admin.worlds.view
admin.worlds.manage
admin.worlds.transfer
admin.publications.manage
admin.playthroughs.view
admin.audit.view
```

### `user_world_activity`

```text
user_id               uuid references users
world_id              uuid references worlds
last_opened_at        timestamp

primary key (user_id, world_id)
```

Opening a world updates this record without falsely changing `worlds.updated_at`.

### `admin_audit_log`

```text
id                    uuid primary key
actor_kind            user | system
actor_user_id         nullable uuid references users
action                text
target_type           text
target_id             text
reason                nullable text
metadata              jsonb
created_at            timestamp
```

Never store session secrets, credentials, or full world documents in audit metadata.
`actor_user_id` is required for `actor_kind = user` and absent for a scheduled system cleanup.

### `world_versions`

```text
id                    uuid primary key
world_id              uuid references worlds
revision              positive integer
world                 jsonb
schema_version        positive integer
engine_version        text
created_by_user_id    uuid references users
created_at            timestamp

unique (world_id, revision)
```

### `world_publications`

```text
id                    uuid primary key
world_id              uuid unique references worlds
slug                  text unique
status                published | unpublished | suspended
visibility            listed | unlisted
current_release_id    nullable uuid references world_releases
created_by_user_id    uuid references users
published_at          timestamp
unpublished_at        nullable timestamp
created_at            timestamp
updated_at            timestamp
```

Publication slugs reject a maintained list of reserved top-level paths such as `api`, `admin`,
`about`, `privacy`, `terms`, `worlds`, `account`, `login`, `logout`, and `health`. Lock a slug after
its first publication in the initial version; slug redirects are deferred. Because publications and
releases refer to each other, add the `current_release_id` foreign key after both tables exist.

### `world_releases`

```text
id                    uuid primary key
publication_id        uuid references world_publications
world_version_id      uuid references world_versions
release_number        positive integer
title                 text
summary               text
published_by_user_id  uuid references users
published_at          timestamp

unique (publication_id, release_number)
unique (publication_id, world_version_id)
```

The release stores the listing title and summary that were public for that edition.

### `playthroughs`

```text
id                    uuid primary key
player_user_id        nullable uuid references users
publication_id        uuid references world_publications
release_id            uuid references world_releases
world_id              uuid references worlds
world_version_id      uuid references world_versions
commands              text
transcript            text
current_state         jsonb
command_count         non-negative integer
revision              positive integer
status                active | completed | abandoned | errored
started_at            timestamp
last_command_at       timestamp
ended_at              nullable timestamp
anonymized_at         nullable timestamp
purge_after           nullable timestamp
created_at            timestamp
updated_at            timestamp
```

Add a partial unique index for `(player_user_id, publication_id)` where `status = 'active'`.

The authoritative diagnostic command record is newline-delimited `commands`. `transcript` restores
what the player saw without rerunning historical commands through a newer engine. `current_state` is
the state used for the next turn. The hosted command API accepts exactly one command line at a time
and rejects embedded carriage returns or newlines so command boundaries remain unambiguous. When a
play-only anonymous account is purged before its diagnostic retention expires, clear
`player_user_id`, set `anonymized_at`, and retain the playthrough only until `purge_after`.

### `playthrough_turns`

```text
id                    uuid primary key
playthrough_id        uuid references playthroughs
sequence              positive integer
command               text
output_messages       jsonb
resulting_state       jsonb
engine_version        text
accepted_at           timestamp

unique (playthrough_id, sequence)
```

Each accepted command creates one immutable turn row in the same transaction that updates the
playthrough aggregate. `output_messages` stores exactly what that command added to the visible
transcript, and `resulting_state` stores the state after the turn. These rows make it possible to
identify the first output or state difference during diagnostic replay. The aggregate `commands`,
`transcript`, and `current_state` fields remain the efficient resume and export representation and
must always agree with the ordered turn rows.

## UI language and layout

All new application UI follows `docs/design-system.md` and the semantic tokens in
`src/app/globals.css`.

- Use sentence case.
- Present worlds as restrained, content-led cards in both the private world library and the public
  catalog. Cards show useful world identity and actions without becoming promotional dashboard
  tiles.
- Use color for small identity and status cues, not full-row fills or repeated colored rails.
- Preserve the existing activity-rail geometry in the editor.
- Keep the hosted player monospace, theme-aware, and uninterrupted. It is a terminal, not a chat or
  form.
- Use 4px control, 6px panel/popover, and 8px dialog radii.
- Put destructive world reset and deletion controls in World settings or explicit dialogs, not in the
  global header.
- Do not add empty Publishing or Playthrough navigation for users who cannot use it.

### Shared player components

Reuse the command-line player by extracting its terminal surface, not by mounting the complete
editor `CommandLine` under the public `/play` routes. Keep these responsibilities separate:

```text
PlayerTerminal
├── transcript output
├── integrated command prompt
└── scrolling, focus, keyboard history, and accessibility

EditorGamePreview
├── PlayerTerminal
├── local resolveTurn state
└── editor-only start, move, restart, and state-inspection controls

HostedPlayer
├── PlayerTerminal
├── server-backed playthrough state
└── resume, optimistic revision, save, and publication-availability handling
```

`PlayerTerminal` is a controlled presentation component. It does not own engine execution,
publication state, selected-room synchronization, or persistence. The hosted player submits one
command at a time and appends the command and returned output only after the server accepts the turn
atomically. On failure, keep the unaccepted command in the prompt so the player can retry it. Do not
replace terminal output with cards, chat bubbles, command chips, or a multiline message composer.

Do not force-scroll a reader who has intentionally moved upward in a long transcript. Keep the
prompt attached to the bottom of the usable viewport on mobile, respect safe areas and software
keyboards, and render every command and output message as inert text.

## [x] Slice 1: Private anonymous editing

**Outcome:** A person can enter the editor, receive a private anonymous account and private world,
edit it, refresh, and return to it without another browser being able to see or change it.

### Data and services

- Add `users` and `sessions` with editor-audience sessions.
- Add `owner_user_id`, `kind`, `updated_by_user_id`, and `deleted_at` to `worlds`.
- Migrate the existing `main` world to `kind = template` with no owner.
- Add a transaction that creates an anonymous user, editor session, and first editor world cloned
  from the template when a person intentionally enters the editor.
- Store only the session-token hash.
- Add server-only current-actor and authorization helpers.
- Scope world repository operations by owner.
- Replace the shared `slug/main` editor load and save path with an authorized owner-scoped world
  path.
- Close or internalize generic destructive world and schema-version routes before public access.
- Require same-origin and CSRF validation on mutations.

### UI

- Replace the placeholder home action with `Start building`.
- `Start building` opens `/worlds`, which bootstraps only when the visitor intentionally enters it.
- `/worlds/[editorSlug]` opens an authorized editor world; legacy UUID and `/editor` URLs redirect into the
  `/worlds` route family.
- The editor displays its current world name.
- Add a restrained temporary-account explanation reachable from the header or account menu.
- Keep local fallback behavior only when it cannot expose or overwrite a different user's world.

### Focused verification

- Test session creation, hashing, expiry, revocation, audience, and invalid-cookie handling.
- Test that page-only browsing does not create a user.
- Test that concurrent first-world creation for the same resolved user creates one first world.
- Test template cloning without mutating the template.
- Test owner-scoped list, read, update, and delete repository behavior.
- Test every protected route without a session, with the wrong audience, and with a suspended user.

### Player-path and browser verification

- Browser A starts building, edits, saves, refreshes, and returns to the same world.
- Browser B receives a different user and different world.
- Browser B cannot resolve Browser A's world URL or API ID.
- A stale revision still produces the existing player-facing save-conflict result.
- Logging and error responses do not contain cookies or session secrets.
- Run focused route/component tests, `pnpm ts-check`, and the relevant existing autosave tests.

### Exit criteria

- No public request can list or mutate the former shared `main` world.
- All editor persistence is associated with an active anonymous user and owned world.
- The first-use and returning-use paths work through the visible interface.

## [x] Slice 2: Multiple-world library and switching

**Outcome:** An anonymous user can create, see, open, and switch among multiple private worlds without
drafts or editor state leaking between them.

### Data and services

- Add `user_limits` and assign a default `max_worlds` to new anonymous users.
- Add `user_world_activity` and record `last_opened_at` independently of edit timestamps.
- Add authorized create and list operations for owned active editor worlds.
- Enforce the world limit transactionally under concurrent create requests.
- Validate world names and create stable owner-scoped editor slugs, but do not expose publication
  slugs or publishing metadata.
- Key local drafts by both user ID and world ID.
- Maintain independent server revision and recovery metadata for each local draft.

### UI

- Add `/worlds` as the returning user's primary page.
- Present worlds as a responsive card grid. Each restrained card shows the world name, last edited
  time, room/item counts, and a clear open action; do not render worlds as table or list rows.
- Add `New world` with starter-template, blank-world, and validated JSON-import choices.
- Show finite usage as `N of M worlds` and explain a reached limit without upgrade marketing.
- Keep the main editor route at `/worlds/[editorSlug]` beneath the world library.
- Add a compact editor world switcher with recent worlds, `View all worlds`, and `New world`.
- Hide global autosave controls when no editor target is registered.
- Finish or visibly reconcile a pending save before navigating to another world.

### Focused verification

- Test limit enforcement at zero remaining, one remaining, and concurrent creation.
- Test that deleted/template/other-owner worlds do not count as active owned worlds.
- Test ordering by last opened and last edited without conflating the timestamps.
- Test local-draft keys, restoration, deletion, and revision matching for several worlds and users.
- Test world-switcher keyboard interaction and accessible naming.

### Browser verification

- Create three worlds, edit each, switch repeatedly, refresh each URL, and confirm contents remain
  isolated.
- Open the same world in two tabs and verify revision conflict behavior.
- Reach the configured limit and confirm both UI and API reject another world.
- Enter another user's editor URL and receive the same unresolved result as a missing editor slug.
- Verify the world library at ordinary desktop and narrow mobile widths; the editor may retain its
  documented desktop limitation.

### Exit criteria

- `/worlds` is a useful destination rather than a placeholder.
- Multiple private worlds work through database persistence, autosave, local recovery, and navigation.
- Quotas and ownership remain enforceable when the UI is bypassed.

## [x] Slice 3: World lifecycle and temporary-account controls

Slice 3 uses the provisional inactivity periods above: 24 hours for empty accounts, 7 days for
untouched editor accounts, and 180 days for authored editor accounts. Scheduling starts a separate
7-day grace period. Trashed worlds remain recoverable for 30 days; automatic trash purging is not
enabled in this slice, while an owner-confirmed permanent deletion is immediate and irreversible.
Restoring a world is rejected when the owner is already at the active-world limit.

**Outcome:** A user can manage the complete private lifecycle of their worlds, understand the limits
of a browser-bound temporary account, and abandoned anonymous accounts are removed safely instead of
accumulating forever.

### Data and services

- Add authorized rename, duplicate, export, soft-delete, restore, and permanent-delete operations.
- Use the stable private editor slug in export filenames and retain the internal UUID in export
  recovery metadata.
- Count only active worlds against the world limit; define how restored worlds behave when the user
  is already at the limit.
- Preserve recoverable soft-deleted worlds for a documented interval before permanent purge is
  implemented.
- Add user-level export and deletion service boundaries.
- Define foreign-key and purge behavior for activity, sessions, and worlds, plus browser-local draft
  cleanup when a purged user key is next encountered.
- Implement the two-phase anonymous cleanup scheduler and purge worker for empty, untouched-editor,
  and authored-editor accounts.
- Derive cleanup eligibility from current sessions, `last_seen_at`, owned-world revision/activity,
  account type, site role, and status.
- Clear a pending cleanup schedule transactionally when the anonymous user returns before purge.
- Recheck the retention class and every exclusion under a user-row lock immediately before purge.
- Make cleanup idempotent, bounded in batches, observable in dry-run mode, and safe to retry.
- Record scheduling, cancellation-on-return, and purge counts without logging authored documents.

### UI

- Add rename, duplicate, export, and `Move to trash` to each world row's action menu.
- Add a quiet Trash view with restore and permanent-delete actions.
- Move world reset into World settings and explain exactly what it replaces.
- Add `/account` with temporary-account status, created date, world count/limit, export-all, session
  explanation, and account deletion.
- Explain that clearing site data or changing browsers loses access until registration exists.
- State the applicable inactivity retention plainly. If a returning account was scheduled but not
  purged, explain that its cleanup was cancelled and its work remains available.
- Link a concise privacy/cookie notice that describes the necessary session cookie and command data
  planned for hosted play.
- Do not show a consent popup when only the necessary session cookie is present.

### Verification

- Test every lifecycle operation through policy, service, route, and component layers.
- Test duplicate-at-limit and restore-at-limit behavior.
- Test soft-deleted worlds cannot be edited through stale editor URLs.
- Test exports against the current world schema.
- Test account deletion revokes sessions and makes owned private data inaccessible according to the
  documented purge policy.
- Test every cleanup class immediately before, at, and after its cutoff.
- Test exclusions for registered, administrator, suspended, recently active, and nonexpired-session
  accounts.
- Test return-during-grace, return-versus-purge races, repeated scheduler runs, repeated purge runs,
  batch boundaries, and a failure halfway through a batch.
- Test that an untouched starter becomes an authored account as soon as a saved revision advances.
- Test purging removes or anonymizes every dependent row according to policy and leaves no owned
  world or valid session behind.
- Browser-test destructive confirmations, focus restoration, escape behavior, and narrow layouts.

### Exit criteria

- Users can safely organize, back up, trash, and restore their private work.
- The product is honest about temporary identity without obstructing ordinary editing.
- Private/incognito visits and abandoned starter worlds no longer create permanent orphan accounts.

## [x] Slice 4: Strong administrator identity and read-only oversight

Slice 4 is retained as completed implementation history. Its Google OIDC credential path is
transitional and is deliberately replaced by Slice 5 before administrator mutations, public
registration, or production launch. No Google administrator was bootstrapped before this decision,
so the replacement must remove the unused provider routes, configuration, cookies, and identity
table rather than maintaining two authentication systems.

Slice 4 uses Google OpenID Connect Authorization Code flow with S256 PKCE. Administrator authority
is bound to one configured Google `sub` claim, with an optional configured email as a second check;
the returned email must always be verified. Mothmark stores the provider subject and verification
timestamps, discards Google access and ID tokens after callback verification, and issues its own
24-hour opaque, hashed, admin-audience session. Initial bootstrap occurs only when no administrator
already exists. Changing configuration alone can never rebind an existing administrator.

Recovery is a deliberate operational procedure: establish and independently verify the replacement
Google subject, update the single `auth_identities` row in a reviewed database transaction, revoke
all existing administrator sessions in that same transaction, and record a credential-free
operational recovery event. There is no email-only bootstrap, public recovery form, secondary
administrator, password fallback, or automatic subject replacement.

**Outcome:** The administrator can authenticate durably and inspect users and worlds without gaining
that authority through an anonymous browser cookie.

### Data and services

- Add `auth_identities`.
- Provision the initial registered administrator through configuration and a verified provider
  identity; do not put credentials in a migration.
- Add admin-audience sessions and route guards.
- Keep public registration and ordinary registered login disabled.
- Add read-only administrator queries for users and worlds.
- Record administrator sign-in and high-sensitivity reads as appropriate without logging secrets.

### UI

- Add a narrowly exposed administrator sign-in path.
- Add an admin shell distinct from the editor activity rail.
- Add `/admin/users` with status, account type, world count, limit, last activity, and scheduled
  cleanup state.
- Add `/admin/users/[userId]` with account metadata, worlds, sessions, and effective read-only
  permission summary.
- Add `/admin/worlds` with owner, revision, size, lifecycle, and update information.
- Add `/admin/worlds/[worldId]` with metadata and read-only world inspection.
- Do not add arbitrary database CRUD or administrator impersonation.

### Verification

- Test anonymous, registered non-admin, wrong-audience, expired, and revoked access to every admin
  route.
- Test administrator identity bootstrap cannot be claimed by a different provider subject or
  unverified address.
- Test admin reads do not change world `updated_at` or ownership.
- Browser-test sign-in, sign-out, session expiry, direct deep links, and back navigation.

### Exit criteria

- There is exactly one supported path to administrator authority and it requires strong identity.
- The administrator can inspect operational state without mutating user data.

## [x] Slice 5: Registered accounts, password authentication, and administrator replacement

**Outcome:** A person can register or upgrade a temporary account, verify the address, sign in from
another browser, recover access, and keep the same worlds. The initial administrator uses the same
credential system plus MFA and is provisioned without a public privilege-escalation path. Google
OIDC is no longer part of Mothmark.

### Data and services

- Add `user_emails`, `password_credentials`, `account_registrations`, `account_tokens`, TOTP
  authenticators, and hashed administrator recovery codes.
- Remove the unused Google authorization and callback routes, Google flow cookies, provider-token
  verification, Google environment variables, and `auth_identities` table. The migration must fail
  closed if an unexpected provider identity exists instead of silently deleting it.
- Hash passwords with versioned Argon2id parameters measured against the deployed runtime. Keep the
  algorithm and work factor upgradeable without forcing a password reset.
- Implement public registration, email verification, sign-in, sign-out, password change,
  forgot-password, reset-password, and resend-verification services.
- Upgrade an authenticated anonymous user in place only after email verification. Preserve its user
  ID, worlds, limits, activity, drafts, and valid editor session; clear cleanup scheduling in the
  verification transaction.
- For registration without an anonymous editor session, create the registered user only when the
  verification token is successfully consumed.
- On sign-in from a different browser, issue a new editor-audience session and load server-saved
  worlds without creating a starter world or a duplicate user.
- Reconcile local drafts against their recorded server revision. Resume and upload a matching draft;
  if the server advanced, offer to export the local draft or open it as a copy rather than silently
  overwriting either version.
- Add generic, timing-conscious authentication responses and bounded throttling by account and
  network dimensions. Do not reveal account existence through status, copy, timing, or email-send
  behavior.
- Send verification and recovery email through one configured transactional provider. Store its API
  key and all credential-encryption keys only in Phase.
- Make account export and deletion work for registered users. Registered deletion requires recent
  password authentication, administrator deletion additionally requires MFA, and deleting the sole
  administrator is rejected until a replacement recovery procedure is completed.
- Add `pnpm admin:create` as the only initial-administrator provisioning path. It runs through Phase,
  reads the password from a non-echoing prompt rather than arguments or environment variables,
  creates or upgrades exactly the configured verified email, assigns `site_role = admin`, enrolls
  TOTP, emits one-time recovery codes, and records a credential-free operational event.
- Require password plus TOTP or a recovery code before issuing an admin-audience session. Public
  registration and ordinary account APIs must never set `site_role = admin`.
- Add a reviewed operational recovery command that resets administrator MFA or password only after
  explicit confirmation, revokes all administrator sessions, and records no credential material.
- Keep editor, play, and admin session audiences separate. Registering does not broaden an existing
  cookie to another host or audience.

### UI

- Add `/register`, `/sign-in`, `/verify-email`, `/forgot-password`, and `/reset-password` with
  restrained, accessible forms and password-manager-compatible fields.
- Update `/account` to offer `Create an account` for anonymous users and registered-account metadata,
  password change, session list, sign-out, export, and deletion for registered users.
- Explain before registration that the current temporary account and all its worlds will become
  available after sign-in on other browsers.
- Show verification-pending and expired-link states without disclosing whether another account owns
  an entered address.
- Never present administrator creation or role selection in public UI. Keep MFA enrollment and
  recovery-code confirmation in the operator provisioning flow; ordinary admin sign-in prompts for
  the second factor after a valid password.
- On cross-browser draft conflict, clearly identify the server revision and local draft and offer
  `Open draft as a copy`, `Export draft`, or `Use server version`.

### Verification

- Test password hashing and verification, unique salts, rehash upgrades, password length and
  compromised-value rejection, and ensure plaintext never reaches persistence or logs.
- Test registration and verification immediately before, at, and after token expiry; repeated and
  superseded tokens; email uniqueness; concurrent verification; and generic unknown-account
  responses.
- Test anonymous upgrade preserves the same user ID, worlds, limits, activity, local-draft namespace,
  and editor access while clearing cleanup state. Test a purge-versus-verification race under lock.
- Test signed-out registration creates no durable user before verification and does not create a
  starter world on later sign-in.
- Test login throttling, recovery throttling, successful-attempt reset, password reset token reuse,
  and session revocation after password or recovery changes.
- Test public routes cannot create an administrator, set a site role, bypass email verification, or
  issue an admin-audience session.
- Test `admin:create` concurrency, duplicate invocation, non-echoing input boundary, MFA enrollment,
  recovery-code one-time use, and complete rollback on failure.
- Test anonymous, registered non-admin, password-only admin, invalid/replayed TOTP, expired/revoked
  session, and recovery-code access against every administrator route.
- Browser-test registration, verification, sign-in/out, forgotten password, reset, anonymous claim,
  cross-browser access, two-browser draft reconciliation, administrator MFA, direct deep links, back
  navigation, account export/deletion, autofill semantics, and narrow layouts.

### Exit criteria

- Google OIDC and its configuration are gone; Mothmark has one account and session architecture.
- A temporary author can become a verified registered author without losing work and can sign in on
  another browser.
- Public registration cannot create administrator authority, while the provisioned administrator
  cannot obtain an admin session without MFA.
- Verification and recovery email, throttling, credential storage, and operational recovery are
  documented and exercised before any public signup is enabled in production.

## [x] Slice 6: Administrator permissions, limits, and world control

**Outcome:** The administrator can change a user's effective capabilities and limits, suspend access,
revoke sessions, and manage exceptional world situations with a complete audit trail.

### Data and services

- Add `user_permission_overrides` and `admin_audit_log`.
- Implement code-defined permission defaults and effective-permission resolution.
- Require a reason for suspension, ownership transfer, permanent deletion, and administrative world
  editing.
- Add administrator operations for permission overrides, world limits, suspension/reactivation,
  session revocation, world restore/archive/delete, and ownership transfer.
- Treat verified-email, password, and MFA status as inspectable security metadata, not administrator-
  editable credential fields. Administrators may revoke sessions or send the ordinary recovery path
  but cannot view hashes, set another user's password, read MFA secrets, or bypass verification.
- Add administrator operations to cancel scheduled anonymous cleanup and to request an immediate
  eligibility recheck; do not provide a force-purge action that bypasses retention and ownership
  checks.
- Keep owner checks and capability checks separate.
- Prevent ownership transfer when it would violate the target user's active-world limit unless the
  administrator explicitly changes that limit first.
- Make administrative editor entry read-only by default. Any content mutation enters a visible
  administrative-edit mode and is audited with old and new revisions.

### UI

- Add three-state permission controls: inherited, explicitly allowed, and explicitly denied.
- Show the effective result beside every override.
- Add world-limit editing to the user detail page.
- Show verified email, registration date, credential-change date, MFA enrollment state, and active
  sessions on user detail without exposing credential material.
- Add suspension/reactivation and session revocation with explicit confirmation.
- Show cleanup reason and deadline on anonymous user detail, with `Cancel scheduled cleanup` when
  applicable.
- Add ownership transfer, restore, export, and deletion controls to admin world detail.
- Show a persistent `Administrative editing` banner when editing another user's world.
- Add `/admin/audit` with filters for actor, action, target, and date.

### Verification

- Unit-test every permission default, override precedence, expiry, and site-role combination.
- Route-test every administrator mutation with and without its specific capability.
- Test suspension immediately invalidates ordinary access without changing ownership.
- Test registered, verification-pending, suspended, anonymous, and administrator principals against
  every permission default and management action.
- Test session revocation affects only the selected session unless all-session revocation is chosen.
- Test audit rows for successful mutations and ensure failed/no-op attempts do not claim success.
- Test ownership-transfer limits, concurrent transfers, and transfer back.
- Test cleanup cancellation and eligibility recheck permissions and audit records.
- Browser-test permission state clarity, reason validation, confirmations, and administrative-edit
  banners.

### Exit criteria

- Administrative authority is granular, visible, and auditable.
- No administrator UI action depends on manually editing PostgreSQL.

## [x] Slice 7: Registered-owner publishing and first hosted play

Slice 7 uses a 30-day inactivity window for play-only anonymous accounts, followed by the shared
7-day cleanup grace period. Anonymized playthrough diagnostics remain for 90 additional days. The
first hosted release limits a world snapshot to 1 MiB, a command line to 500 characters, and each
aggregate command/transcript representation to 1 MiB. Public titles are 1–80 characters and summaries
1–280 characters. The catalog orders by most recently published, and immutable records use the
`mothmark-engine-0.1.0` engine identifier.

**Outcome:** An eligible registered owner can publish an owned world, a visitor can find it on
`mothmark.app/play`, and selecting it opens a durable command-line playthrough that accepts and
saves commands. Administrators oversee publications without becoming the owner or publisher of
someone else's private world.

This is intentionally a larger slice. Publishing, catalog display, and playable delivery belong
together; do not ship a catalog of worlds that cannot be played.

### Data and services

- Add `world_versions`, `world_publications`, `world_releases`, `playthroughs`, and
  `playthrough_turns`.
- Implement immutable world-version creation from a saved editor revision.
- Implement first publication as one transaction that validates ownership/account eligibility,
  creates or reuses the version, creates the publication, creates release 1, and selects it.
- Enforce verified registered active owner plus `world.publish_owned`; verify an administrator cannot
  publish another user's world merely through site-role access.
- Validate and reserve publication slugs.
- Add public catalog and exact-slug publication reads that expose only release listing metadata and
  playable world data required by the player.
- Add play-audience anonymous bootstrap only when a visitor opens a world.
- Create or load the one active playthrough for the player/publication pair.
- Activate play-only anonymous cleanup using the same two-phase scheduler, with playthrough
  anonymization and separate diagnostic-retention cleanup.
- Resolve submitted commands through the normal engine player path.
- Append the immutable turn result and update the exact aggregate command string, visible transcript,
  current state, command count, timestamps, and revision atomically.
- Pin the playthrough to release 1 and its world version.
- Add route-aware authorization and ensure public play routes cannot resolve editor/admin data or
  operations.

### Owner and administrator UI

- Show Publishing controls only for eligible registered owners.
- Add public title, stable slug, short summary, and listed/unlisted choice.
- Add `Publish current version` with validation and clear failure states.
- After success, show the public URL, release number, and `Open published world`.
- Show no disabled Publishing section to anonymous users.
- Add `/admin/publications` and publication detail for active publication metadata and release 1.

### Play UI

- Build `mothmark.app/play` as a polished catalog of listed publications with search and direct
  `Play` actions.
- Present publications as a responsive grid of restrained world cards rather than rows. A card shows
  title, short summary, last published date, and `Play`; the entire card may be clickable when the
  named action remains visible and accessible.
- Keep the catalog focused on actual title, summary, and update information; do not invent ratings,
  popularity, categories, or author prestige.
- Build `mothmark.app/play/[world]` as the command-line player.
- Let the terminal occupy almost the entire viewport and preserve monospace output flow with the
  integrated prompt. Do not place it inside a promotional page, decorative game frame, or generic
  app card.
- Use a compact header with catalog navigation, world title, and a subtle `Saving…`, `Saved`, or
  `Save failed` state. Put the summary, release information, transcript actions, privacy link, and
  any available restart action in a small secondary menu or About panel.
- Do not show an inert restart placeholder. Add the action only when restart behavior exists.
- Make the terminal usable with keyboard and mobile software keyboards. Tapping the prompt row
  focuses the input, while initial page load does not unexpectedly summon a mobile keyboard.

### Focused verification

- Test immutable version and release constraints.
- Test anonymous owners cannot publish, including when granted a raw permission override.
- Test an ordinary registered owner can publish only an owned world and an administrator can publish
  only an administrator-owned world unless ownership is explicitly transferred.
- Test reserved, invalid, conflicting, and normalized slugs.
- Test listed versus unlisted catalog resolution.
- Test play-session audience separation and account creation only on world entry.
- Test play-only account scheduling, return cancellation, identity anonymization, and later
  playthrough purge at their independent cutoffs.
- Test active-playthrough uniqueness under concurrent first loads.
- Test command submission success, unresolved input, invalid input, engine error, stale revision, and
  malicious text rendering.
- Test that every accepted command creates exactly one matching immutable turn row and that a failed
  transaction changes neither the turn history nor the playthrough aggregate.
- Exercise hosted commands through `resolveTurn`; add companion `*.player.test.ts` coverage for any
  engine behavior introduced or changed in this work.

### Browser verification

- Publish an ordinary registered owner's world through the editor and open its public URL.
- Confirm it appears in the catalog when listed and does not when unlisted.
- Start play in a fresh browser, enter several commands, refresh, and see the same transcript and
  current state.
- Confirm browsing the catalog alone does not create a play user.
- Confirm another browser receives an independent playthrough.
- Confirm private, unpublished, suspended, anonymous-owned, and nonexistent worlds do not leak
  documents or metadata.
- Verify direct URL loading, search, keyboard play, mobile prompt behavior, and theme contrast.

### Exit criteria

- At least one ordinary registered owner's world can travel from editor save to immutable release
  to public discovery to persisted hosted command play.
- No mutable editor document is served directly as the live game.
- No anonymous-owned world can be published.

## Slice 8: Resume, restart, release updates, and publication lifecycle

**Outcome:** Players reliably continue or restart their world, while registered owners can publish
updates without invalidating active playthroughs and can manage their publication lifecycle;
administrators retain separate suspension oversight.

### Data and services

- Implement active-playthrough lookup for catalog personalization and direct world entry.
- Implement restart as one transaction: abandon the active playthrough and create a new one against
  the selected current release.
- Add completion and error lifecycle handling.
- Implement subsequent releases from newer immutable world versions.
- Keep existing active playthroughs pinned to their original release.
- Provide an explicit newer-release choice rather than silently migrating state.
- Implement owner-scoped listed/unlisted changes, ordinary unpublish, republish, and separate
  administrative suspension.
- Define ordinary-unpublish behavior for active playthroughs and a stricter immediate block for
  suspension.
- Lock the original slug after first publication.

### UI

- Show `Play`, `Continue`, or `Play again` on world cards when a play session already exists.
- Load the active playthrough immediately at `mothmark.app/play/[world]`.
- Add restart confirmation and make clear when restart selects a newer release.
- Show a restrained `New version available` choice while allowing the old playthrough to continue.
- Show published release and `unpublished changes` state in the eligible owner's world library and
  editor settings.
- Add `Publish update`, listing visibility, unpublish, republish, and suspension controls to the
  appropriate owner/admin surfaces.
- Give unavailable and suspended worlds distinct user-facing explanations without exposing private
  moderation details.

### Verification

- Test one-active-playthrough enforcement across restart races.
- Test continue, completed, abandoned, and errored states.
- Test a release update while an old playthrough is active; old state continues on the old version
  and new play starts on the new one.
- Test unlisted exact links, catalog exclusion, unpublish policy, republish, and immediate suspension.
- Test that editor saves alone never change catalog metadata or player behavior.
- Browser-test return visits, refresh, restart, update choice, and catalog personalization.

### Exit criteria

- Returning play is dependable and release changes are explicit.
- Publication lifecycle operations do not corrupt or silently rewrite historical playthroughs.

## Slice 9: Administrator playthrough diagnostics

**Outcome:** The administrator can inspect how a published release was actually played and use its
recorded turns to reproduce problems against the original or a newer world version. The review is
an evidence and regression-diagnostic surface, not product analytics or session surveillance.

### Primary workflows

- Open a player-reported or errored playthrough and jump to the exact command where the problem
  appeared.
- Determine whether unexpected behavior came from parsing, authored world behavior, state
  progression, or the engine runtime.
- Compare representative existing playthroughs with a proposed world release before publishing it.
- Check a saved command sequence after an engine change and locate the first player-observable
  regression.

Bulk funnels, engagement reporting, popular-command summaries, and player segmentation are not part
of this diagnostic surface.

### Data and services

- Add administrator-scoped playthrough list and detail queries.
- Support filters by publication, release, status, date, command count, and error state.
- Expose exact commands, recorded per-turn output and state, visible transcript, timestamps, and
  initial/current state without exposing session credentials, IP addresses, or browser fingerprints.
- Implement a read-only diagnostic runner that can replay the saved commands against the immutable
  original world version.
- Add an explicit comparison run against a selected newer world version without mutating either the
  saved playthrough or editor world.
- Compare each replayed turn with its immutable recorded turn and report the first command where
  resolution, player-visible output, or resulting state differs.
- Treat the saved transcript and turn rows as the authoritative original experience. A replay that
  claims to reproduce the original must use the recorded `engine_version`; if that compatible runner
  is unavailable, say so and offer a clearly labeled current-engine run instead. Never imply that
  the current engine is a historically faithful runtime.
- Bound diagnostic execution by command count, time, and payload size.
- Audit playthrough-detail access and every diagnostic run without copying commands, transcripts, or
  full state into audit metadata.

### UI

- Add `/admin/playthroughs` as a compact operational table with publication, release, short anonymous
  player reference, start and last-activity times, command count, status, and retention state. Do not
  make the raw user UUID the primary label.
- Add `/admin/playthroughs/[playthroughId]` with the recorded transcript as the dominant surface,
  rendered through the shared terminal output in read-only mode. Show release and engine identity,
  the exact newline command string with copy/download, timestamps, retention state, and a concise
  state summary beside it.
- Summarize current room, turn count, inventory, important flags, and player status before offering
  raw state JSON in a disclosure. On narrow screens, transcript and state become tabs instead of
  compressed columns.
- Add an explicitly labeled original-engine replay when its runner is available, plus `Run with
current engine` and `Compare…` actions. Comparison targets may be the current publication release,
  another selected release, or an authorized current editor revision.
- Present a diagnostic run as a command stepper, not simulated real-time playback. Allow the
  administrator to step through commands or jump to the first difference.
- Lead comparison results with `No observable difference` or `First difference at command N of M`,
  followed by recorded and replayed output and a human-readable state difference. Keep raw JSON diff
  secondary.
- Link publication and world admin pages to their playthroughs.
- Keep raw playthrough access out of ordinary anonymous and registered-author UI in this version.

### Verification

- Test administrator capability and audience enforcement on list, detail, and diagnostics.
- Test HTML/script-like command text renders inertly.
- Test faithful replay against the original immutable world and matching historical engine runner.
- Test the explicit unavailable-runner state and ensure a current-engine run is never labeled as the
  original experience.
- Test comparison with no difference, first-command difference, output-only difference, state
  difference, invalid historical data, and execution limits.
- Test diagnostic runs never append commands, alter status, update current state, or edit worlds.
- Test detail-access and diagnostic audit records contain identifiers and action metadata but no raw
  player text or full state.
- Browser-test filters, long transcripts, command stepping, copy behavior, narrow-layout tabs, diff
  legibility, and deep links.

### Exit criteria

- The administrator can move from a reported or errored playthrough to the exact recorded turn,
  understand what the player saw, and reproduce it without changing user data.
- Recorded turns are demonstrably useful for evaluating world or engine updates and locating the
  first player-observable regression.

## Slice 10: Public launch hardening and operations

**Outcome:** Anonymous and registered editing, publishing, hosted play, and administration can be
operated publicly with documented privacy, retention, abuse, migration, and recovery behavior.

### Product and policy

- Review measured cleanup volumes and finalize production retention for anonymous users, trashed
  worlds, world versions, releases, and playthroughs.
- Provide user-accessible deletion for current hosted playthroughs and editor-account data.
- State that hosted command input is stored and may be inspected by Mothmark administrators to
  diagnose and improve worlds.
- Keep raw player commands administrator-only until a separate author-analytics privacy decision is
  made.
- Publish concise privacy and cookie notices.
- Confirm that only necessary session cookies are active; if that changes, stop and design consent
  before enabling the new technology.

### Security and operations

- Add request body limits, command length limits, world-size limits, and rate limiting by endpoint
  and appropriate principal/IP dimensions.
- Add production-grade registration, password, verification, recovery, and MFA throttles, alerts,
  and abuse controls. Test that throttling cannot be bypassed with trivial email normalization
  changes or used for inexpensive permanent lockout.
- Monitor transactional-email delivery, bounce, complaint, and provider failure states without
  logging verification or reset links.
- Add structured security logging without passwords, password hashes, MFA secrets, recovery codes,
  email/reset tokens, or full authored/player text.
- Verify CSRF, origin, CSP, clickjacking, caching, and host-routing boundaries.
- Keep admin pages, private APIs, and source maps out of public play responses.
- Add reserved-slug maintenance and collision tests.
- Add database indexes based on measured list and playthrough query plans.
- Add backup, restore, soft-delete purge, anonymous-account cleanup, playthrough anonymization,
  session cleanup, and suspended-publication runbooks.
- Add cleanup-job metrics and alerts for scheduled, cancelled, purged, failed, and unexpectedly large
  batches.
- Replace the obsolete shared-world public launch gate in `docs/deployment-runbook.md`.
- Document administrator provisioning, password recovery, MFA recovery, encryption-key rotation,
  and transactional-email credential rotation without putting user credentials in Phase or command
  arguments.

### Full verification

- Run `pnpm lint`, `pnpm ts-check`, focused tests, relevant player-path tests, the full Jest suite,
  and `pnpm build`.
- Apply migrations to a production-like preview copy and verify upgrade and rollback assumptions.
- Test one anonymous editor, two registered editor users, one MFA-authenticated administrator, two
  independent play users, multiple worlds, a listed release, an unlisted release, an old active
  release, and a suspended publication.
- Attempt horizontal access using captured IDs across every private user, world, publication-management,
  and playthrough endpoint.
- Test registration, verification, password login, recovery, MFA, cookie deletion, expiry,
  revocation, session-audience confusion, and simultaneous tabs under production rate limits.
- Run cleanup in dry-run mode against the production-like copy, inspect every retention class, then
  run a bounded destructive batch and verify counts and referential integrity.
- Test desktop and mobile catalog/player paths, keyboard-only operation, and reduced-motion behavior.
- Review database and application logs for leaked world documents, transcripts, passwords, hashes,
  MFA material, emails, tokens, or email-provider payloads.

### Exit criteria

- The deployment runbook describes the actual individual-user architecture.
- Public hosts expose only their intended route and data surfaces.
- Retention, deletion, moderation, and operator recovery are documented and exercised.
- Production can be opened without relying on the former shared `main` world model.

## Migration strategy from the current repository

The current application has a public generic world API, one `main` slug, an editor hard-coded to
that slug, global local-draft storage, and no application identity. Migrate in this order:

1. Add nullable identity/ownership columns and the new identity tables without changing the running
   read path.
2. Mark `main` as the read-only template and verify its document remains schema-valid.
3. Introduce authenticated owner-scoped editor reads and writes behind the Slice 1 UI path.
4. Remove the editor's fallback to shared `slug/main` persistence.
5. Close or internalize unrestricted list/create/update/delete/schema-version routes.
6. Migrate local draft keys when a known owned world can be identified; never attach an ambiguous
   global draft to a newly created user automatically.
7. Add transitional administrator identity and read-only oversight only after ordinary authorization
   is enforced.
8. Replace the transitional identity path with shared registered credentials, anonymous-account
   claiming, operator-only administrator provisioning, and MFA before adding administrator
   mutations.
9. Add publication and hosted-play tables only with the end-to-end Slice 7 path.

Each migration must have a reversible `down` implementation appropriate to its data transformation,
or document clearly when rollback requires restoring a database snapshot. Never delete or transfer
the current `main` document as part of identity bootstrap.

## Testing conventions for this work

- Build schema-backed test objects with `createDefaultFieldObject(schema)` and override only fields
  relevant to the test.
- Use the typed ID utilities for IDs inside world and game-state documents. Database UUIDs remain
  database identifiers rather than engine entity IDs.
- Keep policy tests table-driven and cover every actor/account/status/ownership combination.
- Test authorization at the service/repository and route boundaries; component hiding is not security.
- Use separate users and worlds in tests that assert privacy boundaries.
- Collapse absent, deleted, and inaccessible private resources into the same response.
- Test concurrent registration, verification, administrator provisioning, quota, first-playthrough,
  restart, save, and release operations.
- When hosted play changes engine behavior, add focused tests and a companion `*.player.test.ts` path
  through `resolveTurn`.
- Browser-test every slice's stated user path against the application, normally at
  `http://localhost:3000`, before starting another development server.
- Before completing every slice, run its focused tests and `pnpm ts-check`. Before a public release,
  run lint, the full test suite, and the production build.

## Explicitly deferred work

The following are not part of these slices unless this document is deliberately revised:

- social or federated login providers;
- multiple email addresses, email-address changes, and merging two existing registered accounts;
- collaboration, invitations, shared world membership, or simultaneous authoring;
- anonymous-world publishing or administrator publication of an anonymous-owned private world;
- ordinary registered-author submission and review workflow;
- ratings, comments, follows, popularity rankings, achievements, or social profiles;
- editor session recording, heatmaps, or third-party product analytics;
- raw playthrough access for world authors;
- editor-preview playthrough persistence;
- multiple active playthrough slots for one player and publication;
- publication slug changes and redirect history;
- automatic state migration between releases; and
- automatic merging of separately created editor-host and play-host identities; and
- a shared cross-subdomain anonymous cookie.

## Decisions to make at slice boundaries

These choices are intentionally not guessed in the schema. Resolve each before starting the named
slice and record the decision in this document.

- **Before Slice 1:** editor-session lifetime and rotation policy aligned with the intended anonymous
  retention window, CSRF token shape, and the exact first world name.
- **Before Slice 2:** default anonymous `max_worlds` and administrator limit.
- **Before Slice 3:** confirm empty, untouched-editor, and authored-editor retention values; cleanup
  grace period; trash recovery interval; permanent-deletion behavior; and restore-at-limit behavior.
- **Before Slice 4 (resolved):** Google OIDC bound to one configured, verified provider subject;
  first verified sign-in bootstraps only an empty administrator slot, while recovery requires a
  reviewed identity rebind and session revocation transaction as documented in the deployment
  runbook.
- **Before Slice 5:** choose the transactional email provider and sending domain; verification and
  reset-token lifetimes; exact conservative email-normalization rules; Argon2id production work
  factors; compromised-password source; login, registration, recovery, and MFA throttle thresholds;
  TOTP encryption-key and recovery-code procedure; registered session lifetime and rotation; and
  whether production public registration opens immediately or remains configuration-gated after the
  slice lands.
- **Before Slice 7:** confirm play-only account and diagnostic playthrough retention values; maximum
  world/command/transcript sizes; default catalog ordering; engine-version identifier; and initial
  public title/summary validation limits.
- **Before Slice 8 (resolved):** ordinary unpublishing prevents new playthroughs but permits an
  existing active playthrough to continue indefinitely on its pinned release. Restart is unavailable
  until the owner republishes. Administrative suspension blocks both resume and commands immediately;
  lifting a suspension leaves the publication unpublished for an explicit owner republish.
- **Before Slice 9 (resolved):** `mothmark-engine-0.1.0` is the only installed faithful historical
  runner. A recorded version without a compatible runner reports `Original-engine replay
unavailable`; administrators may choose a separately labeled current-engine comparison, which is
  never represented as the original experience.
- **Before Slice 10 (resolved for initial launch):** retain the measured-policy starting points: 1
  day for empty anonymous accounts, 7 days for untouched editor accounts, 30 days for play-only
  accounts, 180 days for authored editor accounts, a shared 7-day cleanup grace period, 30 days for
  trashed worlds, and 90 additional days for anonymized play diagnostics. Hosted play limits are 30
  bootstraps per network per 15 minutes, 120 commands per player and 240 per network per minute, 20
  restarts per player and 40 per network per 15 minutes, and 10 progress deletions per player and 20
  per network per 15 minutes. Only necessary editor, play, administrator, and matching CSRF cookies
  are active; raw player commands are disclosed as administrator-visible diagnostic data.
