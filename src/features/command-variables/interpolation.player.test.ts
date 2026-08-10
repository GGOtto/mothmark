import {produce} from "immer";
import {
	BooleanBlockSchema,
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
} from "@/schemas/world/commandSchemas";
import {
	CommandConditionBranchSchema,
	CommandConditionSchema,
	CommandConditionWithEffectSchema,
	CommandEffectGroupSchema,
} from "@/schemas/world/commandLogicSchemas";
import {TextConditionSchema} from "@/schemas/world/conditionSchema";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {toID, type ID} from "@/utils/idUtils";
import {createPlayerTestScenario} from "@/engine/utils/testUtils";
import {resolveTurn} from "@/engine/player/resolveTurn";

function phrase(id: string, match: string): CommandBlock {
	return {
		...createDefaultFieldObject(PhraseBlockSchema),
		id: toID("command-block", id),
		matches: [match],
	};
}

function target(id: string): CommandBlock {
	return {
		...createDefaultFieldObject(TargetBlockSchema),
		id: toID("command-block", id),
		role: "object",
		entityTypes: ["item"],
		source: "visible",
	};
}

function number(id: string): CommandBlock {
	return {
		...createDefaultFieldObject(NumberBlockSchema),
		id: toID("command-block", id),
		role: "amount",
	};
}

function boolean(id: string): CommandBlock {
	return {
		...createDefaultFieldObject(BooleanBlockSchema),
		id: toID("command-block", id),
		role: "value",
	};
}

function text(id: string): CommandBlock {
	return {
		...createDefaultFieldObject(TextBlockSchema),
		id: toID("command-block", id),
		role: "text",
		mode: "rest",
	};
}

function relation(id: string): CommandBlock {
	return {
		...createDefaultFieldObject(RelationBlockSchema),
		id: toID("command-block", id),
		relation: "as",
	};
}

function choice(id: string): CommandBlock {
	return {
		...createDefaultFieldObject(ChoiceBlockSchema),
		id: toID("command-block", id),
		role: "style",
		choices: [
			{
				...createDefaultFieldObject(ChoiceOptionSchema),
				value: "quietly",
				label: "Quietly",
				matches: ["softly"],
			},
		],
	};
}

function messageGroup(id: string, message: string) {
	return {
		...createDefaultFieldObject(CommandEffectGroupSchema),
		id: toID("effect", `${id}-effect`),
		name: id,
		effects: [{type: "message" as const, operation: "show" as const, message}],
	};
}

function messageBranch(id: string, message: string) {
	return {
		...createDefaultFieldObject(CommandConditionBranchSchema),
		id: toID("condition-branch", `${id}-branch`),
		always: {
			name: id,
			id: toID("effect", `${id}-effect`),
			type: "group" as const,
			effects: [{type: "message", operation: "show", message}],
			allowMultipleUsesInWorld: true as const,
		},
	};
}

function commandWithTarget(
	id: string,
	verb: string,
	targetId: ID<"command-block">,
	success: string,
	fallback: string,
) {
	return CommandSchema.parse({
		...createDefaultFieldObject(CommandSchema),
		id: toID("command", id),
		name: id,
		patterns: [
			{
				...createDefaultFieldObject(PatternSchema),
				blocks: [phrase(`${id}-verb`, verb), target(targetId.id)],
			},
		],
		behavior: messageBranch(`${id}-success`, success),
		fallbacks: [{blockId: targetId, behavior: messageBranch(`${id}-fallback`, fallback)}],
	});
}

