import {CommandVariableSchema, type CommandVariable} from "@/schemas/states/gameStateSchemas";
import {
	BooleanBlockSchema,
	ChoiceBlockSchema,
	ChoiceOptionSchema,
	DirectionBlockSchema,
	NumberBlockSchema,
	PhraseBlockSchema,
	RELATION_PREPOSITIONS,
	RelationBlockSchema,
	RelationTypeSchema,
	TargetBlockSchema,
	TextBlockSchema,
	type CommandBlock,
} from "@/schemas/world/commandSchemas";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {toID} from "@/utils/idUtils";
import {
	matchBlock,
	matchNumber,
	type BlockMatchResponse,
	type TargetMatchCandidate,
} from "./blocks";

type NumberBlock = Extract<CommandBlock, {type: "number"}>;

function numberBlock(overrides: Partial<NumberBlock> = {}): NumberBlock {
	return {
		...createDefaultFieldObject(NumberBlockSchema),
		id: toID("command-block", "amount"),
		role: "amount",
		...overrides,
	};
}

function expectVariable(actual: BlockMatchResponse, expected: CommandVariable) {
	expect(actual.match).toBe("match");
	expect(CommandVariableSchema.parse(actual.command)).toEqual(expected);
}

const partialMatch = {command: null, match: "partial match"};
const failedMatch = {command: null, match: "fail"};

describe("matchNumber", () => {
	it("only matches number blocks", () => {
		const phraseBlock = {
			...createDefaultFieldObject(PhraseBlockSchema),
			id: toID("command-block", "three-phrase"),
			matches: ["three"],
		};

		expect(matchNumber("3", phraseBlock)).toEqual(failedMatch);
	});

	it("resolves integers without accepting other JavaScript number syntax", () => {
		const block = numberBlock();

		expect(matchNumber("42", block).command?.value).toBe(42);
		expect(matchNumber("-7", block).command?.value).toBe(-7);
		expect(matchNumber("  +12  ", block).command?.value).toBe(12);
		expect(matchNumber("1,234", block).command?.value).toBe(1_234);
		expect(matchNumber("7.0", block).command?.value).toBe(7);
		expect(matchNumber("1.5", block)).toEqual(partialMatch);
		expect(matchNumber("12,34", block)).toEqual(partialMatch);
		expect(matchNumber("1e3", block)).toEqual(partialMatch);
		expect(matchNumber("0xff", block)).toEqual(partialMatch);
		expect(matchNumber("", block)).toEqual(partialMatch);
	});

	it("resolves digit and written decimals", () => {
		const block = numberBlock({numberType: "decimal"});

		expect(matchNumber("4", block).command?.value).toBe(4);
		expect(matchNumber(".75", block).command?.value).toBe(0.75);
		expect(matchNumber("-2.5", block).command?.value).toBe(-2.5);
		expect(matchNumber("three point five", block).command?.value).toBe(3.5);
		expect(matchNumber("the number 3.5", block).command?.value).toBe(3.5);
		expect(matchNumber("number three point five", block).command?.value).toBe(3.5);
		expect(matchNumber("point five", block).command?.value).toBe(0.5);
		expect(matchNumber("three point 5", block).command?.value).toBe(3.5);
	});

	it("resolves written integers when allowed", () => {
		const block = numberBlock();

		expect(matchNumber("Three", block).command?.value).toBe(3);
		expect(matchNumber("twenty-one", block).command?.value).toBe(21);
		expect(matchNumber("one hundred and five", block).command?.value).toBe(105);
		expect(matchNumber("two thousand", block).command?.value).toBe(2_000);
		expect(matchNumber("two thousand and five", block).command?.value).toBe(2_005);
		expect(matchNumber("negative 3", block).command?.value).toBe(-3);
		expect(matchNumber("twenty ten", block)).toEqual(partialMatch);
	});

	it.each([
		["3", 3],
		["three", 3],
		["number 3", 3],
		["number three", 3],
		["the number 3", 3],
		["the number three", 3],
		["the number negative three", -3],
	])("resolves the natural number form %j", (text, expected) => {
		expect(matchNumber(text, numberBlock()).command?.value).toBe(expected);
	});

	it.each([
		"number",
		"the number",
		"the number number three",
		"the number negative -3",
		"three things",
	])("rejects malformed number wording %j", (text) => {
		expect(matchNumber(text, numberBlock())).toEqual(partialMatch);
	});

	it("rejects written numbers when they are disabled", () => {
		const block = numberBlock({allowWords: false});

		expect(matchNumber("three", block)).toEqual(partialMatch);
		expect(matchNumber("the number three", block)).toEqual(partialMatch);
		expect(matchNumber("3", block).command?.value).toBe(3);
		expect(matchNumber("the number 3", block).command?.value).toBe(3);
	});

	it("applies inclusive minimum and maximum bounds", () => {
		const block = numberBlock({min: 2, max: 4});

		expect(matchNumber("1", block)).toEqual(partialMatch);
		expect(matchNumber("2", block).command?.value).toBe(2);
		expect(matchNumber("four", block).command?.value).toBe(4);
		expect(matchNumber("5", block)).toEqual(partialMatch);
	});
});

