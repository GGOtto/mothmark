import {produce} from "immer";
import {z} from "zod";
import {GameStateSchema} from "@/schemas/states/gameStateSchemas";
import {ConditionSchema} from "@/schemas/world/conditionSchema";
import {
	CommandConditionBranchSchema,
	CommandConditionSchema,
	CommandEffectGroupSchema,
	CommandEffectSchema,
} from "@/schemas/world/commandLogicSchemas";
import {EffectSchema} from "@/schemas/world/effectSchema";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {toID} from "@/utils/idUtils";
import {createPlayerTestScenario} from "../utils/testUtils";
import {
	resolveCommandCondition,
	resolveCommandConditionBranchWithResult,
	resolveCommandEffect,
	resolveCommandTemplate,
} from "./resolveCommandLogic";

const amountBlockId = toID("command-block", "amount-block");
const otherAmountBlockId = toID("command-block", "other-amount-block");
const messageBlockId = toID("command-block", "message-block");
const booleanBlockId = toID("command-block", "boolean-block");
const choiceBlockId = toID("command-block", "choice-block");

function gameWithCommandVariables() {
	return produce(createDefaultFieldObject(GameStateSchema), (draft) => {
		draft.variables.counters = [{count: 10}];
		draft.variables.command = [
			{blockId: amountBlockId, type: "number", value: 3},
			{blockId: otherAmountBlockId, type: "number", value: 7},
			{blockId: messageBlockId, type: "text", value: "Resolved message"},
			{blockId: booleanBlockId, type: "boolean", value: false, rawText: "no"},
			{blockId: choiceBlockId, type: "choice", value: "formal", rawText: "properly"},
		];
	});
}

describe("command logic schemas", () => {
	it("preserves command bindings only in command templates", () => {
		const commandVariables = [{blockId: amountBlockId, field: "value"}];
		const condition = {
			type: "counter" as const,
			operation: "compare" as const,
			counter: "count",
			operator: "gt" as const,
			value: 0,
			commandVariables,
		};
		const effect = {
			type: "counter" as const,
			operation: "set" as const,
			counter: "count",
			value: 0,
			commandVariables,
		};

		expect(CommandConditionSchema.parse(condition).commandVariables).toEqual(commandVariables);
		expect(CommandEffectSchema.parse(effect).commandVariables).toEqual(commandVariables);
		expect(ConditionSchema.parse(condition)).not.toHaveProperty("commandVariables");
		expect(EffectSchema.parse(effect)).not.toHaveProperty("commandVariables");
	});

	it("rejects duplicate or structural field bindings", () => {
		expect(
			CommandEffectSchema.safeParse({
				type: "counter",
				operation: "set",
				commandVariables: [
					{blockId: amountBlockId, field: "value"},
					{blockId: otherAmountBlockId, field: "value"},
				],
			}).success,
		).toBe(false);
		expect(
			CommandEffectSchema.safeParse({
				type: "counter",
				operation: "set",
				commandVariables: [{blockId: amountBlockId, field: "operation"}],
			}).success,
		).toBe(false);
	});

	it("does not require command registry entries for future canonical types", () => {
		const futureEffectTemplate = CommandEffectSchema.parse({
			type: "future-effect",
			operation: "set-strength",
			commandVariables: [{blockId: amountBlockId, field: "strength"}],
		});
		const FutureEffectSchema = z.object({
			type: z.literal("future-effect"),
			operation: z.literal("set-strength"),
			strength: z.number(),
		});

		expect(
			resolveCommandTemplate(gameWithCommandVariables(), futureEffectTemplate, FutureEffectSchema),
		).toEqual({type: "future-effect", operation: "set-strength", strength: 3});

		const futureConditionTemplate = CommandConditionSchema.parse({
			type: "future-condition",
			operation: "has-strength",
			commandVariables: [{blockId: amountBlockId, field: "strength"}],
		});
		const FutureConditionSchema = z.object({
			type: z.literal("future-condition"),
			operation: z.literal("has-strength"),
			strength: z.number(),
		});

		expect(
			resolveCommandTemplate(
				gameWithCommandVariables(),
				futureConditionTemplate,
				FutureConditionSchema,
			),
		).toEqual({type: "future-condition", operation: "has-strength", strength: 3});
	});
});

