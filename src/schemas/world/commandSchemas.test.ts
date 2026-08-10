import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {toID} from "@/utils/idUtils";
import {ConditionBranchSchema} from "./conditionBranchSchemas";
import {CommandConditionBranchSchema, CommandEffectSchema} from "./commandLogicSchemas";
import {
	BlockSchema,
	BooleanBlockSchema,
	ChoiceBlockSchema,
	ChoiceOptionSchema,
	CommandSchema,
	NumberBlockSchema,
	PatternSchema,
	PhraseBlockSchema,
	RelationBlockSchema,
	ScopeSchema,
	TargetBlockSchema,
	TextBlockSchema,
	type CommandBlock,
} from "./commandSchemas";

function phrase(matches: string[]): CommandBlock {
	return {
		...createDefaultFieldObject(PhraseBlockSchema),
		id: toID("command-block", `${matches[0]}-phrase`),
		matches,
	};
}

function target(role: string): CommandBlock {
	return {
		...createDefaultFieldObject(TargetBlockSchema),
		id: toID("command-block", `${role.toLowerCase()}-target`),
		role,
	};
}

function relation(relationType: "on" | "with"): CommandBlock {
	return {
		...createDefaultFieldObject(RelationBlockSchema),
		id: toID("command-block", `${relationType}-relation`),
		relation: relationType,
	};
}

function commandWithBlocks(blocks: CommandBlock[]) {
	return {
		...createDefaultFieldObject(CommandSchema),
		id: toID("command", "place-object"),
		name: "Place object",
		patterns: [{...createDefaultFieldObject(PatternSchema), blocks}],
		fallbacks: blocks
			.filter((block) => block.type !== "phrase" && block.type !== "relation")
			.map((block) => ({
				blockId: block.id,
				behavior: {
					...createDefaultFieldObject(CommandConditionBranchSchema),
					id: toID("condition-branch", `${block.id.id}-fallback`),
				},
			})),
		behavior: {
			...createDefaultFieldObject(ConditionBranchSchema),
			id: toID("condition-branch", "place-object-behavior"),
		},
	};
}

