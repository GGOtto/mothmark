/** @jest-environment node */

jest.mock("server-only", () => ({}));

import {
	suggestAliasesFromWiktionary,
	WIKTIONARY_ALIAS_LEXICON_VERSION,
} from "./wiktionaryLexicon.server";
import generatedLexicon from "./generated/wiktionaryAliases.json";

const suggestions = (name: string, iconCategory?: string) =>
	suggestAliasesFromWiktionary({name, aliases: [], tags: [], iconCategory}).map(({value}) => value);

describe("pinned Wiktionary alias lexicon", () => {
	it("records a stable generated version", () => {
		expect(WIKTIONARY_ALIAS_LEXICON_VERSION).toMatch(/^enwiktionary-[a-f0-9]{16}$/);
		expect(generatedLexicon.license.spdx).toBe("CC-BY-SA-4.0");
		expect(Object.keys(generatedLexicon.source.pageRevisions).length).toBeGreaterThan(600);
		expect(JSON.stringify(generatedLexicon).length).toBeLessThan(150_000);
	});

	it.each([
		["The battered leather satchel", "bag", ["bag"]],
		["Mud-caked riding boots", "footwear", ["shoe"]],
		["A map of the northern coast", "map", ["chart", "plan"]],
		["The rusty portcullis", "gate", ["gate"]],
		["The ritual dagger", "knife", ["knife"]],
		["A coil of rope", "rope", ["cord", "twine"]],
		["The silver pocket watch", "clock", ["timepiece"]],
	] as const)("finds safe ordinary references for %s", (name, iconCategory, expected) => {
		expect(suggestions(name, iconCategory)).toEqual(expect.arrayContaining([...expected]));
	});

	it("does not expand a satchel into neighboring bag types", () => {
		expect(suggestions("Satchel")).not.toEqual(
			expect.arrayContaining(["backpack", "knapsack", "pouch", "purse", "suitcase"]),
		);
	});

	it("does not reverse a shoe definition into specific footwear types", () => {
		expect(suggestions("Shoe")).not.toEqual(
			expect.arrayContaining(["boot", "boots", "sandals", "slipper"]),
		);
	});

	it("fails closed for unsupported non-Latin input", () => {
		expect(suggestions("古い刀")).toEqual([]);
	});
});
