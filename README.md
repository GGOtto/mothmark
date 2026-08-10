This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Database

Development uses the database configured in Phase's `Development` environment. The checked-in
`.phase.json` selects the Mothmark app and that environment; `pnpm dev` runs Next.js through the
Phase CLI so its database variables are injected into the server process.

Authenticate with Phase once, then start the development server:

```bash
phase auth
pnpm dev
```

Apply pending migrations to the Phase Development database with its direct migration URL:

```bash
pnpm db:migrate
```

To create a migration, run:

```bash
pnpm db:make initial_schema
```

The `db:up`, `db:down`, and `db:create` scripts remain available for explicitly requested local
PostgreSQL work, but they are not part of the normal development path.

Migration files live in `db/migrations`. Application database access should go through the DBAL in
`src/db/dbal`; call `getDb()` to get the shared Knex client.

Persisted schema evolution and production gating are documented in
[SCHEMA_COMPATIBILITY_README.md](SCHEMA_COMPATIBILITY_README.md),
[BREAKING_SCHEMA_MIGRATIONS_README.md](BREAKING_SCHEMA_MIGRATIONS_README.md), and
[DEPLOYMENT_STORAGE_GATE_README.md](DEPLOYMENT_STORAGE_GATE_README.md).

### World API

| Method | Path                            | Purpose                                       |
| ------ | ------------------------------- | --------------------------------------------- |
| GET    | `/api/world`                    | List worlds, newest update first              |
| POST   | `/api/world`                    | Create a world from a complete world document |
| POST   | `/api/world/default`            | Create a world populated with schema defaults |
| GET    | `/api/world/:id`                | Get a world by database ID                    |
| PUT    | `/api/world/:id`                | Update its name, slug, or world document      |
| PATCH  | `/api/world/:id`                | Partially update the same fields              |
| DELETE | `/api/world/:id`                | Delete a world                                |
| GET    | `/api/world/slug/:slug`         | Get a world by slug                           |
| PATCH  | `/api/world/:id/schema-version` | Update its stored schema version              |

Successful responses use `{ "data": ... }`. Validation, conflicts, missing records, and internal
failures return an `{ "error": { "code", "message" } }` object with the appropriate HTTP status.
World documents are validated with `WorldSchema` before they reach PostgreSQL.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deployment

The PostgreSQL-backed API requires a Next.js server runtime, so the project is no longer configured
as a static export. The former Cloudflare Pages deployment cannot serve these routes. The selected
deployment stack is Vercel, Neon PostgreSQL, and Phase. Follow the complete
[deployment runbook](docs/deployment-runbook.md) for initial setup, routine releases, migrations,
rollback, and the public shared-world launch gate.
