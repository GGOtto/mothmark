import knex from "knex";

import knexConfig from "../knexfile";

const migrationName = process.argv[2]?.trim();

if (!migrationName) {
	throw new Error("Provide a migration name: pnpm db:make <name>");
}

const database = knex(knexConfig);

const main = async (): Promise<void> => {
	try {
		const migrationPath = await database.migrate.make(migrationName);
		console.log(`Created ${migrationPath}`);
	} finally {
		await database.destroy();
	}
};

main().catch((error: unknown) => {
	console.error(error);
	process.exitCode = 1;
});
