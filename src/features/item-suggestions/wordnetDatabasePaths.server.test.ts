/** @jest-environment node */

import {resolveWordNetDatabasePaths} from "./wordnetDatabasePaths.server";

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
});
