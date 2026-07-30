import {CommandVariableSchema, type CommandVariable} from "@/schemas/states/gameStateSchemas";
import {
	BooleanBlockSchema,
	ChoiceBlockSchema,
	ChoiceOptionSchema,
	DirectionBlockSchema,
	NumberBlockSchema,
	PhraseBlockSchema,
	RelationBlockSchema,
	TargetBlockSchema,
	TextBlockSchema,
	type CommandBlock,
} from "@/schemas/world/commandSchemas";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {toID} from "@/utils/idUtils";
import {matchBlock, matchNumber, type TargetMatchCandidate} from "./blocks";

type NumberBlock = Extract<CommandBlock, {type: "number"}>;

function numberBlock(overrides: Partial<NumberBlock> = {}): NumberBlock {
	return {
		...createDefaultFieldObject(NumberBlockSchema),
		id: toID("command-block", "amount"),
		role: "amount",
		...overrides,
	};
}

function expectVariable(actual: CommandVariable | undefined, expected: CommandVariable) {
	expect(CommandVariableSchema.parse(actual)).toEqual(expected);
}

describe("matchNumber", () => {
	it("only matches number blocks", () => {
		const phraseBlock = {
			...createDefaultFieldObject(PhraseBlockSchema),
			id: toID("command-block", "three-phrase"),
			matches: ["three"],
		};

		expect(matchNumber("3", phraseBlock)).toBeUndefined();
	});

	it("resolves integers without accepting other JavaScript number syntax", () => {
		const block = numberBlock();

		expect(matchNumber("42", block)?.value).toBe(42);
		expect(matchNumber("-7", block)?.value).toBe(-7);
		expect(matchNumber("  +12  ", block)?.value).toBe(12);
		expect(matchNumber("7.0", block)?.value).toBe(7);
		expect(matchNumber("1.5", block)).toBeUndefined();
		expect(matchNumber("1e3", block)).toBeUndefined();
		expect(matchNumber("0xff", block)).toBeUndefined();
		expect(matchNumber("", block)).toBeUndefined();
	});

	it("resolves digit and written decimals", () => {
		const block = numberBlock({numberType: "decimal"});

		expect(matchNumber("4", block)?.value).toBe(4);
		expect(matchNumber(".75", block)?.value).toBe(0.75);
		expect(matchNumber("-2.5", block)?.value).toBe(-2.5);
		expect(matchNumber("three point five", block)?.value).toBe(3.5);
	});

	it("resolves written integers when allowed", () => {
		const block = numberBlock();

		expect(matchNumber("Three", block)?.value).toBe(3);
		expect(matchNumber("twenty-one", block)?.value).toBe(21);
		expect(matchNumber("one hundred and five", block)?.value).toBe(105);
		expect(matchNumber("two thousand", block)?.value).toBe(2_000);
		expect(matchNumber("twenty ten", block)).toBeUndefined();
	});

	it("rejects written numbers when they are disabled", () => {
		const block = numberBlock({allowWords: false});

		expect(matchNumber("three", block)).toBeUndefined();
		expect(matchNumber("3", block)?.value).toBe(3);
	});

	it("applies inclusive minimum and maximum bounds", () => {
		const block = numberBlock({min: 2, max: 4});

		expect(matchNumber("1", block)).toBeUndefined();
		expect(matchNumber("2", block)?.value).toBe(2);
		expect(matchNumber("four", block)?.value).toBe(4);
		expect(matchNumber("5", block)).toBeUndefined();
	});
});

describe("matchBlock", () => {
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
		expect(matchBlock("east", block)).toBeUndefined();
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
	});

	it("resolves target candidates to typed entity references", () => {
		const block = {
			...createDefaultFieldObject(TargetBlockSchema),
			id: toID("command-block", "target"),
			role: "target",
			entityTypes: ["feature" as const],
			tags: ["openable"],
			tagMode: "all" as const,
			source: "visible" as const,
		};
		const door = toID("feature", "door");
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
				reference: toID("feature", "north-door"),
				name: "Door",
				sources: ["visible"],
			},
			{
				reference: toID("feature", "south-door"),
				name: "Door",
				sources: ["visible"],
			},
		];

		expect(matchBlock("door", block, {targets})).toBeUndefined();
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
		expect(matchBlock("Hello There", block)).toBeUndefined();
	});

	it("returns undefined for a non-match", () => {
		const block = {
			...createDefaultFieldObject(PhraseBlockSchema),
			id: toID("command-block", "verb"),
			matches: ["take"],
		};

		expect(matchBlock("drop", block)).toBeUndefined();
	});
});
