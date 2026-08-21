import {createRequire} from "node:module";
import {join} from "node:path";

type WordNetPackage = {
	version: string;
};

type RuntimeModuleLoader = {
	(id: string): unknown;
	resolve(id: string): string;
};

export type WordNetDatabasePaths = {
	version: string;
	nounIndexPath: string;
	nounDataPath: string;
};

/** Resolve package data at server runtime so build-machine paths are never persisted in a bundle. */
export function resolveWordNetDatabasePaths(
	baseDirectory = process.cwd(),
	loader: RuntimeModuleLoader = createRequire(join(baseDirectory, "package.json")),
): WordNetDatabasePaths {
	const database = loader("wordnet-db") as WordNetPackage;
	return {
		version: database.version,
		nounIndexPath: loader.resolve("wordnet-db/dict/index.noun"),
		nounDataPath: loader.resolve("wordnet-db/dict/data.noun"),
	};
}
