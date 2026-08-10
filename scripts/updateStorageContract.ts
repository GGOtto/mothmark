import {writeFile} from "node:fs/promises";
import path from "node:path";
import {format, resolveConfig} from "prettier";

import {createStorageContract, serializeStorageContract} from "../src/compat/storageContract";

const target = path.join(process.cwd(), "storage-contract.snapshot.json");

async function main(): Promise<void> {
	const serialized = serializeStorageContract(createStorageContract());
	const prettierConfig = await resolveConfig(target);
	await writeFile(target, await format(serialized, {...prettierConfig, parser: "json"}), "utf8");
	console.log(`Updated ${target}`);
}

main().catch((error: unknown) => {
	console.error(error);
	process.exitCode = 1;
});