describe("matchBlock", () => {
	it("supplies a complete preposition list for every relation", () => {
		for (const relation of RelationTypeSchema.options) {
			const prepositions = RELATION_PREPOSITIONS[relation];
			expect(prepositions.length).toBeGreaterThan(0);
			expect(prepositions).toContain(relation);
			expect(new Set(prepositions).size).toBe(prepositions.length);

			const block = {
				...createDefaultFieldObject(RelationBlockSchema),
				id: toID("command-block", `${relation}-relation`),
				relation,
				role: "relation",
			};
			for (const preposition of prepositions) {
				expectVariable(matchBlock(preposition, block), {
					blockId: block.id,
					type: "relation",
					value: relation,
				});
			}
		}
	});

	it("resolves a phrase to its canonical authored match", () => {
		const block = {
			...createDefaultFieldObject(PhraseBlockSchema),
			id: toID("command-block", "verb"),
			matches: ["Take", "pick up"],
		};

		expectVariable(matchBlock("  TAKE ", block), {
			blockId: block.id,
			type: "phrase",
			value: "Take",
		});
	});

	it("resolves a number", () => {
		const block = numberBlock();

		expectVariable(matchBlock("three", block), {
			blockId: block.id,
			type: "number",
			value: 3,
		});
	});

	it("resolves boolean wording", () => {
		const block = {
			...createDefaultFieldObject(BooleanBlockSchema),
			id: toID("command-block", "confirmed"),
			role: "confirmed",
			trueMatches: ["yes", "absolutely"],
			falseMatches: ["no", "never"],
		};

		expectVariable(matchBlock("Absolutely", block), {
			blockId: block.id,
			type: "boolean",
			value: true,
		});
		expectVariable(matchBlock("never", block), {
			blockId: block.id,
			type: "boolean",
			value: false,
		});
		expect(matchBlock("maybe", block)).toEqual(partialMatch);
	});

	it("resolves a choice to its stable value", () => {
		const option = {
			...createDefaultFieldObject(ChoiceOptionSchema),
			value: "carefully",
			label: "Carefully",
			matches: ["carefully", "with care"],
		};
		const block = {
			...createDefaultFieldObject(ChoiceBlockSchema),
			id: toID("command-block", "method"),
			role: "method",
			choices: [option],
		};

		expectVariable(matchBlock("with care", block), {
			blockId: block.id,
			type: "choice",
			value: "carefully",
		});
		expect(matchBlock("recklessly", block)).toEqual(partialMatch);
	});

	it("resolves and restricts canonical directions", () => {
		const block = {
			...createDefaultFieldObject(DirectionBlockSchema),
			id: toID("command-block", "direction"),
			role: "direction",
			allowed: ["n", "s"] as Array<"n" | "s">,
		};

		expectVariable(matchBlock("North", block), {
			blockId: block.id,
			type: "direction",
			value: "n",
		});
		expect(matchBlock("east", block)).toEqual(partialMatch);
	});

	it("resolves relation aliases to the authored relation", () => {
		const block = {
			...createDefaultFieldObject(RelationBlockSchema),
			id: toID("command-block", "relation"),
			relation: "with" as const,
			aliasMode: "extend" as const,
			aliases: ["using"],
			role: "relation",
		};

		expectVariable(matchBlock("using", block), {
			blockId: block.id,
			type: "relation",
			value: "with",
		});
		expect(matchBlock("near", block)).toEqual(failedMatch);
	});

	it("supplies prepositions for the authored relation", () => {
		const block = {
			...createDefaultFieldObject(RelationBlockSchema),
			id: toID("command-block", "relation"),
			relation: "in" as const,
			role: "relation",
		};

		for (const preposition of ["in", "into", "inside"]) {
			expectVariable(matchBlock(preposition, block), {
				blockId: block.id,
				type: "relation",
				value: "in",
			});
		}
		expect(matchBlock("onto", block)).toEqual(failedMatch);
	});

	it("does not supply prepositions when custom wording replaces the defaults", () => {
		const block = {
			...createDefaultFieldObject(RelationBlockSchema),
			id: toID("command-block", "relation"),
			relation: "in" as const,
			aliasMode: "replace" as const,
			aliases: ["within"],
			role: "relation",
		};

		expect(matchBlock("into", block)).toEqual(failedMatch);
		expectVariable(matchBlock("within", block), {
			blockId: block.id,
			type: "relation",
			value: "in",
		});
	});

	it("resolves target candidates to typed entity references", () => {
		const block = {
			...createDefaultFieldObject(TargetBlockSchema),
			id: toID("command-block", "target"),
			role: "target",
			entityTypes: ["item" as const],
			tags: ["openable"],
			tagMode: "all" as const,
			source: "visible" as const,
		};
		const door = toID("item", "door");
		const targets: TargetMatchCandidate[] = [
			{
				reference: door,
				name: "Iron door",
				aliases: ["door"],
				tags: ["openable"],
				sources: ["visible", "reachable", "current-room"],
			},
			{
				reference: toID("room", "vault"),
				name: "Vault",
				tags: ["openable"],
				sources: ["visible"],
			},
		];

		expectVariable(matchBlock("door", block, {targets}), {
			blockId: block.id,
			type: "target",
			value: door,
		});
	});

	it("does not resolve an ambiguous target", () => {
		const block = {
			...createDefaultFieldObject(TargetBlockSchema),
			id: toID("command-block", "target"),
			role: "target",
			source: "any" as const,
		};
		const targets: TargetMatchCandidate[] = [
			{
				reference: toID("item", "north-door"),
				name: "Door",
				sources: ["visible"],
			},
			{
				reference: toID("item", "south-door"),
				name: "Door",
				sources: ["visible"],
			},
		];

		expect(matchBlock("door", block, {targets})).toEqual(partialMatch);
	});

	it("resolves text while preserving player casing", () => {
		const block = {
			...createDefaultFieldObject(TextBlockSchema),
			id: toID("command-block", "message"),
			role: "message",
			mode: "quoted" as const,
			minLength: 2,
		};

		expectVariable(matchBlock('"Hello There"', block), {
			blockId: block.id,
			type: "text",
			value: "Hello There",
		});
		expect(matchBlock("Hello There", block)).toEqual(partialMatch);
	});

	it("returns a typed failure for a fixed-syntax non-match", () => {
		const block = {
			...createDefaultFieldObject(PhraseBlockSchema),
			id: toID("command-block", "verb"),
			matches: ["take"],
		};

		expect(matchBlock("drop", block)).toEqual(failedMatch);
	});
});
