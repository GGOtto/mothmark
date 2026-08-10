import {readFileSync} from "node:fs";
import path from "node:path";

const readRepositoryFile = (filePath: string): string =>
	readFileSync(path.join(process.cwd(), filePath), "utf8");

describe("database deployment workflows", () => {
	it("migrates and validates staging before building or deploying it", () => {
		const workflow = readRepositoryFile(".github/workflows/deploy-staging.yml");
		const migration = workflow.indexOf("pnpm release:migrate");
		const build = workflow.indexOf("vercel build");
		const deploy = workflow.indexOf("vercel deploy --prebuilt");

		expect(workflow).toContain("branches: [staging]");
		expect(workflow).toContain("environment: Preview");
		expect(workflow).toContain("secrets.NEON_API_KEY");
		expect(workflow).toContain("vars.NEON_PROJECT_ID");
		expect(workflow).toContain("NEON_BRANCH_NAME: preview");
		expect(workflow).not.toContain("secrets.DATABASE_MIGRATION_URL");
		expect(workflow).toContain("Missing VERCEL_TOKEN in the GitHub Preview environment");
		expect(workflow.indexOf("scripts/exportNeonConnectionUri.ts")).toBeLessThan(migration);
		expect(migration).toBeGreaterThan(-1);
		expect(migration).toBeLessThan(build);
		expect(build).toBeLessThan(deploy);
	});

	it("does not let Vercel race automatic canonical deployments against migrations", () => {
		const vercelConfig = JSON.parse(readRepositoryFile("vercel.json")) as {
			git?: {deploymentEnabled?: Record<string, boolean>};
		};

		expect(vercelConfig.git?.deploymentEnabled?.staging).toBe(false);
		expect(vercelConfig.git?.deploymentEnabled?.prod).toBe(false);
	});

	it("reapplies staging migrations after the weekly preview reset", () => {
		const workflow = readRepositoryFile(".github/workflows/refresh-preview-database.yml");
		const reset = workflow.indexOf("neondatabase/reset-branch-action");
		const migration = workflow.indexOf("pnpm release:migrate");

		expect(workflow).toContain("group: staging-storage-release");
		expect(workflow).toContain("ref: staging");
		expect(workflow).toContain("NEON_BRANCH_NAME: preview");
		expect(workflow).not.toContain("secrets.DATABASE_MIGRATION_URL");
		expect(reset).toBeGreaterThan(-1);
		expect(reset).toBeLessThan(migration);
	});

	it("keeps production migration-gated before promotion", () => {
		const workflow = readRepositoryFile(".github/workflows/production-storage-compatibility.yml");
		const migration = workflow.indexOf("pnpm release:migrate");
		const build = workflow.indexOf("vercel build");
		const deploy = workflow.indexOf("vercel deploy --prebuilt");

		expect(workflow).toContain("branches: [prod]");
		expect(workflow).toContain("environment: Production");
		expect(workflow).toContain("NEON_BRANCH_NAME: production");
		expect(workflow).not.toContain("secrets.DATABASE_MIGRATION_URL");
		expect(workflow).toContain("Missing VERCEL_TOKEN in the GitHub Production environment");
		expect(workflow.indexOf("scripts/exportNeonConnectionUri.ts")).toBeLessThan(migration);
		expect(migration).toBeGreaterThan(-1);
		expect(migration).toBeLessThan(build);
		expect(build).toBeLessThan(deploy);
	});
});