describe("command variable interpolation through the player path", () => {
	it("uses an entered number instead of a saved counter in a counter condition", () => {
		const amountId = toID("command-block", "guess-amount");
		const conditionLeaf = CommandConditionSchema.parse({
			type: "counter",
			operation: "compare",
			counter: "answer",
			operator: "eq",
			value: 3,
			commandVariables: [{blockId: amountId, field: "counter"}],
		});
		const defaultConditional = createDefaultFieldObject(CommandConditionWithEffectSchema);
		const conditional = {
			...defaultConditional,
			condition: {...defaultConditional.condition, conditions: [conditionLeaf]},
			effect: messageGroup("correct-guess", "Correct."),
		};
		const command = CommandSchema.parse({
			...createDefaultFieldObject(CommandSchema),
			id: toID("command", "guess"),
			name: "Guess",
			patterns: [
				{
					...createDefaultFieldObject(PatternSchema),
					blocks: [phrase("guess-verb", "guess"), number(amountId.id)],
				},
			],
			behavior: {
				...createDefaultFieldObject(CommandConditionBranchSchema),
				id: toID("condition-branch", "guess-branch"),
				if: conditional,
				else: messageGroup("incorrect-guess", "Try again."),
			},
		});
		const scenario = createPlayerTestScenario("navigation");
		const world = produce(scenario.world, (draft) => void (draft.commands = [command]));
		const game = produce(scenario.game, (draft) => void (draft.variables.counters = [{answer: 3}]));

		expect(resolveTurn(world, game, "guess 3").messages.at(-1)).toMatchObject({
			type: "system",
			text: "Correct.",
		});
		expect(resolveTurn(world, game, "guess 4").messages.at(-1)).toMatchObject({
			type: "system",
			text: "Try again.",
		});
	});

	it("uses an entered boolean instead of a saved flag in a flag condition", () => {
		const valueId = toID("command-block", "confirm-value");
		const conditionLeaf = CommandConditionSchema.parse({
			type: "flag",
			"flag-type": "normal",
			operation: "is",
			flag: "ready",
			value: true,
			commandVariables: [{blockId: valueId, field: "flag"}],
		});
		const defaults = createDefaultFieldObject(CommandConditionWithEffectSchema);
		const command = CommandSchema.parse({
			...createDefaultFieldObject(CommandSchema),
			id: toID("command", "confirm"),
			name: "Confirm",
			patterns: [
				{
					...createDefaultFieldObject(PatternSchema),
					blocks: [phrase("confirm-verb", "confirm"), boolean(valueId.id)],
				},
			],
			behavior: {
				...createDefaultFieldObject(CommandConditionBranchSchema),
				id: toID("condition-branch", "confirm-branch"),
				if: {
					...defaults,
					condition: {...defaults.condition, conditions: [conditionLeaf]},
					effect: messageGroup("confirmed", "Confirmed."),
				},
				else: messageGroup("not-confirmed", "Not confirmed."),
			},
		});
		const scenario = createPlayerTestScenario("navigation");
		const world = produce(scenario.world, (draft) => void (draft.commands = [command]));

		expect(resolveTurn(world, scenario.game, "confirm yes").messages.at(-1)?.text).toBe("Confirmed.");
		expect(resolveTurn(world, scenario.game, "confirm no").messages.at(-1)?.text).toBe(
			"Not confirmed.",
		);
	});

	it("uses entered text instead of saved text in a text condition", () => {
		const textId = toID("command-block", "say-text");
		const conditionLeaf = CommandConditionSchema.parse({
			type: "text",
			operation: "starts-with",
			text: "answer",
			value: "moth",
			commandVariables: [{blockId: textId, field: "text"}],
		});
		const defaults = createDefaultFieldObject(CommandConditionWithEffectSchema);
		const command = CommandSchema.parse({
			...createDefaultFieldObject(CommandSchema),
			id: toID("command", "say"),
			name: "Say",
			patterns: [
				{
					...createDefaultFieldObject(PatternSchema),
					blocks: [phrase("say-verb", "say"), text(textId.id)],
				},
			],
			behavior: {
				...createDefaultFieldObject(CommandConditionBranchSchema),
				id: toID("condition-branch", "say-branch"),
				if: {
					...defaults,
					condition: {...defaults.condition, conditions: [conditionLeaf]},
					effect: messageGroup("moth-text", "Moth text."),
				},
				else: messageGroup("other-text", "Other text."),
			},
		});
		const scenario = createPlayerTestScenario("navigation");
		const world = produce(scenario.world, (draft) => void (draft.commands = [command]));

		expect(resolveTurn(world, scenario.game, "say mothmark").messages.at(-1)?.text).toBe(
			"Moth text.",
		);
		expect(resolveTurn(world, scenario.game, "say beetle").messages.at(-1)?.text).toBe("Other text.");
	});

	it("sets a flag from a boolean command value", () => {
		const valueId = toID("command-block", "mark-ready-value");
		const command = CommandSchema.parse({
			...createDefaultFieldObject(CommandSchema),
			id: toID("command", "mark-ready"),
			name: "Mark ready",
			patterns: [
				{
					...createDefaultFieldObject(PatternSchema),
					blocks: [phrase("mark-ready-verb", "mark ready"), boolean(valueId.id)],
				},
			],
			behavior: {
				...createDefaultFieldObject(CommandConditionBranchSchema),
				id: toID("condition-branch", "mark-ready-branch"),
				always: {
					...messageGroup("mark-ready", "Recorded."),
					effects: [
						{
							type: "flag",
							"flag-type": "normal",
							operation: "set",
							flag: "ready",
							value: true,
							commandVariables: [{blockId: valueId, field: "value"}],
						},
					],
				},
			},
		});
		const scenario = createPlayerTestScenario("navigation");
		const world = produce(scenario.world, (draft) => void (draft.commands = [command]));

		expect(resolveTurn(world, scenario.game, "mark ready yes").variables.flags).toContainEqual({
			ready: true,
		});
		expect(resolveTurn(world, scenario.game, "mark ready no").variables.flags).toContainEqual({
			ready: false,
		});
	});

	it("uses raw text from structural and choice blocks in text conditions and effects", () => {
		const verbId = toID("command-block", "record-verb");
		const relationId = toID("command-block", "record-relation");
		const styleId = toID("command-block", "record-style");
		const rawCommand = `{variable ${verbId.id} text} {variable ${relationId.id} text} {variable ${styleId.id} text}`;
		const condition = CommandConditionSchema.parse({
			...createDefaultFieldObject(TextConditionSchema),
			type: "text",
			operation: "is",
			text: "expected-command",
			value: rawCommand,
		});
		const defaults = createDefaultFieldObject(CommandConditionWithEffectSchema);
		const command = CommandSchema.parse({
			...createDefaultFieldObject(CommandSchema),
			id: toID("command", "record-style"),
			name: "Record style",
			patterns: [
				{
					...createDefaultFieldObject(PatternSchema),
					blocks: [phrase(verbId.id, "record"), relation(relationId.id), choice(styleId.id)],
				},
			],
			behavior: {
				...createDefaultFieldObject(CommandConditionBranchSchema),
				id: toID("condition-branch", "record-style-branch"),
				if: {
					...defaults,
					condition: {...defaults.condition, conditions: [condition]},
					effect: {
						...messageGroup("record-style", "Matched raw text."),
						effects: [
							{type: "text", operation: "set", text: "last-command", value: rawCommand},
							{type: "message", operation: "show", message: "Matched raw text."},
						],
					},
				},
			},
		});
		const scenario = createPlayerTestScenario("navigation");
		const world = produce(scenario.world, (draft) => void (draft.commands = [command]));
		const game = produce(scenario.game, (draft) => {
			draft.variables.texts = [{"expected-command": "record as softly"}];
		});

		const nextGame = resolveTurn(world, game, "record as softly");

		expect(nextGame.messages.at(-1)?.text).toBe("Matched raw text.");
		expect(nextGame.variables.texts).toContainEqual({"last-command": "record as softly"});
	});

	it("shows current entity name and description projections after a successful match", () => {
		const targetId = toID("command-block", "inspect-target");
		const command = commandWithTarget(
			"inspect",
			"inspect",
			targetId,
			`{variable ${targetId.id} name}: {variable ${targetId.id} description}`,
			"Missing.",
		);
		const scenario = createPlayerTestScenario("navigation");
		const world = produce(scenario.world, (draft) => void (draft.commands = [command]));
		const game = produce(scenario.game, (draft) => {
			const bell = draft.itemStates[0];
			bell.name = "Polished Bell";
			bell.description = "Its newly polished surface catches the light.";
		});

		const nextGame = resolveTurn(world, game, "inspect bell");

		expect(nextGame.messages.at(-1)).toMatchObject({
			type: "system",
			text: "Polished Bell: Its newly polished surface catches the light.",
		});
	});

	it("lets a fallback echo the failed block's entered text without resolving an entity", () => {
		const targetId = toID("command-block", "touch-target");
		const command = commandWithTarget(
			"touch",
			"touch",
			targetId,
			"Touched.",
			`You cannot find “{variable ${targetId.id} text}.”`,
		);
		const scenario = createPlayerTestScenario("navigation");
		const world = produce(scenario.world, (draft) => void (draft.commands = [command]));

		const nextGame = resolveTurn(world, scenario.game, "touch silver   skull");

		expect(nextGame.messages.at(-1)).toMatchObject({
			type: "system",
			text: "You cannot find “silver   skull.”",
		});
		expect(nextGame.variables.command).toEqual([]);
	});
});
