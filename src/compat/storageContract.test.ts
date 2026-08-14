/** @jest-environment node */

import {readFileSync} from "node:fs";
import path from "node:path";

import {
	compareStorageContracts,
	createStorageContract,
	serializeStorageContract,
	storageContractDigest,
	type StorageContract,
} from "./storageContract";

const reorderObjectKeys = (value: unknown): unknown => {
	if (Array.isArray(value)) return value.map(reorderObjectKeys);
	if (value && typeof value === "object")
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>)
				.reverse()
				.map(([key, child]) => [key, reorderObjectKeys(child)]),
		);
	return value;
};

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

	it("allows additive optional fields nested beneath an unchanged stored default", () => {
		const previous = createStorageContract();
		previous.gameMessage = {
			kind: "default",
			defaultValue: [],
			input: {
				kind: "array",
				element: {
					kind: "object",
					properties: {text: {kind: "string"}},
				},
			},
		};
		const candidate = structuredClone(previous);
		candidate.gameMessage.input!.element!.properties!.source = {
			kind: "optional",
			input: {kind: "string"},
		};

		expect(compareStorageContracts(previous, candidate)).toEqual([]);
	});

	it("still rejects a changed stored default when its nested contract also changes", () => {
		const previous = createStorageContract();
		previous.gameMessage = {
			kind: "default",
			defaultValue: [],
			input: {kind: "array", element: {kind: "string"}},
		};
		const candidate = structuredClone(previous);
		candidate.gameMessage.defaultValue = ["changed"];
		candidate.gameMessage.input!.element = {kind: "optional", input: {kind: "string"}};

		expect(compareStorageContracts(previous, candidate)).toEqual([
			"GameMessage changed its stored default.",
		]);
	});

	it("treats PostgreSQL jsonb key reordering as the same reviewed contract", () => {
		const contract = createStorageContract();
		const reordered = reorderObjectKeys(contract) as StorageContract;

		expect(JSON.stringify(reordered)).not.toBe(JSON.stringify(contract));
		expect(compareStorageContracts(reordered, contract)).toEqual([]);
		expect(storageContractDigest(reordered)).toBe(storageContractDigest(contract));
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
