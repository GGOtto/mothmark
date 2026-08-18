import {
	buildTaxonomyIndex,
	compileItemLexicon,
	extractWiktionaryNounRelations,
} from "./buildItemLexicon";

const page = (requestedTerm: string, revisionId: number, nounLines: string) => ({
	requestedTerm,
	revisionId,
	content: `==English==\n===Noun===\n${nounLines}\n==French==\n===Noun===\n# [[wrong language]]`,
});

describe("item lexicon builder", () => {
	it("extracts noun synonyms and definition references without crossing languages or parts of speech", () => {
		const content = `==English==
===Noun===
# A [[bag]] or [[case]] with a strap.
#: {{syn|en|shoulder bag|schoolbag}}
===Verb===
#: {{syn|en|carry}}
==French==
===Noun===
# [[cartable]]`;

		expect(extractWiktionaryNounRelations(content)).toEqual([
			{value: "bag", relation: "reference"},
			{value: "case", relation: "reference"},
			{value: "shoulder bag", relation: "synonym"},
			{value: "schoolbag", relation: "synonym"},
		]);
	});

	it("drops vocabulary attached to unsafe senses", () => {
		const content = `==English==
===Noun===
# {{lb|en|obsolete}} A [[weapon]].
#: {{syn|en|old blade}}
# A [[knife]].`;

		expect(extractWiktionaryNounRelations(content)).toEqual([
			{value: "knife", relation: "reference"},
		]);
	});

	it("does not treat examples or contrasted objects as interchangeable references", () => {
		const content = `==English==
===Noun===
# A flexible [[container]], such as a [[backpack]] or [[pouch]].
# A covering for the foot, as opposed to [[boots]].`;

		expect(extractWiktionaryNounRelations(content)).toEqual([
			{value: "container", relation: "reference"},
		]);
	});

	it("does not promote references from subordinate specialist senses", () => {
		const content = `==English==
===Noun===
# A protective covering for the foot.
## {{lb|en|engineering}} Also called a [[slipper]].`;

		expect(extractWiktionaryNounRelations(content)).toEqual([]);
	});

	it("derives singular lookup seeds from the maintained taxonomy", () => {
		const {categoriesByTerm, seedTerms} = buildTaxonomyIndex();

		expect(seedTerms).toEqual(expect.arrayContaining(["bag", "satchel", "boot", "boots", "shoe"]));
		expect(categoriesByTerm.get("boot")).toEqual(new Set(["footwear"]));
		expect(seedTerms).toContain("atlas");
		expect(seedTerms).not.toContain("atla");
		expect(seedTerms).not.toContain("apparatu");
	});

	it("keeps only relationships corroborated by the same taxonomy category", () => {
		const lexicon = compileItemLexicon([
			page("satchel", 101, "# A [[bag]] or [[case]]."),
			page("boot", 102, "# A heavy [[shoe]] worn on the foot.\n#: {{syn|en|kick}}"),
		]);

		expect(lexicon.entries.satchel).toEqual([
			expect.objectContaining({value: "bag", relation: "reference"}),
		]);
		expect(lexicon.entries.satchel?.map(({value}) => value)).not.toContain("case");
		expect(lexicon.entries.boot).toEqual([
			expect.objectContaining({value: "shoe", relation: "reference"}),
		]);
	});

	it("does not promote non-canonical sibling identities into one another", () => {
		const lexicon = compileItemLexicon([
			page("dagger", 103, "# A short blade.\n#: {{syn|en|dirk|knife}}"),
			page("map", 104, "# A representation.\n#: {{syn|en|chart|plan}}"),
		]);

		expect(lexicon.entries.dagger?.map(({value}) => value)).toEqual(["knife"]);
		expect(lexicon.entries.map?.map(({value}) => value)).toEqual(["chart", "plan"]);
	});

	it("produces the same version and entries regardless of page order", () => {
		const pages = [page("satchel", 101, "# A [[bag]]."), page("boot", 102, "# A [[shoe]].")];

		expect(compileItemLexicon([...pages].reverse())).toEqual(compileItemLexicon(pages));
	});
});
