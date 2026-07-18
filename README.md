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

Development uses PostgreSQL 17 installed through Homebrew, plus Knex for database access and
migrations. The checked-in `.env` contains local-only defaults; Phase can populate the same
variables in hosted environments.

Start PostgreSQL and apply all pending migrations:

```bash
pnpm db:up
pnpm migrate
```

There are no application migrations yet. To create one when the first table is ready, run:

```bash
pnpm db:make initial_schema
```

The local `mothmark` database only needs to be created once:

```bash
pnpm db:create
```

Use `pnpm db:down` to stop PostgreSQL. `pnpm db:migrate` is also available when keeping all database
commands under the same prefix is more convenient.

Migration files live in `db/migrations`. Application database access should go through the DBAL in
`src/db/dbal`; call `getDb()` to get the shared Knex client.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Cloudflare Pages

This project is configured as a static Next.js export, which Cloudflare Pages serves from
the generated `out` directory.

Create a Pages project from this repository and use:

- Framework preset: `Next.js (Static HTML Export)`
- Build command: `pnpm pages:build`
- Build output directory: `out`
- Node.js version: `22`

Cloudflare detects `pnpm-lock.yaml` and installs dependencies with pnpm. Preview the
same artifact locally with:

```bash
pnpm pages:build
python3 -m http.server 3000 --directory out
```

To build and directly publish the `out` directory to the `mothmark` Pages project, log
in with `pnpm wrangler login` once and run `pnpm deploy`.

The `/api/health` route is generated at build time as a static JSON response. If the app
later needs runtime API routes, server-side rendering, or middleware, migrate the deployment
to Cloudflare Workers using the OpenNext adapter; those features are not part of a static
Pages export.
