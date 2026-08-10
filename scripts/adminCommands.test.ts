import {readFileSync} from "node:fs";
import path from "node:path";

describe("administrator operator commands", () => {
	it("runs production provisioning directly in the Production Phase environment", () => {
		const packageJson = JSON.parse(
			readFileSync(path.join(process.cwd(), "package.json"), "utf8"),
		) as {scripts: Record<string, string>};

		expect(packageJson.scripts["admin:create:prod"]).toBe(
			"phase run --env production 'node --conditions=react-server --import tsx scripts/adminCreate.ts'",
		);
		expect(packageJson.scripts["admin:create:prod"]).not.toContain("pnpm admin:create");
	});
});
