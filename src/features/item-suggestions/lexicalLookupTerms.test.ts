import {lexicalLookupTerms, trailingObjectPhrases, wordNetLookupTerms} from "./lexicalLookupTerms";

const lookup = (name: string) => lexicalLookupTerms({name, aliases: [], tags: []});

describe("lexical lookup terms", () => {
	it("uses the trailing object word in a descriptive name", () => {
		expect(lookup("The battered leather satchel")).toEqual(
			expect.arrayContaining(["battered leather satchel", "satchel"]),
		);
	});

	it("keeps the object immediately before a prepositional qualifier", () => {
		expect(lookup("A parchment map of the northern coast")).toEqual(expect.arrayContaining(["map"]));
		expect(lookup("A parchment map of the northern coast")).not.toContain("coast");
		expect(lookup("A rope with an iron hook")).toEqual(expect.arrayContaining(["rope"]));
		expect(lookup("A rope with an iron hook")).not.toContain("hook");
	});

	it("returns only trailing phrases from the resolved object portion", () => {
		expect(trailingObjectPhrases("The sealed parchment map of the northern coast")).toEqual([
			"sealed parchment map",
			"parchment map",
			"map",
		]);
	});

	it("uses the taxonomy to recognize an object after a quantity phrase", () => {
		expect(trailingObjectPhrases("A coil of rope", "rope")).toEqual(["rope"]);
		expect(trailingObjectPhrases("A map of the northern coast", "map")).toEqual(["map"]);
	});

	it("does not let expanded phrases crowd later aliases out of WordNet tag lookup", () => {
		const input = {
			name: "The battered leather satchel",
			aliases: ["an old travel bag", "a worn carrying case", "apple"],
			tags: [],
			iconCategory: "bag",
		};

		expect(wordNetLookupTerms(input)).toContain("apple");
		expect(wordNetLookupTerms(input)).toHaveLength(7);
	});
});
