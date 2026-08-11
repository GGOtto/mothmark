import {spawnSync} from "node:child_process";
import {createInterface} from "node:readline/promises";

type Options = {
	autoApproveProduction: boolean;
	stagingOnly: boolean;
};

type WorkflowRun = {
	conclusion: string | null;
	databaseId: number;
	status: string;
	url: string;
};

const HELP = `Deploy the current main commit through the gated staging and production workflows.

Usage: pnpm release [options]

Options:
  --yes          Skip the production smoke-test confirmation
  --staging-only Stop after the staging workflow succeeds
  --help         Show this help

The command requires git, the GitHub CLI (gh), a clean worktree, and an authenticated
GitHub session. It never runs migrations locally; GitHub Actions retains ownership of
the existing migration, validation, build, and deployment gates.`;

export const parseOptions = (args: string[]): Options => {
	const options: Options = {
		autoApproveProduction: false,
		stagingOnly: false,
	};

	for (const arg of args) {
		switch (arg) {
			case "--yes":
				options.autoApproveProduction = true;
				break;
			case "--staging-only":
				options.stagingOnly = true;
				break;
			case "--help":
				console.log(HELP);
				process.exit(0);
			default:
				throw new Error(`Unknown option: ${arg}\n\n${HELP}`);
		}
	}

	return options;
};

const command = (executable: string, args: string[], capture = false): string => {
	const result = spawnSync(executable, args, {
		encoding: "utf8",
		stdio: capture ? ["inherit", "pipe", "inherit"] : "inherit",
	});

	if (result.error) {
		throw new Error(`Could not run ${executable}: ${result.error.message}`);
	}
	if (result.status !== 0) {
		throw new Error(`${executable} ${args.join(" ")} exited with status ${result.status}`);
	}

	return capture ? result.stdout.trim() : "";
};

const git = (...args: string[]): string => command("git", args, true);
const gh = (...args: string[]): string => command("gh", args, true);

const delay = (milliseconds: number): Promise<void> =>
	new Promise((resolve) => setTimeout(resolve, milliseconds));

const assertReleaseCandidate = (): string => {
	command("git", ["rev-parse", "--is-inside-work-tree"], true);
	command("gh", ["auth", "status"]);

	if (git("status", "--porcelain") !== "") {
		throw new Error(
			"The worktree is not clean. Commit or stash local changes so it is clear what will be released.",
		);
	}

	command("git", ["fetch", "origin", "main", "staging", "prod"]);
	const candidate = git("rev-parse", "HEAD");
	const remoteMain = git("rev-parse", "origin/main");

	if (candidate !== remoteMain) {
		throw new Error(
			`HEAD (${candidate.slice(0, 12)}) is not the current origin/main (${remoteMain.slice(0, 12)}). ` +
				"Merge and push the intended release to main, then run this command from that commit.",
		);
	}

	return candidate;
};

const sameTree = (left: string, right: string): boolean =>
	git("rev-parse", `${left}^{tree}`) === git("rev-parse", `${right}^{tree}`);

const findPromotionPullRequest = (source: string, target: string): number | undefined => {
	const result = gh(
		"pr",
		"list",
		"--state",
		"open",
		"--head",
		source,
		"--base",
		target,
		"--json",
		"number",
		"--limit",
		"1",
	);
	const pulls = JSON.parse(result) as Array<{number: number}>;
	return pulls[0]?.number;
};

