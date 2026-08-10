/** @jest-environment node */

import {readFileSync} from "node:fs";
import path from "node:path";

import {
	compareStorageContracts,
	createStorageContract,
	serializeStorageContract,
	type StorageContract,
} from "./storageContract";

describe("persisted storage contract", () => {
	it("matches the reviewed root snapshot", () => {
		const snapshot = readFileSync(path.join(process.cwd(), "storage-contract.snapshot.json"), "utf8");
		expect(JSON.parse(snapshot)).toEqual(
			JSON.parse(serializeStorageContract(createStorageContract())),
		);
	});

	it("allows additive optional fields and enum values", () => {
		const previous = createStorageContract();
		const candidate = structuredClone(previous);
		candidate.gameMessage.properties!.extra = {
			kind: "optional",
			input: {kind: "string"},
		};
		candidate.gameMessage.properties!.type.entries!.push("notice");
		expect(compareStorageContracts(previous, candidate)).toEqual([]);
	});

	it("rejects removed fields and new required fields", () => {
		const previous = createStorageContract();
		const candidate = structuredClone(previous) as StorageContract;
		delete candidate.gameMessage.properties!.text;
		candidate.gameMessage.properties!.source = {kind: "string"};
		expect(compareStorageContracts(previous, candidate)).toEqual(
			expect.arrayContaining([
				"GameMessage.text was removed.",
				"GameMessage.source is a new required field.",
			]),
		);
	});

	it("requires a migration when schema implementation changes without an additive contract change", () => {
		const previous = createStorageContract();
		const candidate = structuredClone(previous);
		candidate.schemaSourceDigest = "changed";

		expect(compareStorageContracts(previous, candidate)).toEqual([
			"Persisted schema source changed without a detectable additive contract change; use a migration.",
		]);
	});
});