describe("CommandSchema", () => {
	it("parses ordered blocks with condition-branch behavior", () => {
		const command = commandWithBlocks([
			phrase(["put", "place"]),
			target("object"),
			relation("on"),
			target("destination"),
		]);

		const result = CommandSchema.parse(command);

		expect(result.behavior.id).toEqual(toID("condition-branch", "place-object-behavior"));
		expect(result.patterns[0].blocks.map((block) => block.type)).toEqual([
			"phrase",
			"target",
			"relation",
			"target",
		]);
		expect(result.fallbacks.map((fallback) => fallback.blockId)).toEqual(
			result.patterns[0].blocks
				.filter((block) => block.type !== "phrase" && block.type !== "relation")
				.map((block) => block.id),
		);
	});

	it("allows at most one fallback for each non-structural command block", () => {
		const command = commandWithBlocks([phrase(["take"]), target("object")]);
		const missingFallback = {...command, fallbacks: []};
		const duplicateFallback = {
			...command,
			fallbacks: [...command.fallbacks, command.fallbacks[0]],
		};
		const foreignFallback = {
			...command,
			fallbacks: command.fallbacks.map((fallback, index) =>
				index === 0 ? {...fallback, blockId: toID("command-block", "foreign-block")} : fallback,
			),
		};

		expect(CommandSchema.safeParse(missingFallback).success).toBe(true);
		expect(CommandSchema.safeParse(duplicateFallback).success).toBe(false);
		expect(CommandSchema.safeParse(foreignFallback).success).toBe(false);
		expect(
			CommandSchema.safeParse({
				...command,
				fallbacks: [
					...command.fallbacks,
					{...command.fallbacks[0], blockId: command.patterns[0].blocks[0].id},
				],
			}).success,
		).toBe(false);
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
			id: toID("command-block", "answer-choice"),
			role: "answer",
			choices: [accept, decline],
		};

		expect(BlockSchema.parse(choice)).toMatchObject({
			type: "choice",
			role: "answer",
			choices: [{value: "accept"}, {value: "decline"}],
		});
	});

	it("supports boolean inputs with default affirmative and negative wording", () => {
		const boolean = {
			...createDefaultFieldObject(BooleanBlockSchema),
			id: toID("command-block", "locked-boolean"),
			role: "locked",
		};

		expect(BlockSchema.parse(boolean)).toEqual({
			id: toID("command-block", "locked-boolean"),
			type: "boolean",
			role: "locked",
			trueMatches: ["yes", "yep", "yeah", "okay", "ok"],
			falseMatches: ["no", "nope", "nah"],
		});
	});

	it("rejects overlapping boolean wording after normalization", () => {
		const boolean = {
			...createDefaultFieldObject(BooleanBlockSchema),
			id: toID("command-block", "locked-boolean"),
			role: "locked",
			trueMatches: ["Turn  On"],
			falseMatches: ["turn on"],
		};

		expect(BlockSchema.safeParse(boolean).success).toBe(false);
	});

	it("supports global, layer, and room scopes", () => {
		expect(ScopeSchema.parse({scope: "global"})).toEqual({scope: "global"});
		expect(ScopeSchema.parse({scope: "layers", layers: [-1, 0, 1]})).toEqual({
			scope: "layers",
			layers: [-1, 0, 1],
		});
		expect(ScopeSchema.parse({scope: "rooms", roomIds: [toID("room", "gallery")]})).toEqual({
			scope: "rooms",
			roomIds: [toID("room", "gallery")],
		});
		expect(createDefaultFieldObject(CommandSchema).scope).toEqual({scope: "global"});
	});

	it("rejects duplicate roles within one pattern", () => {
		const pattern = {
			...createDefaultFieldObject(PatternSchema),
			blocks: [target("object"), target("Object")],
		};

		expect(PatternSchema.safeParse(pattern).success).toBe(false);
	});

	it("allows one block identity to be shared across alternative patterns", () => {
		const shared = phrase(["put"]);
		const command = {
			...commandWithBlocks([shared]),
			patterns: [
				{...createDefaultFieldObject(PatternSchema), blocks: [shared]},
				{...createDefaultFieldObject(PatternSchema), blocks: [{...shared}]},
			],
		};

		expect(CommandSchema.safeParse(command).success).toBe(true);
	});

	it("rejects conflicting definitions that share a block ID", () => {
		const first = phrase(["put"]);
		const second = {...phrase(["place"]), id: first.id};
		const command = {
			...commandWithBlocks([first]),
			patterns: [
				{...createDefaultFieldObject(PatternSchema), blocks: [first]},
				{...createDefaultFieldObject(PatternSchema), blocks: [second]},
			],
		};

		expect(CommandSchema.safeParse(command).success).toBe(false);
	});

	it("allows alternative patterns to vary structural blocks without changing their values", () => {
		const firstBlocks = [phrase(["put"]), target("first object")];
		const secondBlocks = [
			phrase(["place"]),
			target("second object"),
			relation("on"),
			phrase(["carefully"]),
		];
		const command = {
			...commandWithBlocks(firstBlocks),
			patterns: [
				{...createDefaultFieldObject(PatternSchema), blocks: firstBlocks},
				{...createDefaultFieldObject(PatternSchema), blocks: secondBlocks},
			],
			fallbacks: [...firstBlocks, ...secondBlocks]
				.filter((block) => block.type !== "phrase" && block.type !== "relation")
				.map((block) => ({
					blockId: block.id,
					behavior: {
						...createDefaultFieldObject(CommandConditionBranchSchema),
						id: toID("condition-branch", `${block.id.id}-fallback`),
					},
				})),
		};

		expect(CommandSchema.safeParse(command).success).toBe(true);
	});

	it("rejects alternative patterns with different non-structural block counts", () => {
		const firstBlocks = [phrase(["put"]), target("first object")];
		const secondBlocks = [phrase(["place"]), target("second object"), target("destination")];
		const command = {
			...commandWithBlocks(firstBlocks),
			patterns: [
				{...createDefaultFieldObject(PatternSchema), blocks: firstBlocks},
				{...createDefaultFieldObject(PatternSchema), blocks: secondBlocks},
			],
			fallbacks: [...firstBlocks, ...secondBlocks]
				.filter((block) => block.type !== "phrase" && block.type !== "relation")
				.map((block) => ({
					blockId: block.id,
					behavior: {
						...createDefaultFieldObject(CommandConditionBranchSchema),
						id: toID("condition-branch", `${block.id.id}-fallback`),
					},
				})),
		};

		const result = CommandSchema.safeParse(command);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues).toEqual(
				expect.arrayContaining([expect.objectContaining({path: ["patterns", 1, "blocks"]})]),
			);
		}
	});

	it("rejects command-variable bindings to blocks outside the command", () => {
		const command = {
			...commandWithBlocks([phrase(["say"])]),
			behavior: createDefaultFieldObject(CommandConditionBranchSchema),
		};
		command.behavior.always = {
			name: "Say result",
			id: toID("effect", "say-result"),
			type: "group",
			effects: [
				CommandEffectSchema.parse({
					type: "message",
					operation: "show",
					commandVariables: [{blockId: toID("command-block", "missing-block"), field: "message"}],
				}),
			],
			allowMultipleUsesInWorld: true,
		};

		expect(CommandSchema.safeParse(command).success).toBe(false);
	});

	it("rejects an entity variable bound to a boolean field", () => {
		const object = target("object");
		const command = CommandSchema.parse(commandWithBlocks([phrase(["mark"]), object]));
		command.behavior.always = {
			name: "Mark result",
			id: toID("effect", "mark-result"),
			type: "group",
			effects: [
				{
					type: "flag",
					"flag-type": "normal",
					operation: "set",
					flag: "marked",
					value: true,
					commandVariables: [{blockId: object.id, field: "value"}],
				},
			],
			allowMultipleUsesInWorld: true,
		};

		expect(CommandSchema.safeParse(command).success).toBe(false);
	});

	it("rejects non-number variables bound to number comparison operands", () => {
		const object = target("object");
		const command = {
			...commandWithBlocks([phrase(["compare"]), object]),
			behavior: {
				...createDefaultFieldObject(CommandConditionBranchSchema),
				if: {
					condition: {
						type: "comparison",
						valueType: "number",
						operator: "eq",
						left: {source: "literal", value: 1},
						right: {source: "literal", value: 1},
						commandVariables: [{blockId: object.id, field: "right"}],
					},
					effect: {
						name: "Compared",
						id: toID("effect", "compared"),
						type: "group",
						effects: [],
						allowMultipleUsesInWorld: true,
					},
					delayTurns: 0,
					cancelIfConditionFails: true,
				},
			},
		};

		expect(CommandSchema.safeParse(command).success).toBe(false);
	});

	it("requires a failed block to use its entered-text projection", () => {
		const object = target("object");
		const command = CommandSchema.parse(commandWithBlocks([phrase(["touch"]), object]));
		command.fallbacks[0].behavior.always = {
			name: "Missing object",
			id: toID("effect", "missing-object"),
			type: "group",
			effects: [
				{
					type: "message",
					operation: "show",
					message: "Missing target",
					commandVariables: [{blockId: object.id, field: "message"}],
				},
			],
			allowMultipleUsesInWorld: true,
		};

		expect(CommandSchema.safeParse(command).success).toBe(false);
		command.fallbacks[0].behavior.always.effects[0].commandVariables = [
			{blockId: object.id, field: "message", projection: "text"},
		];
		expect(CommandSchema.safeParse(command).success).toBe(true);
	});

	it("rejects raw entity tokens in text and accepts explicit entity projections", () => {
		const object = target("object");
		const command = CommandSchema.parse(commandWithBlocks([phrase(["inspect"]), object]));
		command.behavior.always = {
			name: "Inspect object",
			id: toID("effect", "inspect-object"),
			type: "group",
			effects: [
				{
					type: "message",
					operation: "show",
					message: `{variable ${object.id.id}}`,
				},
			],
			allowMultipleUsesInWorld: true,
		};

		expect(CommandSchema.safeParse(command).success).toBe(false);
		command.behavior.always.effects[0].message = `{variable ${object.id.id} name}`;
		expect(CommandSchema.safeParse(command).success).toBe(true);
	});

	it("requires a rest-of-input text block to be last", () => {
		const text = {
			...createDefaultFieldObject(TextBlockSchema),
			id: toID("command-block", "message-text"),
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
			id: toID("command-block", "count-number"),
			role: "count",
			min: 10,
			max: 2,
		};
		const replacementRelation = {
			...createDefaultFieldObject(RelationBlockSchema),
			id: toID("command-block", "replacement-relation"),
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
			id: toID("command-block", "selection-choice"),
			role: "selection",
			choices: [first, second],
		};

		expect(BlockSchema.safeParse(choice).success).toBe(false);
	});
});
