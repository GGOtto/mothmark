/** @jest-environment node */

import {resolveWordNetDatabasePaths} from "./wordnetDatabasePaths.server";
import nextConfig from "../../../next.config";

describe("WordNet database paths", () => {
	it("uses runtime module resolution instead of the package's build-machine path", () => {
		const loader = Object.assign(
			() => ({version: "3.1", path: "/ROOT/node_modules/wordnet-db/dict"}),
			{
				resolve: (id: string) => `/runtime/node_modules/${id}`,
			},
		);

		expect(resolveWordNetDatabasePaths("/ignored", loader)).toEqual({
			version: "3.1",
			nounIndexPath: "/runtime/node_modules/wordnet-db/dict/index.noun",
			nounDataPath: "/runtime/node_modules/wordnet-db/dict/data.noun",
		});
	});

	it.each(["/api/editor/item-suggestions", "/api/editor/item-icon-suggestions"])(
		"packages the runtime module and dictionary for %s",
		(route) => {
			expect(nextConfig.outputFileTracingIncludes?.[route]).toEqual([
				"./node_modules/wordnet-db/index.js",
				"./node_modules/wordnet-db/package.json",
				"./node_modules/wordnet-db/dict/**/*",
			]);
		},
	);
});
