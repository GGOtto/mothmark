import {produce} from "immer";
import {
	CommandSchema,
	NumberBlockSchema,
	PatternSchema,
	PhraseBlockSchema,
	type CommandBlock,
} from "@/schemas/world/commandSchemas";
import {CommandConditionBranchSchema} from "@/schemas/world/commandLogicSchemas";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {toID} from "@/utils/idUtils";
import {resolveTurn} from "../player/resolveTurn";
import {createPlayerTestScenario} from "../utils/testUtils";

function numberCommand() {
	const verb: CommandBlock = {
		...createDefaultFieldObject(PhraseBlockSchema),
		id: toID("command-block", "set-number-verb"),
		matches: ["set"],
	};
	const value: CommandBlock = {
		...createDefaultFieldObject(NumberBlockSchema),
		id: toID("command-block", "set-number-value"),
		role: "value",
	};

	return CommandSchema.parse({
		...createDefaultFieldObject(CommandSchema),
		id: toID("command", "set-number"),
		name: "Set number",
		patterns: [
			{
				...createDefaultFieldObject(PatternSchema),
				blocks: [verb, value],
			},
		],
		fallbacks: [
			{
				blockId: value.id,
				behavior: {
					...createDefaultFieldObject(CommandConditionBranchSchema),
					id: toID("condition-branch", "set-number-fallback"),
				},
			},
		],
		behavior: {
			...createDefaultFieldObject(CommandConditionBranchSchema),
			id: toID("condition-branch", "set-number-behavior"),
			always: {
				name: "Store number",
				id: toID("effect", "store-number"),
				type: "group",
				effects: [
					{
						type: "counter",
						operation: "increase",
						counter: "matched-number",
						amount: 0,
						commandVariables: [{blockId: value.id, field: "amount"}],
					},
				],
				allowMultipleUsesInWorld: true,
			},
		},
	});
}

describe("number blocks through the player path", () => {
	it.each([
		["set 3", 3],
		["set three", 3],
		["set number 3", 3],
		["set number three", 3],
		["set the number 3", 3],
		["set the number three", 3],
		["set the number negative three", -3],
	])("resolves %j to the same numeric command variable", (input, expected) => {
		const scenario = createPlayerTestScenario("navigation");
		const world = produce(scenario.world, (draft) => {
			draft.commands = [numberCommand()];
		});

		const nextGame = resolveTurn(world, scenario.game, input);

		expect(nextGame.variables.counters).toContainEqual({"matched-number": expected});
		expect(nextGame.variables.command).toEqual([]);
	});
});
