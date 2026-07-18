import knex from "knex";

import knexConfig from "../knexfile";

const database = knex(knexConfig);

const main = async (): Promise<void> => {
	try {
		const [batch, migrations] = await database.migrate.latest();

		if (migrations.length === 0) {
			console.log("Database is already up to date.");
		} else {
			console.log(`Applied migration batch ${batch}:`);
			for (const migration of migrations) {
				console.log(`- ${migration}`);
			}
		}
	} finally {
		await database.destroy();
	}
};

main().catch((error: unknown) => {
	console.error(error);
	process.exitCode = 1;
});