describe("resolveCommandCondition", () => {
	it("fills an optional normal-condition value from a command variable", () => {
		const condition = CommandConditionSchema.parse({
			type: "counter",
			operation: "compare",
			counter: "count",
			operator: "gt",
			commandVariables: [{blockId: amountBlockId, field: "value"}],
		});

		expect(resolveCommandCondition(gameWithCommandVariables(), condition)).toEqual({
			type: "counter",
			operation: "compare",
			counter: "count",
			operator: "gt",
			value: 3,
		});
	});

	it("resolves variables on both sides of a comparison", () => {
		const condition = CommandConditionSchema.parse({
			type: "comparison",
			valueType: "number",
			operator: "lt",
			commandVariables: [
				{blockId: amountBlockId, field: "left"},
				{blockId: otherAmountBlockId, field: "right"},
			],
		});

		expect(resolveCommandCondition(gameWithCommandVariables(), condition)).toEqual({
			type: "group",
			operation: "all",
			conditions: [],
		});
	});

	it("fills a flag expectation from a boolean command variable", () => {
		const condition = CommandConditionSchema.parse({
			type: "flag",
			"flag-type": "normal",
			operation: "is",
			flag: "ready",
			value: true,
			commandVariables: [{blockId: booleanBlockId, field: "value"}],
		});
		const game = produce(gameWithCommandVariables(), (draft) => {
			draft.variables.flags = [{ready: false}];
		});

		expect(resolveCommandCondition(game, condition)).toEqual({
			type: "flag",
			"flag-type": "normal",
			operation: "is",
			flag: "ready",
			value: false,
		});
	});

	it("compares a number command value where a saved counter can be selected", () => {
		const condition = CommandConditionSchema.parse({
			type: "counter",
			operation: "compare",
			counter: "count",
			operator: "eq",
			value: 3,
			commandVariables: [{blockId: amountBlockId, field: "counter"}],
		});

		expect(resolveCommandCondition(gameWithCommandVariables(), condition)).toEqual({
			type: "group",
			operation: "all",
			conditions: [],
		});
	});

	it("compares a boolean command value where a saved flag can be selected", () => {
		const condition = CommandConditionSchema.parse({
			type: "flag",
			"flag-type": "normal",
			operation: "is",
			flag: "ready",
			value: false,
			commandVariables: [{blockId: booleanBlockId, field: "flag"}],
		});

		expect(resolveCommandCondition(gameWithCommandVariables(), condition)).toEqual({
			type: "group",
			operation: "all",
			conditions: [],
		});
	});

	it("compares a text command value where saved text can be selected", () => {
		const condition = CommandConditionSchema.parse({
			type: "text",
			operation: "contains",
			text: "saved-text",
			value: "message",
			commandVariables: [{blockId: messageBlockId, field: "text"}],
		});

		expect(resolveCommandCondition(gameWithCommandVariables(), condition)).toEqual({
			type: "group",
			operation: "all",
			conditions: [],
		});
	});

	it("interpolates a choice block's raw text into a text condition", () => {
		const condition = CommandConditionSchema.parse({
			type: "text",
			operation: "is",
			text: "tone",
			value: `{variable ${choiceBlockId.id} text}`,
		});

		expect(resolveCommandCondition(gameWithCommandVariables(), condition)).toEqual({
			type: "text",
			operation: "is",
			text: "tone",
			value: "properly",
		});
	});

	it("resolves counters and command variables on opposite sides", () => {
		const condition = CommandConditionSchema.parse({
			type: "comparison",
			valueType: "number",
			operator: "gt",
			left: {source: "counter", counter: "count"},
			commandVariables: [{blockId: otherAmountBlockId, field: "right"}],
		});

		expect(resolveCommandCondition(gameWithCommandVariables(), condition)).toEqual({
			type: "group",
			operation: "all",
			conditions: [],
		});
	});

	it("fails closed when a required value has no authored or command value", () => {
		const condition = CommandConditionSchema.parse({
			type: "counter",
			operation: "compare",
			counter: "count",
			operator: "gt",
		});

		expect(resolveCommandCondition(gameWithCommandVariables(), condition)).toEqual({
			type: "group",
			operation: "any",
			conditions: [],
		});
	});

	it("fails the whole condition when an unresolved child is nested under none", () => {
		const condition = CommandConditionSchema.parse({
			type: "group",
			operation: "none",
			conditions: [{type: "counter", operation: "compare", counter: "count", operator: "gt"}],
		});

		expect(resolveCommandCondition(gameWithCommandVariables(), condition)).toEqual({
			type: "group",
			operation: "any",
			conditions: [],
		});
	});
});