const promote = (source: string, target: string, expectedSourceSha: string): string => {
	command("git", ["fetch", "origin", source, target]);
	const actualSourceSha = git("rev-parse", `origin/${source}`);
	if (actualSourceSha !== expectedSourceSha) {
		throw new Error(
			`origin/${source} changed during the release. Expected ${expectedSourceSha.slice(0, 12)}, ` +
				`found ${actualSourceSha.slice(0, 12)}. Start again after reviewing the new commit.`,
		);
	}

	if (sameTree(`origin/${source}`, `origin/${target}`)) {
		const existingSha = git("rev-parse", `origin/${target}`);
		console.log(`\n${target} already contains the same tree (${existingSha.slice(0, 12)}).`);
		return existingSha;
	}

	let pullNumber = findPromotionPullRequest(source, target);
	if (pullNumber === undefined) {
		const title = `Promote ${source} to ${target}`;
		command("gh", [
			"pr",
			"create",
			"--base",
			target,
			"--head",
			source,
			"--title",
			title,
			"--body",
			`Automated release promotion of ${expectedSourceSha}.`,
		]);
		pullNumber = findPromotionPullRequest(source, target);
	}

	if (pullNumber === undefined) {
		throw new Error(`GitHub did not return the ${source} → ${target} promotion pull request.`);
	}

	console.log(`\nMerging ${source} → ${target} via PR #${pullNumber}…`);
	command("gh", ["pr", "merge", String(pullNumber), "--merge"]);
	command("git", ["fetch", "origin", target]);

	if (!sameTree(`origin/${source}`, `origin/${target}`)) {
		throw new Error(`origin/${target} does not contain the expected ${source} tree after PR merge.`);
	}

	return git("rev-parse", `origin/${target}`);
};

const findWorkflowRun = (workflow: string, sha: string): WorkflowRun | undefined => {
	const result = gh(
		"run",
		"list",
		"--workflow",
		workflow,
		"--commit",
		sha,
		"--event",
		"push",
		"--limit",
		"1",
		"--json",
		"databaseId,status,conclusion,url",
	);
	return (JSON.parse(result) as WorkflowRun[])[0];
};

const waitForWorkflow = async (workflow: string, sha: string, label: string): Promise<void> => {
	console.log(`\nWaiting for the ${label} workflow for ${sha.slice(0, 12)}…`);
	let run: WorkflowRun | undefined;

	for (let attempt = 0; attempt < 60; attempt += 1) {
		run = findWorkflowRun(workflow, sha);
		if (run !== undefined) break;
		await delay(2_000);
	}

	if (run === undefined) {
		throw new Error(`No ${label} workflow run appeared for ${sha} after two minutes.`);
	}

	console.log(run.url);
	if (run.status === "completed") {
		if (run.conclusion !== "success") {
			throw new Error(`${label} workflow finished with conclusion: ${run.conclusion ?? "unknown"}`);
		}
		return;
	}

	command("gh", ["run", "watch", String(run.databaseId), "--exit-status"]);
};

const confirmProduction = async (): Promise<void> => {
	const terminal = createInterface({input: process.stdin, output: process.stdout});
	try {
		const answer = await terminal.question(
			"\nSmoke-test the canonical staging site. Type production to continue: ",
		);
		if (answer.trim() !== "production") {
			throw new Error("Production promotion cancelled; staging remains deployed.");
		}
	} finally {
		terminal.close();
	}
};

export const main = async (args = process.argv.slice(2)): Promise<void> => {
	const options = parseOptions(args);
	const candidate = assertReleaseCandidate();
	console.log(`\nRelease candidate: ${candidate}`);

	const stagingSha = promote("main", "staging", candidate);
	await waitForWorkflow("deploy-staging.yml", stagingSha, "staging deployment");
	console.log("\nStaging deployment succeeded.");

	if (options.stagingOnly) return;
	if (!options.autoApproveProduction) await confirmProduction();

	const productionSha = promote("staging", "prod", stagingSha);
	await waitForWorkflow(
		"production-storage-compatibility.yml",
		productionSha,
		"production deployment",
	);
	console.log(`\nProduction deployment succeeded for ${productionSha}.`);
};

if (process.argv[1]?.endsWith("scripts/deploy.ts")) {
	main().catch((error: unknown) => {
		console.error(`\nDeployment stopped: ${error instanceof Error ? error.message : String(error)}`);
		process.exitCode = 1;
	});
}
