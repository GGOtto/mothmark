import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {toID} from "@/utils/idUtils";
import {DefaultConditionGroup, CurrentRoomConditionSchema} from "./conditionSchema";
import {ConditionBranchSchema} from "./conditionBranchSchemas";
import {
	BlockSchema,
	ChoiceBlockSchema,
	ChoiceOptionSchema,
	CommandSchema,
	NumberBlockSchema,
	PatternSchema,
	PhraseBlockSchema,
	RelationBlockSchema,
	TargetBlockSchema,
	TextBlockSchema,
	type CommandBlock,
} from "./commandSchemas";

function phrase(matches: string[]): CommandBlock {
	return {...createDefaultFieldObject(PhraseBlockSchema), matches};
}

function target(role: string): CommandBlock {
	return {...createDefaultFieldObject(TargetBlockSchema), role};
}

function relation(relationType: "on" | "with"): CommandBlock {
	return {...createDefaultFieldObject(RelationBlockSchema), relation: relationType};
}

function commandWithBlocks(blocks: CommandBlock[]) {
	return {
		...createDefaultFieldObject(CommandSchema),
		id: toID("command", "place-object"),
		name: "Place object",
		patterns: [{...createDefaultFieldObject(PatternSchema), blocks}],
		behavior: {
			...createDefaultFieldObject(ConditionBranchSchema),
			id: toID("condition-branch", "place-object-behavior"),
		},
	};
}

describe("CommandSchema", () => {
	it("parses ordered blocks and condition-based availability", () => {
		const roomCondition = {
			...createDefaultFieldObject(CurrentRoomConditionSchema),
			roomId: toID("room", "gallery"),
		};
		const command = commandWithBlocks([
			phrase(["put", "place"]),
			target("object"),
			relation("on"),
			target("destination"),
		]);
		command.availableWhen = {
			...DefaultConditionGroup,
			conditions: [roomCondition],
		};

		const result = CommandSchema.parse(command);

		expect(result.availableWhen.conditions).toEqual([roomCondition]);
		expect(result.patterns[0].blocks.map((block) => block.type)).toEqual([
			"phrase",
			"target",
			"relation",
			"target",
		]);
	});

	it("supports arbitrary semantic choices instead of fixed positive and negative fields", () => {
		const accept = {
			...createDefaultFieldObject(ChoiceOptionSchema),
			value: "accept",
			label: "Accept",
			matches: ["yes", "I agree"],
		};
		const decline = {
			...createDefaultFieldObject(ChoiceOptionSchema),
			value: "decline",
			label: "Decline",
			matches: ["no", "I refuse"],
		};
		const choice = {
			...createDefaultFieldObject(ChoiceBlockSchema),
			role: "answer",
			choices: [accept, decline],
		};

		expect(BlockSchema.parse(choice)).toMatchObject({
			type: "choice",
			role: "answer",
			choices: [{value: "accept"}, {value: "decline"}],
		});
	});

	it("rejects duplicate roles within one pattern", () => {
		const pattern = {
			...createDefaultFieldObject(PatternSchema),
			blocks: [target("object"), target("Object")],
		};

		expect(PatternSchema.safeParse(pattern).success).toBe(false);
	});

	it("requires a rest-of-input text block to be last", () => {
		const text = {
			...createDefaultFieldObject(TextBlockSchema),
			role: "message",
			mode: "rest" as const,
		};
		const pattern = {
			...createDefaultFieldObject(PatternSchema),
			blocks: [text, phrase(["to"]), target("recipient")],
		};

		expect(PatternSchema.safeParse(pattern).success).toBe(false);
	});

	it("validates block-specific ranges and replacement wording", () => {
		const number = {
			...createDefaultFieldObject(NumberBlockSchema),
			role: "count",
			min: 10,
			max: 2,
		};
		const replacementRelation = {
			...createDefaultFieldObject(RelationBlockSchema),
			aliasMode: "replace" as const,
			aliases: [],
		};

		expect(BlockSchema.safeParse(number).success).toBe(false);
		expect(BlockSchema.safeParse(replacementRelation).success).toBe(false);
	});

	it("rejects normalized duplicate choice wording", () => {
		const first = {
			...createDefaultFieldObject(ChoiceOptionSchema),
			value: "first",
			label: "First",
			matches: ["Pick  Up"],
		};
		const second = {
			...createDefaultFieldObject(ChoiceOptionSchema),
			value: "second",
			label: "Second",
			matches: ["pick up"],
		};
		const choice = {
			...createDefaultFieldObject(ChoiceBlockSchema),
			role: "selection",
			choices: [first, second],
		};

		expect(BlockSchema.safeParse(choice).success).toBe(false);
	});
});