describe("resolveCommandEffect", () => {
	it("fills an optional effect value from a command variable", () => {
		const effect = CommandEffectSchema.parse({
			type: "message",
			operation: "show",
			commandVariables: [{blockId: messageBlockId, field: "message"}],
		});

		expect(resolveCommandEffect(gameWithCommandVariables(), effect)).toEqual({
			type: "message",
			operation: "show",
			message: "Resolved message",
		});
	});

	it("uses the authored value when the command variable is unavailable", () => {
		const effect = CommandEffectSchema.parse({
			type: "message",
			operation: "show",
			message: "Fallback message",
			commandVariables: [{blockId: toID("command-block", "missing-block"), field: "message"}],
		});

		expect(resolveCommandEffect(gameWithCommandVariables(), effect)).toMatchObject({
			message: "Fallback message",
		});
	});

	it("skips an effect with no safe resolved value", () => {
		const effect = CommandEffectSchema.parse({type: "message", operation: "show"});

		expect(resolveCommandEffect(gameWithCommandVariables(), effect)).toBeUndefined();
	});
});

describe("resolveCommandConditionBranchWithResult", () => {
	it("runs resolved effects and clears command variables after the branch", () => {
		const scenario = createPlayerTestScenario("navigation");
		const game = produce(scenario.game, (draft) => {
			draft.variables.command = [{blockId: messageBlockId, type: "text", value: "Resolved message"}];
		});
		const group = {
			...createDefaultFieldObject(CommandEffectGroupSchema),
			id: toID("effect", "command-message"),
			name: "Command message",
			effects: [
				CommandEffectSchema.parse({
					type: "message",
					operation: "show",
					commandVariables: [{blockId: messageBlockId, field: "message"}],
				}),
			],
		};
		const branch = CommandConditionBranchSchema.parse({
			...createDefaultFieldObject(CommandConditionBranchSchema),
			id: toID("condition-branch", "command-branch"),
			always: group,
		});

		const result = resolveCommandConditionBranchWithResult(scenario.world, game, branch);

		expect(result.game.messages.at(-1)?.text).toBe("Resolved message");
		expect(result.game.variables.command).toEqual([]);
	});

	it("materializes delayed effects before clearing command variables", () => {
		const scenario = createPlayerTestScenario("navigation");
		const game = produce(scenario.game, (draft) => {
			draft.variables.command = [
				{blockId: messageBlockId, type: "text", value: "Delayed resolved message"},
			];
		});
		const branch = CommandConditionBranchSchema.parse({
			id: toID("condition-branch", "delayed-command-branch"),
			if: {
				condition: {type: "group", operation: "all", conditions: []},
				effect: {
					name: "Delayed command message",
					id: toID("effect", "delayed-command-message"),
					type: "group",
					effects: [
						{
							type: "message",
							operation: "show",
							commandVariables: [{blockId: messageBlockId, field: "message"}],
						},
					],
					allowMultipleUsesInWorld: true,
				},
				delayTurns: 2,
				cancelIfConditionFails: true,
			},
		});

		const result = resolveCommandConditionBranchWithResult(scenario.world, game, branch);

		expect(result.game.variables.command).toEqual([]);
		expect(result.game.events.at(-1)?.branch.if?.effect.effects).toEqual([
			{type: "message", operation: "show", message: "Delayed resolved message"},
		]);
	});
});
