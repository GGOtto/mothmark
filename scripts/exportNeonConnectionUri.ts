import {exportDatabaseUrl, getNeonConnectionUri} from "./neonConnectionUri";

const requiredEnvironmentValue = (name: string): string => {
	const value = process.env[name];
	if (!value) {
		throw new Error(`Missing required environment value ${name}.`);
	}

	return value;
};

const main = async (): Promise<void> => {
	const uri = await getNeonConnectionUri({
		apiKey: requiredEnvironmentValue("NEON_API_KEY"),
		projectId: requiredEnvironmentValue("NEON_PROJECT_ID"),
		branchName: requiredEnvironmentValue("NEON_BRANCH_NAME"),
	});

	exportDatabaseUrl(uri, requiredEnvironmentValue("GITHUB_ENV"));
};

void main().catch((error: unknown) => {
	console.error(
		error instanceof Error ? error.message : "Unable to retrieve the Neon connection URI.",
	);
	process.exitCode = 1;
});
