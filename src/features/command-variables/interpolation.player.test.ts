import {produce} from "immer";
import {
	CommandSchema,
	NumberBlockSchema,
	PatternSchema,
	PhraseBlockSchema,
	TargetBlockSchema,
	type CommandBlock,
} from "@/schemas/world/commandSchemas";
import {
	CommandConditionBranchSchema,
	CommandConditionSchema,
	CommandConditionWithEffectSchema,
	CommandEffectGroupSchema,
} from "@/schemas/world/commandLogicSchemas";
import {CounterConditionSchema} from "@/schemas/world/conditionSchema";
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
	it("uses an entered number in a command condition", () => {
		const amountId = toID("command-block", "guess-amount");
		const conditionLeaf = CommandConditionSchema.parse({
			...createDefaultFieldObject(CounterConditionSchema),
			type: "counter",
			operation: "compare",
			counter: "answer",
			operator: "eq",
			value: -1,
			commandVariables: [{blockId: amountId, field: "value"}],
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
