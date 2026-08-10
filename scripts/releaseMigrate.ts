import knex from "knex";

import knexConfig from "../knexfile";
import {runStorageCompatibility} from "../src/compat/runStorageCompatibility";

const database = knex(knexConfig);

async function main(): Promise<void> {
	try {
		const [batch, migrations] = await database.migrate.latest();
		if (migrations.length > 0)
			console.log(`Applied database migration batch ${batch}: ${migrations.join(", ")}`);
		const result = await runStorageCompatibility(database, {
			commit: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA,
		});
		console.log(
			`Validated ${result.counts.worlds} worlds, ${result.counts.worldVersions} publication snapshots, ${result.counts.playthroughs} playthroughs, and ${result.counts.turns} turns.`,
		);
	} finally {
		await database.destroy();
	}
}

main().catch((error: unknown) => {
	console.error(error);
	process.exitCode = 1;
});
