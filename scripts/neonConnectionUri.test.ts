import {mkdtempSync, readFileSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";

import {exportDatabaseUrl, getNeonConnectionUri} from "./neonConnectionUri";

const jsonResponse = (body: unknown, status = 200) => ({
	ok: status >= 200 && status < 300,
	status,
	json: async (): Promise<unknown> => body,
});

describe("Neon deployment connection lookup", () => {
	it("retrieves the direct URI for the exact named branch", async () => {
		const fetchImpl = jest
			.fn()
			.mockResolvedValueOnce(
				jsonResponse({
					branches: [
						{id: "br-production", name: "production"},
						{id: "br-preview", name: "preview"},
					],
				}),
			)
			.mockResolvedValueOnce(jsonResponse({databases: [{name: "neondb", owner_name: "neondb_owner"}]}))
			.mockResolvedValueOnce(jsonResponse({uri: "postgresql://owner:secret@host/neondb"}));

		await expect(
			getNeonConnectionUri({
				apiKey: "api-key",
				projectId: "project-id",
				branchName: "preview",
				fetchImpl,
			}),
		).resolves.toBe("postgresql://owner:secret@host/neondb");

		expect(fetchImpl).toHaveBeenNthCalledWith(
			3,
			expect.stringContaining("branch_id=br-preview"),
			expect.objectContaining({headers: {Authorization: "Bearer api-key"}}),
		);
		expect(fetchImpl).toHaveBeenNthCalledWith(
			3,
			expect.stringContaining("pooled=false"),
			expect.any(Object),
		);
	});

	it("fails closed when the configured branch is missing", async () => {
		const fetchImpl = jest
			.fn()
			.mockResolvedValue(jsonResponse({branches: [{id: "br-production", name: "production"}]}));

		await expect(
			getNeonConnectionUri({
				apiKey: "api-key",
				projectId: "project-id",
				branchName: "preview",
				fetchImpl,
			}),
		).rejects.toThrow('Expected exactly one Neon branch named "preview", found 0.');
	});

	it("masks the URI before exporting it to later workflow steps", () => {
		const directory = mkdtempSync(path.join(tmpdir(), "mothmark-neon-"));
		const environmentPath = path.join(directory, "github-env");
		const log = jest.fn();
		const uri = "postgresql://owner:secret@host/neondb";

		exportDatabaseUrl(uri, environmentPath, log);

		expect(log).toHaveBeenCalledWith(`::add-mask::${uri}`);
		expect(readFileSync(environmentPath, "utf8")).toBe(`DATABASE_URL=${uri}\n`);
	});
});
