import {appendFileSync} from "node:fs";

type NeonBranch = {
	id?: string;
	name?: string;
};

type NeonDatabase = {
	name?: string;
	owner_name?: string;
};

type FetchResponse = {
	ok: boolean;
	status: number;
	json: () => Promise<unknown>;
};

type FetchImplementation = (
	input: string,
	init: {headers: {Authorization: string}},
) => Promise<FetchResponse>;

const readJson = async (response: FetchResponse, context: string): Promise<unknown> => {
	if (!response.ok) {
		throw new Error(`Neon API ${context} failed with HTTP ${response.status}.`);
	}

	return response.json();
};

const objectValue = (value: unknown): Record<string, unknown> => {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error("Neon API returned an unexpected response.");
	}

	return value as Record<string, unknown>;
};

export const getNeonConnectionUri = async ({
	apiKey,
	projectId,
	branchName,
	fetchImpl = fetch as FetchImplementation,
}: {
	apiKey: string;
	projectId: string;
	branchName: string;
	fetchImpl?: FetchImplementation;
}): Promise<string> => {
	const projectPath = `https://console.neon.tech/api/v2/projects/${encodeURIComponent(projectId)}`;
	const headers = {Authorization: `Bearer ${apiKey}`};
	const branchesPayload = objectValue(
		await readJson(await fetchImpl(`${projectPath}/branches?limit=100`, {headers}), "branch lookup"),
	);
	const branches = Array.isArray(branchesPayload.branches)
		? (branchesPayload.branches as NeonBranch[])
		: [];
	const matches = branches.filter((branch) => branch.name === branchName && branch.id);

	if (matches.length !== 1) {
		throw new Error(
			`Expected exactly one Neon branch named ${JSON.stringify(branchName)}, found ${matches.length}.`,
		);
	}

	const branchId = matches[0].id as string;
	const databasesPayload = objectValue(
		await readJson(
			await fetchImpl(`${projectPath}/branches/${encodeURIComponent(branchId)}/databases`, {
				headers,
			}),
			"database lookup",
		),
	);
	const databases = Array.isArray(databasesPayload.databases)
		? (databasesPayload.databases as NeonDatabase[])
		: [];
	const database =
		databases.find((candidate) => candidate.name === "neondb") ??
		(databases.length === 1 ? databases[0] : undefined);

	if (!database?.name || !database.owner_name) {
		throw new Error(
			`Could not select a Neon database and owner for branch ${JSON.stringify(branchName)}.`,
		);
	}

	const connectionQuery = new URLSearchParams({
		branch_id: branchId,
		database_name: database.name,
		role_name: database.owner_name,
		pooled: "false",
	});
	const connectionPayload = objectValue(
		await readJson(
			await fetchImpl(`${projectPath}/connection_uri?${connectionQuery}`, {headers}),
			"connection URI lookup",
		),
	);
	const uri = connectionPayload.uri;

	if (typeof uri !== "string" || !/^postgres(?:ql)?:\/\//.test(uri) || /[\r\n]/.test(uri)) {
		throw new Error("Neon API returned an invalid connection URI.");
	}

	return uri;
};

export const exportDatabaseUrl = (
	uri: string,
	githubEnvironmentPath: string,
	log: (message: string) => void = console.log,
): void => {
	log(`::add-mask::${uri}`);
	appendFileSync(githubEnvironmentPath, `DATABASE_URL=${uri}\n`, "utf8");
};
