import {
	purgeScheduledAnonymousAccounts,
	purgeExpiredDiagnosticPlaythroughs,
	scheduleAnonymousCleanup,
} from "../src/db/dbal/anonymousCleanupRepository";
import {getDb} from "../src/db/dbal/knex";

const mode = process.argv.includes("--purge-playthroughs")
	? "purge-playthroughs"
	: process.argv.includes("--purge")
		? "purge"
		: "schedule";
const dryRun = process.argv.includes("--dry-run");
const batchArgument = process.argv.find((argument) => argument.startsWith("--batch="));
const batchSize = batchArgument ? Number(batchArgument.slice("--batch=".length)) : undefined;

try {
	const result = await (mode === "purge-playthroughs"
		? purgeExpiredDiagnosticPlaythroughs({batchSize, dryRun})
		: mode === "purge"
			? purgeScheduledAnonymousAccounts({batchSize, dryRun})
			: scheduleAnonymousCleanup({batchSize, dryRun}));
	console.info(JSON.stringify({dryRun, mode, result}));
} finally {
	await getDb().destroy();
}
